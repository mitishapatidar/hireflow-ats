/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  OpportunityStage,
  MeetingStatus,
  isValidStageTransition,
  validateOpportunityConversionPrerequisites,
  serializeOpportunitySafe,
  generateJobCode,
  CreateOpportunitySchema,
  UpdateOpportunitySchema,
  ChangeOpportunityStageSchema,
  ConvertOpportunityToJobSchema,
  ScheduleClientMeetingSchema,
  UpdateMeetingOutcomeSchema,
} from '@hireflow/shared';

export const salesRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Write Audit Log
  async function logSalesAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log sales audit log');
    }
  }

  // Guard: Restrict to Internal Staff (Recruiter, Manager, Admin)
  function verifyInternalSalesStaff(user: any) {
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      const err: any = new Error('Access denied: Sales CRM is strictly restricted to internal agency team members');
      err.statusCode = 403;
      throw err;
    }
  }

  // Helper: Generate next sequential job code (e.g. J-212)
  async function generateSequentialJobCode(): Promise<string> {
    const lastJob = await prisma.job.findFirst({
      where: { code: { startsWith: 'J-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    if (!lastJob) return 'J-201';
    const numPart = parseInt(lastJob.code.replace('J-', ''), 10);
    const nextNum = isNaN(numPart) ? 201 : numPart + 1;
    return `J-${nextNum}`;
  }

  // -------------------------------------------------------------------------
  // 1. GET /opportunities — Pipeline Kanban & List View
  // -------------------------------------------------------------------------
  server.get('/opportunities', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const query = request.query as any;
    const stage = query.stage && query.stage !== 'ALL' ? (query.stage as OpportunityStage) : undefined;
    const ownerId = query.ownerId && query.ownerId !== 'ALL' ? query.ownerId : undefined;
    const search = query.search ? String(query.search).trim() : undefined;
    const isRestrictedRecruiter = user.role === UserRole.RECRUITER;

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

    const [opportunities, stageCounts] = await Promise.all([
      prisma.opportunity.findMany({
        where: whereClause,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, legalName: true, status: true } },
          primaryContact: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: [{ priority: 'desc' }, { nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }],
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
    ]);

    const stageSummaries: Record<string, { count: number; totalValue: number }> = {};
    stageCounts.forEach((s) => {
      stageSummaries[s.stage] = {
        count: s._count.id,
        totalValue: s._sum.estimatedValue ? Number(s._sum.estimatedValue) : 0,
      };
    });

    return reply.send({
      success: true,
      data: {
        opportunities: opportunities.map(serializeOpportunitySafe),
        stageSummaries,
        totalCount: opportunities.length,
      },
    });
  });

  // -------------------------------------------------------------------------
  // 2. POST /opportunities — Create New Opportunity
  // -------------------------------------------------------------------------
  server.post('/opportunities', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const parsed = CreateOpportunitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const {
      title,
      companyName,
      clientId,
      primaryContactId,
      contactName,
      contactEmail,
      contactPhone,
      industry,
      location,
      estimatedOpenings,
      estimatedValue,
      expectedCloseDate,
      nextFollowUpAt,
      stage,
      priority,
      notes,
      ownerId,
    } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.create({
        data: {
          title,
          companyName,
          clientId: clientId || undefined,
          primaryContactId: primaryContactId || undefined,
          contactName,
          contactEmail: contactEmail || undefined,
          contactPhone,
          industry,
          location,
          estimatedOpenings,
          estimatedValue: estimatedValue || undefined,
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
          nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
          stage,
          priority,
          notes,
          ownerId: ownerId || user.id,
          organizationId: user.organizationId,
          createdById: user.id,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, legalName: true } },
        },
      });

      await tx.opportunityHistory.create({
        data: {
          opportunityId: opp.id,
          action: 'CREATED',
          newStage: opp.stage,
          details: `Opportunity created in ${opp.stage} stage for ${opp.companyName}`,
          actorId: user.id,
        },
      });

      return opp;
    });

    await logSalesAudit(user.id, 'CREATE_OPPORTUNITY', 'opportunity', result.id, null, {
      title,
      companyName,
      stage,
      ownerId,
    });

    return reply.status(201).send({
      success: true,
      data: { opportunity: serializeOpportunitySafe(result) },
    });
  });

  // -------------------------------------------------------------------------
  // 3. GET /opportunities/:id — Opportunity Dossier
  // -------------------------------------------------------------------------
  server.get('/opportunities/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const { id } = request.params as { id: string };

    const opp = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        client: {
          select: {
            id: true,
            legalName: true,
            status: true,
            commercialTerms: true,
            feePercentage: true,
            paymentTerms: true,
          },
        },
        primaryContact: { select: { id: true, name: true, email: true, phone: true } },
        convertedJob: { select: { id: true, title: true, code: true, status: true } },
        meetings: {
          orderBy: { scheduledAt: 'desc' },
          include: {
            organizer: { select: { id: true, name: true, email: true } },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!opp || opp.isArchived) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Opportunity not found or archived' },
      });
    }

    return reply.send({
      success: true,
      data: {
        opportunity: serializeOpportunitySafe(opp),
        meetings: opp.meetings.map((m) => ({
          id: m.id,
          title: m.title,
          scheduledAt: m.scheduledAt.toISOString(),
          durationMinutes: m.durationMinutes,
          status: m.status,
          outcome: m.outcome,
          contactName: m.contactName,
          nextAction: m.nextAction,
          organizer: m.organizer,
        })),
        history: opp.history.map((h) => ({
          id: h.id,
          action: h.action,
          previousStage: h.previousStage,
          newStage: h.newStage,
          details: h.details,
          createdAt: h.createdAt.toISOString(),
        })),
      },
    });
  });

  // -------------------------------------------------------------------------
  // 4. POST /opportunities/:id/stage — Stage Transition
  // -------------------------------------------------------------------------
  server.post('/opportunities/:id/stage', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const { id } = request.params as { id: string };
    const parsed = ChangeOpportunityStageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const { stage: targetStage, reason } = parsed.data;

    const existing = await prisma.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Opportunity not found' },
      });
    }

    if (!isValidStageTransition(existing.stage as OpportunityStage, targetStage)) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot transition opportunity from '${existing.stage}' to '${targetStage}' directly.`,
        },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.update({
        where: { id },
        data: { stage: targetStage },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, legalName: true } },
        },
      });

      await tx.opportunityHistory.create({
        data: {
          opportunityId: id,
          action: 'STAGE_CHANGED',
          previousStage: existing.stage,
          newStage: targetStage,
          details: reason || `Stage changed to ${targetStage}`,
          actorId: user.id,
        },
      });

      return opp;
    });

    await logSalesAudit(user.id, 'CHANGE_STAGE', 'opportunity', id, { stage: existing.stage }, { stage: targetStage });

    return reply.send({
      success: true,
      data: { opportunity: serializeOpportunitySafe(updated) },
    });
  });

  // -------------------------------------------------------------------------
  // 5. POST /opportunities/:id/convert — Convert WON Opportunity to Job
  // -------------------------------------------------------------------------
  server.post('/opportunities/:id/convert', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const { id } = request.params as { id: string };
    const parsed = ConvertOpportunityToJobSchema.safeParse({ ...(request.body as any), opportunityId: id });
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const {
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
      where: { id },
      include: {
        client: true,
        primaryContact: true,
      },
    });

    if (!opportunity) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Opportunity not found' },
      });
    }

    // Strict Prerequisite Validation Engine
    const validation = validateOpportunityConversionPrerequisites({
      opportunityId: id,
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
      return reply.code(400).send({
        success: false,
        error: {
          code: 'CONVERSION_PREREQUISITE_FAILED',
          message: validation.errors[0],
          details: validation.errors,
        },
      });
    }

    // Atomic Transactional Conversion
    const conversionResult = await prisma.$transaction(async (tx) => {
      // 1. Double-check concurrency race
      const lockedOpp = await tx.opportunity.findUniqueOrThrow({ where: { id } });
      if (lockedOpp.convertedJobId) {
        throw new Error('Opportunity was already converted by another transaction');
      }

      // 2. Link or Create Client record
      let clientId = opportunity.clientId;
      if (!clientId) {
        // Generate new client code CL-100X
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
      } else {
        await tx.client.update({
          where: { id: clientId },
          data: {
            status: 'ACTIVE',
            feePercentage: new Prisma.Decimal(feePercentage),
            paymentTerms,
          },
        });
      }

      // 3. Link or Create ClientContact
      let contactId = opportunity.primaryContactId;
      if (!contactId) {
        const contact = await tx.clientContact.create({
          data: {
            clientId,
            name: contactName,
            email: contactEmail || `contact@${opportunity.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
            phone: contactPhone || null,
            isPrimary: true,
            createdById: user.id,
          },
        });
        contactId = contact.id;
      }

      // 4. Generate sequential job code
      const existingJobs = await tx.job.findMany({
        where: { code: { startsWith: 'J-' } },
        select: { code: true },
      });
      const jobCode = generateJobCode(existingJobs.map((j) => j.code));

      // 5. Create Job in DRAFT status (Strict ATS Rule: Never ACTIVE automatically!)
      const createdJob = await tx.job.create({
        data: {
          code: jobCode,
          title: jobTitle,
          clientId,
          ownerId: recruiterOwnerId,
          hiringManagerContactId: contactId,
          organizationId: user.organizationId,
          openings,
          location: location || opportunity.location || 'Remote / Hybrid',
          employmentType,
          description: description || `Job mandate converted from Opportunity: ${opportunity.title}`,
          status: 'DRAFT', // Mandatory DRAFT status
          createdById: user.id,
        },
      });

      // 6. Recruiter Job Assignment
      await tx.jobAssignment.create({
        data: {
          jobId: createdJob.id,
          recruiterId: recruiterOwnerId,
          assignedById: user.id,
        },
      });

      // 7. Update Opportunity with convertedJobId
      const updatedOpp = await tx.opportunity.update({
        where: { id },
        data: {
          clientId,
          primaryContactId: contactId,
          convertedJobId: createdJob.id,
          convertedAt: new Date(),
          convertedById: user.id,
        },
      });

      // 8. Opportunity Timeline Record
      await tx.opportunityHistory.create({
        data: {
          opportunityId: id,
          action: 'CONVERTED_TO_JOB',
          details: `Opportunity successfully converted into Job ${createdJob.code} (${createdJob.title}) in DRAFT status. Assigned recruiter: ${recruiterOwnerId}.`,
          metadata: {
            jobId: createdJob.id,
            jobCode: createdJob.code,
            clientId,
          },
          actorId: user.id,
        },
      });

      return { job: createdJob, opportunity: updatedOpp };
    });

    await logSalesAudit(user.id, 'CONVERT_OPPORTUNITY_TO_JOB', 'opportunity', id, null, {
      jobId: conversionResult.job.id,
      jobCode: conversionResult.job.code,
      jobStatus: conversionResult.job.status,
    });

    return reply.status(201).send({
      success: true,
      message: 'Opportunity successfully converted into a DRAFT job mandate',
      data: {
        job: {
          id: conversionResult.job.id,
          code: conversionResult.job.code,
          title: conversionResult.job.title,
          status: conversionResult.job.status, // Always DRAFT
          openings: conversionResult.job.openings,
        },
        opportunity: serializeOpportunitySafe(conversionResult.opportunity),
      },
    });
  });

  // -------------------------------------------------------------------------
  // 6. GET /meetings — Meeting Tracker
  // -------------------------------------------------------------------------
  server.get('/meetings', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const query = request.query as any;
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

    return reply.send({
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
    });
  });

  // -------------------------------------------------------------------------
  // 7. POST /meetings — Schedule Client Meeting
  // -------------------------------------------------------------------------
  server.post('/meetings', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const parsed = ScheduleClientMeetingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const {
      clientId,
      opportunityId,
      contactName,
      contactEmail,
      title,
      description,
      meetingType,
      scheduledAt,
      durationMinutes,
      calendarProvider,
      notes,
    } = parsed.data;

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_DATE', message: 'Valid scheduled date and time is required' },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          clientId: clientId || undefined,
          opportunityId: opportunityId || undefined,
          organizerId: user.id,
          title,
          description,
          meetingType,
          status: MeetingStatus.SCHEDULED,
          scheduledAt: scheduledDate,
          durationMinutes,
          contactName,
          contactEmail: contactEmail || undefined,
          notes,
          calendarProvider: calendarProvider || 'DEMO_MODE',
          calendarEventId: `mock-cal-${Date.now()}`,
          createdById: user.id,
        },
        include: {
          client: { select: { id: true, legalName: true } },
          opportunity: { select: { id: true, title: true, companyName: true } },
          organizer: { select: { id: true, name: true, email: true } },
        },
      });

      if (opportunityId) {
        await tx.opportunityHistory.create({
          data: {
            opportunityId,
            action: 'MEETING_SCHEDULED',
            details: `Meeting scheduled: '${title}' for ${scheduledDate.toISOString()}`,
            actorId: user.id,
          },
        });
      }

      return meeting;
    });

    await logSalesAudit(user.id, 'SCHEDULE_MEETING', 'meeting', result.id, null, {
      title,
      scheduledAt: scheduledDate.toISOString(),
      opportunityId,
    });

    return reply.status(201).send({
      success: true,
      data: {
        meeting: {
          id: result.id,
          title: result.title,
          status: result.status,
          scheduledAt: result.scheduledAt.toISOString(),
          organizer: result.organizer,
          demoNotice: 'Demo mode — live Google/Outlook event connects in Prompt 25',
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // 8. PATCH /meetings/:id/outcome — Record Meeting Outcome
  // -------------------------------------------------------------------------
  server.patch('/meetings/:id/outcome', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalSalesStaff(user);

    const { id } = request.params as { id: string };
    const parsed = UpdateMeetingOutcomeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const { status, outcome, notes, nextAction, nextFollowUpAt } = parsed.data;

    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meeting not found' },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.meeting.update({
        where: { id },
        data: {
          status,
          outcome,
          notes,
          nextAction,
          nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
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

    await logSalesAudit(user.id, 'RECORD_MEETING_OUTCOME', 'meeting', id, existing, updated);

    return reply.send({
      success: true,
      data: { meeting: updated },
    });
  });
};
