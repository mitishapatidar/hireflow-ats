'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  OpportunityStage,
  MeetingStatus,
  isValidStageTransition,
  validateOpportunityConversionPrerequisites,
  serializeOpportunitySafe,
  CreateOpportunitySchema,
  ConvertOpportunityToJobSchema,
  ScheduleClientMeetingSchema,
  UpdateMeetingOutcomeSchema,
} from '@hireflow/shared';

function canAccessSales(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.RECRUITER;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Get Sales Pipeline (Opportunities by Stage & Kanban)
// ─────────────────────────────────────────────────────────────────────────────
export async function getSalesPipelineAction(filters?: {
  stage?: OpportunityStage | 'ALL';
  ownerId?: string | 'ALL';
  search?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSales(user.role)) {
      return { success: false, error: 'Unauthorized: Internal sales team access only' };
    }

    const isRestrictedRecruiter = user.role === UserRole.RECRUITER;
    const stage = filters?.stage && filters.stage !== 'ALL' ? filters.stage : undefined;
    const ownerId = filters?.ownerId && filters.ownerId !== 'ALL' ? filters.ownerId : undefined;
    const search = filters?.search ? filters.search.trim() : undefined;

    const whereClause: Prisma.OpportunityWhereInput = {
      isArchived: false,
      organizationId: user.organizationId,
      ...(isRestrictedRecruiter ? { ownerId: user.id } : ownerId ? { ownerId } : {}),
      ...(stage ? { stage } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { contactName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [opportunities, stageCounts, recruiters] = await Promise.all([
      prisma.opportunity.findMany({
        where: whereClause,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, legalName: true, status: true, code: true } },
          primaryContact: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.opportunity.groupBy({
        by: ['stage'],
        where: {
          isArchived: false,
          organizationId: user.organizationId,
          ...(isRestrictedRecruiter ? { ownerId: user.id } : {}),
        },
        _count: { id: true },
        _sum: { estimatedValue: true },
      }),
      prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
          role: { in: [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN] },
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const stageSummaries: Record<string, { count: number; totalValue: number }> = {
      PROSPECTING: { count: 0, totalValue: 0 },
      MEETING: { count: 0, totalValue: 0 },
      PROPOSAL: { count: 0, totalValue: 0 },
      WON: { count: 0, totalValue: 0 },
      LOST: { count: 0, totalValue: 0 },
    };

    stageCounts.forEach((s) => {
      stageSummaries[s.stage] = {
        count: s._count.id,
        totalValue: s._sum.estimatedValue ? Number(s._sum.estimatedValue) : 0,
      };
    });

    return {
      success: true,
      data: {
        opportunities: opportunities.map(serializeOpportunitySafe),
        stageSummaries,
        recruiters,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load sales pipeline' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create Opportunity
// ─────────────────────────────────────────────────────────────────────────────
export async function createOpportunityAction(input: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSales(user.role)) {
      return { success: false, error: 'Unauthorized: Internal sales team access only' };
    }

    const parsed = CreateOpportunitySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid opportunity input' };
    }

    const data = parsed.data;
    const opp = await prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          title: data.title,
          companyName: data.companyName,
          clientId: data.clientId || null,
          primaryContactId: data.primaryContactId || null,
          contactName: data.contactName || null,
          contactEmail: data.contactEmail || null,
          contactPhone: data.contactPhone || null,
          industry: data.industry || null,
          location: data.location || null,
          estimatedOpenings: data.estimatedOpenings || 1,
          estimatedValue: data.estimatedValue ? new Prisma.Decimal(data.estimatedValue) : null,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
          stage: data.stage || OpportunityStage.PROSPECTING,
          priority: data.priority || 'MEDIUM',
          notes: data.notes || null,
          ownerId: data.ownerId || user.id,
          organizationId: user.organizationId,
          createdById: user.id,
        },
      });

      await tx.opportunityHistory.create({
        data: {
          opportunityId: created.id,
          action: 'CREATED',
          newStage: created.stage,
          details: `Opportunity created in ${created.stage} stage for ${created.companyName}`,
          actorId: user.id,
        },
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CREATE_OPPORTUNITY',
        entity: 'Opportunity',
        entityId: opp.id,
        after: { title: data.title, companyName: data.companyName, stage: opp.stage },
      },
    });

    revalidatePath('/sales');
    return { success: true, data: serializeOpportunitySafe(opp) };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create opportunity' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Change Opportunity Stage
// ─────────────────────────────────────────────────────────────────────────────
export async function changeOpportunityStageAction(
  opportunityId: string,
  targetStage: OpportunityStage,
  reason?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSales(user.role)) {
      return { success: false, error: 'Unauthorized: Internal sales team access only' };
    }

    const existing = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!existing || existing.isArchived) {
      return { success: false, error: 'Opportunity not found or archived' };
    }

    if (user.role === UserRole.RECRUITER && existing.ownerId !== user.id) {
      return { success: false, error: 'Forbidden: You can only update your own opportunities' };
    }

    if (existing.stage === targetStage) {
      return { success: true, data: serializeOpportunitySafe(existing) };
    }

    const transitionValid = isValidStageTransition(existing.stage as OpportunityStage, targetStage);
    if (!transitionValid) {
      return {
        success: false,
        error: `Invalid stage progression from ${existing.stage} to ${targetStage}`,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.update({
        where: { id: opportunityId },
        data: {
          stage: targetStage,
          updatedAt: new Date(),
        },
      });

      await tx.opportunityHistory.create({
        data: {
          opportunityId,
          action: 'STAGE_CHANGED',
          previousStage: existing.stage,
          newStage: targetStage,
          details: reason || `Stage moved from ${existing.stage} to ${targetStage}`,
          actorId: user.id,
        },
      });

      return opp;
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CHANGE_STAGE',
        entity: 'Opportunity',
        entityId: opportunityId,
        before: { stage: existing.stage },
        after: { stage: targetStage },
      },
    });

    revalidatePath('/sales');
    return { success: true, data: serializeOpportunitySafe(updated) };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to change stage' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Convert WON Opportunity to Job Mandate (Guaranteed DRAFT Status)
// ─────────────────────────────────────────────────────────────────────────────
export async function convertOpportunityToJobAction(input: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSales(user.role)) {
      return { success: false, error: 'Unauthorized: Internal sales team access only' };
    }

    const parsed = ConvertOpportunityToJobSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid conversion payload' };
    }

    const {
      opportunityId,
      contactName,
      contactEmail,
      contactPhone,
      feePercentage,
      paymentTerms,
      jobTitle,
      recruiterOwnerId,
      openings,
      location,
      employmentType,
      description,
    } = parsed.data;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        client: true,
        primaryContact: true,
      },
    });

    if (!opportunity) {
      return { success: false, error: 'Opportunity not found' };
    }

    // Domain validation check
    const validation = validateOpportunityConversionPrerequisites({
      opportunityId,
      opportunityStage: opportunity.stage,
      isAlreadyConverted: Boolean(opportunity.convertedJobId),
      companyName: opportunity.companyName,
      primaryContact: {
        name: contactName || opportunity.contactName || opportunity.primaryContact?.name,
        email: contactEmail || opportunity.contactEmail || opportunity.primaryContact?.email,
        phone: contactPhone || opportunity.contactPhone || opportunity.primaryContact?.phone,
      },
      commercialTerms: {
        feePercentage:
          feePercentage !== undefined
            ? feePercentage
            : opportunity.client?.feePercentage
            ? Number(opportunity.client.feePercentage)
            : undefined,
        paymentTerms: paymentTerms || opportunity.client?.paymentTerms,
      },
      jobDetails: {
        title: jobTitle,
        recruiterOwnerId,
        openings,
        location,
        employmentType,
        description,
      },
    });

    if (!validation.allowed) {
      return { success: false, error: validation.errors[0] || 'Prerequisites for conversion not met' };
    }

    // Transactional conversion
    const result = await prisma.$transaction(async (tx) => {
      const lockedOpp = await tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
      if (lockedOpp.convertedJobId) {
        throw new Error('Opportunity was already converted into a job mandate');
      }

      // Link or Create Client record
      let clientId = opportunity.clientId;
      if (!clientId) {
        const lastClient = await tx.client.findFirst({
          where: { code: { startsWith: 'CL-' } },
          orderBy: { code: 'desc' },
          select: { code: true },
        });
        const numPart = lastClient ? parseInt(lastClient.code.replace('CL-', ''), 10) : 1000;
        const nextCode = `CL-${isNaN(numPart) ? 1001 : numPart + 1}`;

        const createdClient = await tx.client.create({
          data: {
            code: nextCode,
            legalName: opportunity.companyName,
            status: 'ACTIVE',
            industry: opportunity.industry,
            location: location || opportunity.location,
            relationshipOwnerId: user.id,
            organizationId: user.organizationId,
            feePercentage: new Prisma.Decimal(feePercentage),
            paymentTerms,
            createdById: user.id,
          },
        });
        clientId = createdClient.id;

        // Create contact
        if (contactName) {
          await tx.clientContact.create({
            data: {
              clientId: createdClient.id,
              name: contactName,
              email: contactEmail || 'contact@client.com',
              phone: contactPhone || undefined,
              isPrimary: true,
              designation: 'Hiring Manager',
            },
          });
        }
      }

      // Generate next sequential Job Code (J-20X)
      const lastJob = await tx.job.findFirst({
        where: { code: { startsWith: 'J-' } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      const numPart = lastJob ? parseInt(lastJob.code.replace('J-', ''), 10) : 200;
      const nextJobCode = `J-${isNaN(numPart) ? 201 : numPart + 1}`;

      // Create Job in DRAFT status
      const createdJob = await tx.job.create({
        data: {
          code: nextJobCode,
          title: jobTitle,
          clientId,
          ownerId: recruiterOwnerId,
          organizationId: user.organizationId,
          status: 'DRAFT', // Mandatory DRAFT
          openings: openings || 1,
          location: location || opportunity.location,
          employmentType: employmentType || 'FULL_TIME',
          description: description || `Mandate converted from opportunity: ${opportunity.title}`,
          isArchived: false,
          createdById: user.id,
        },
      });

      // Update opportunity conversion status
      const updatedOpp = await tx.opportunity.update({
        where: { id: opportunityId },
        data: {
          convertedJobId: createdJob.id,
          convertedAt: new Date(),
          convertedById: user.id,
          clientId,
          stage: OpportunityStage.WON,
        },
      });

      await tx.opportunityHistory.create({
        data: {
          opportunityId,
          action: 'CONVERTED_TO_JOB',
          details: `Successfully converted into DRAFT job mandate ${createdJob.code}: '${createdJob.title}'`,
          actorId: user.id,
        },
      });

      return { job: createdJob, opportunity: updatedOpp };
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CONVERT_OPPORTUNITY_TO_JOB',
        entity: 'Job',
        entityId: result.job.id,
        after: {
          jobCode: result.job.code,
          jobStatus: result.job.status,
          opportunityId,
        },
      },
    });

    revalidatePath('/sales');
    revalidatePath('/jobs');
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to convert opportunity to job mandate' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Get Client Meetings (Meeting Tracker)
// ─────────────────────────────────────────────────────────────────────────────
export async function getClientMeetingsAction() {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSales(user.role)) {
      return { success: false, error: 'Unauthorized: Internal sales team access only' };
    }

    const isRestrictedRecruiter = user.role === UserRole.RECRUITER;

    const meetings = await prisma.meeting.findMany({
      where: {
        ...(isRestrictedRecruiter ? { organizerId: user.id } : {}),
      },
      include: {
        client: { select: { id: true, legalName: true } },
        opportunity: { select: { id: true, title: true, companyName: true, stage: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });

    return {
      success: true,
      data: {
        meetings: meetings.map((m) => {
          const istTime = new Date(m.scheduledAt.getTime() + 5.5 * 60 * 60 * 1000);
          const timeStr = `${istTime.getUTCHours().toString().padStart(2, '0')}:${istTime
            .getUTCMinutes()
            .toString()
            .padStart(2, '0')} IST`;

          return {
            id: m.id,
            title: m.title,
            description: m.description,
            scheduledAt: m.scheduledAt.toISOString(),
            timeIST: timeStr,
            durationMinutes: m.durationMinutes,
            status: m.status,
            outcome: m.outcome,
            nextAction: m.nextAction,
            nextFollowUpAt: m.nextFollowUpAt ? m.nextFollowUpAt.toISOString() : null,
            contactName: m.contactName,
            contactEmail: m.contactEmail,
            companyName: m.opportunity?.companyName || m.client?.legalName || 'Prospective Client',
            opportunity: m.opportunity,
            client: m.client,
            organizer: m.organizer,
            calendarProvider: m.calendarProvider,
            demoNotice: 'Demo mode — calendar sync active in production Google/Outlook OAuth',
          };
        }),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load client meetings' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Schedule Client Meeting
// ─────────────────────────────────────────────────────────────────────────────
export async function scheduleClientMeetingAction(input: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSales(user.role)) {
      return { success: false, error: 'Unauthorized: Internal sales team access only' };
    }

    const parsed = ScheduleClientMeetingSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid meeting parameters' };
    }

    const data = parsed.data;
    const scheduledDate = new Date(data.scheduledAt);

    const meeting = await prisma.$transaction(async (tx) => {
      const created = await tx.meeting.create({
        data: {
          clientId: data.clientId || undefined,
          opportunityId: data.opportunityId || undefined,
          organizerId: user.id,
          title: data.title,
          description: data.description,
          meetingType: data.meetingType,
          status: MeetingStatus.SCHEDULED,
          scheduledAt: scheduledDate,
          durationMinutes: data.durationMinutes,
          contactName: data.contactName,
          contactEmail: data.contactEmail || undefined,
          notes: data.notes,
          calendarProvider: data.calendarProvider || 'DEMO_MODE',
          calendarEventId: `mock-cal-${Date.now()}`,
          createdById: user.id,
        },
      });

      if (data.opportunityId) {
        await tx.opportunityHistory.create({
          data: {
            opportunityId: data.opportunityId,
            action: 'MEETING_SCHEDULED',
            details: `Meeting scheduled: '${data.title}' for ${scheduledDate.toISOString()}`,
            actorId: user.id,
          },
        });
      }

      return created;
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'SCHEDULE_MEETING',
        entity: 'Meeting',
        entityId: meeting.id,
        after: { title: data.title, scheduledAt: scheduledDate.toISOString() },
      },
    });

    revalidatePath('/sales');
    return { success: true, data: meeting };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to schedule meeting' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Update Meeting Outcome
// ─────────────────────────────────────────────────────────────────────────────
export async function updateMeetingOutcomeAction(meetingId: string, input: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSales(user.role)) {
      return { success: false, error: 'Unauthorized: Internal sales team access only' };
    }

    const parsed = UpdateMeetingOutcomeSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid outcome details' };
    }

    const { status, outcome, notes, nextAction, nextFollowUpAt } = parsed.data;

    const existing = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!existing) {
      return { success: false, error: 'Meeting not found' };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status,
          outcome,
          notes: notes || undefined,
          nextAction: nextAction || undefined,
          nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
          updatedAt: new Date(),
        },
      });

      if (m.opportunityId) {
        await tx.opportunityHistory.create({
          data: {
            opportunityId: m.opportunityId,
            action: status === MeetingStatus.COMPLETED ? 'MEETING_COMPLETED' : 'MEETING_UPDATED',
            details: `Meeting outcome: ${outcome}. Next action: ${nextAction || 'None'}`,
            actorId: user.id,
          },
        });

        if (nextFollowUpAt) {
          await tx.opportunity.update({
            where: { id: m.opportunityId },
            data: { nextFollowUpAt: new Date(nextFollowUpAt) },
          });
        }
      }

      return m;
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'RECORD_MEETING_OUTCOME',
        entity: 'Meeting',
        entityId: meetingId,
        before: { status: existing.status },
        after: { status, outcome, nextAction },
      },
    });

    revalidatePath('/sales');
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record meeting outcome' };
  }
}
