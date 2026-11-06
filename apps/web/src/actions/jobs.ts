'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  UserRole,
  JobStatus,
  generateJobCode,
  isValidJobStatusTransition,
  getCurrentMonthDateRange,
  CreateJobInputSchema,
  CreateJobInput,
  UpdateJobInputSchema,
  UpdateJobInput,
  TransitionJobStatusSchema,
  TransitionJobStatusInput,
  CreateJobRoundSchema,
  CreateJobRoundInput,
  UpdateJobRoundSchema,
  UpdateJobRoundInput,
  ReorderJobRoundsSchema,
  CreateReassignmentRequestSchema,
  CreateReassignmentRequestInput,
  ReviewReassignmentRequestSchema,
  ReviewReassignmentRequestInput,
  JobQueryFiltersSchema,
  JobQueryFilters,
  serializeJob,
} from '@hireflow/shared';

// Helper: Log Job Audit Event
async function logJobEvent(
  actorId: string,
  action: string,
  jobId: string,
  before?: Prisma.InputJsonValue | null,
  after?: Prisma.InputJsonValue | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'job',
        entityId: jobId,
        before: before ?? Prisma.JsonNull,
        after: after ?? Prisma.JsonNull,
        ipAddress: '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('[logJobEvent] Error logging audit event:', err);
  }
}

// -------------------------------------------------------------
// 1. GET JOBS (List with Search, Filters, Live Stats)
// -------------------------------------------------------------
export async function getJobsAction(rawFilters: Partial<JobQueryFilters> = {}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const parseResult = JobQueryFiltersSchema.safeParse(rawFilters);
    const filters = parseResult.success ? parseResult.data : {
      page: 1,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
      includeArchived: false,
    };

    const organizationId = user.organizationId;
    const where: Prisma.JobWhereInput = {
      organizationId,
      ...(filters.includeArchived ? {} : { isArchived: false }),
    };

    if (user.role === UserRole.CLIENT) {
      const authorizedIds = user.clientAccess?.authorizedJobIds || [];
      where.id = { in: authorizedIds };
      where.status = { not: JobStatus.DRAFT as any };
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }

    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.search && filters.search.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { client: { legalName: { contains: search, mode: 'insensitive' } } },
        { owner: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    const { startUtc, endUtc } = getCurrentMonthDateRange('Asia/Kolkata');

    const [jobs, totalCount, activeCount, pausedCount, filledThisMonthCount] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          client: { select: { id: true, legalName: true, code: true } },
          owner: { select: { id: true, name: true, email: true } },
          hiringManagerContact: { select: { id: true, name: true, email: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { [filters.sortBy]: filters.sortOrder },
        skip,
        take,
      }),
      prisma.job.count({ where }),
      prisma.job.count({
        where: {
          organizationId,
          status: JobStatus.ACTIVE as any,
          isArchived: false,
        },
      }),
      prisma.job.count({
        where: {
          organizationId,
          status: JobStatus.PAUSED as any,
          isArchived: false,
        },
      }),
      prisma.job.count({
        where: {
          organizationId,
          OR: [
            {
              statusHistories: {
                some: {
                  newStatus: JobStatus.CLOSED as any,
                  reason: 'POSITION_FILLED',
                  createdAt: { gte: startUtc, lte: endUtc },
                },
              },
            },
            {
              applications: {
                some: {
                  placement: {
                    createdAt: { gte: startUtc, lte: endUtc },
                  },
                },
              },
            },
          ],
        },
      }),
    ]);

    const serializedJobs = jobs.map((job) => serializeJob(job, user.role));

    return {
      success: true,
      data: {
        jobs: serializedJobs,
        stats: {
          openJobs: activeCount,
          onHoldJobs: pausedCount,
          filledThisMonth: filledThisMonthCount,
          totalJobs: totalCount,
        },
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalCount,
          totalPages: Math.ceil(totalCount / filters.limit),
        },
      },
    };
  } catch (error: any) {
    console.error('[getJobsAction] Error:', error);
    return { success: false, error: error.message || 'Failed to fetch jobs' };
  }
}

// -------------------------------------------------------------
// 2. GET JOB DETAIL (Full Record)
// -------------------------------------------------------------
export async function getJobDetailAction(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const job = await prisma.job.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        client: { select: { id: true, legalName: true, code: true } },
        owner: { select: { id: true, name: true, email: true } },
        hiringManagerContact: { select: { id: true, name: true, email: true } },
        rounds: {
          where: { isArchived: false },
          orderBy: { roundOrder: 'asc' },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            recruiter: { select: { id: true, name: true, email: true } },
            assignedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistories: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        reassignmentRequests: {
          include: {
            requestingRecruiter: { select: { id: true, name: true } },
            targetRecruiter: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { applications: true } },
      },
    });

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (user.role === UserRole.CLIENT) {
      const authorizedIds = user.clientAccess?.authorizedJobIds || [];
      if (!authorizedIds.includes(job.id)) {
        return { success: false, error: 'Forbidden: Unauthorized job access' };
      }
    }

    return { success: true, data: serializeJob(job, user.role) };
  } catch (error: any) {
    console.error('[getJobDetailAction] Error:', error);
    return { success: false, error: error.message || 'Failed to fetch job record' };
  }
}

// -------------------------------------------------------------
// 3. CREATE JOB
// -------------------------------------------------------------
export async function createJobAction(input: CreateJobInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { success: false, error: 'Forbidden: Insufficient permissions to create jobs' };
    }

    const parseResult = CreateJobInputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      };
    }

    const data = parseResult.data;

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organizationId: user.organizationId, isArchived: false },
    });
    if (!client) {
      return { success: false, error: 'Invalid or archived client specified' };
    }

    const existingJobs = await prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { code: true },
    });
    const generatedCode = generateJobCode(existingJobs.map((j) => j.code));

    const defaultRounds = data.initialRounds && data.initialRounds.length > 0
      ? data.initialRounds
      : [
          { name: 'Initial Screening', roundOrder: 1, interviewType: 'VIDEO', durationMinutes: 30, description: 'HR / Recruiter Screening' },
          { name: 'Technical Assessment', roundOrder: 2, interviewType: 'TECHNICAL', durationMinutes: 60, description: 'Coding & Architecture evaluation' },
          { name: 'Hiring Manager Interview', roundOrder: 3, interviewType: 'HIRING_MANAGER', durationMinutes: 45, description: 'Direct manager fit & alignment' },
          { name: 'Culture & Leadership', roundOrder: 4, interviewType: 'CULTURE_FIT', durationMinutes: 45, description: 'Values and team synergy' },
        ];

    const ownerId = data.ownerId || user.id;

    const newJob = await prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          code: generatedCode,
          title: data.title,
          clientId: data.clientId,
          hiringManagerContactId: data.hiringManagerContactId || null,
          ownerId,
          organizationId: user.organizationId,
          openings: data.openings,
          location: data.location || null,
          employmentType: data.employmentType,
          salaryMin: data.salaryMin != null ? new Prisma.Decimal(data.salaryMin) : null,
          salaryMax: data.salaryMax != null ? new Prisma.Decimal(data.salaryMax) : null,
          description: data.description || null,
          requirements: data.requirements || null,
          deadline: data.deadline || null,
          status: JobStatus.DRAFT as any,
          createdById: user.id,
          rounds: {
            create: defaultRounds.map((r) => ({
              name: r.name,
              roundOrder: r.roundOrder,
              interviewType: r.interviewType,
              durationMinutes: r.durationMinutes,
              description: r.description || null,
              createdById: user.id,
            })),
          },
          statusHistories: {
            create: {
              previousStatus: null,
              newStatus: JobStatus.DRAFT as any,
              changedById: user.id,
              reason: 'INITIAL_CREATION',
              note: 'Job drafted',
              createdById: user.id,
            },
          },
        },
        include: {
          client: { select: { id: true, legalName: true, code: true } },
          owner: { select: { id: true, name: true, email: true } },
          hiringManagerContact: { select: { id: true, name: true, email: true } },
          rounds: { orderBy: { roundOrder: 'asc' } },
        },
      });

      if (data.assignedRecruiterIds && data.assignedRecruiterIds.length > 0) {
        for (const recId of data.assignedRecruiterIds) {
          await tx.jobAssignment.create({
            data: {
              jobId: created.id,
              recruiterId: recId,
              assignedById: user.id,
              status: 'ACTIVE',
              createdById: user.id,
            },
          });
        }
      } else if (ownerId) {
        await tx.jobAssignment.create({
          data: {
            jobId: created.id,
            recruiterId: ownerId,
            assignedById: user.id,
            status: 'ACTIVE',
            createdById: user.id,
          },
        });
      }

      return created;
    });

    await logJobEvent(user.id, 'job.create', newJob.id, null, {
      code: newJob.code,
      title: newJob.title,
      status: newJob.status,
    });

    revalidatePath('/jobs');
    return { success: true, data: serializeJob(newJob, user.role) };
  } catch (error: any) {
    console.error('[createJobAction] Error:', error);
    return { success: false, error: error.message || 'Failed to create job' };
  }
}

// -------------------------------------------------------------
// 4. UPDATE JOB CONFIGURATION
// -------------------------------------------------------------
export async function updateJobConfigurationAction(id: string, input: UpdateJobInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const existing = await prisma.job.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      return { success: false, error: 'Job not found' };
    }

    if (
      user.role === UserRole.RECRUITER &&
      existing.ownerId !== user.id &&
      !(await prisma.jobAssignment.findFirst({ where: { jobId: id, recruiterId: user.id, status: 'ACTIVE' } }))
    ) {
      return { success: false, error: 'Forbidden: Insufficient permissions to edit this job' };
    }

    const parseResult = UpdateJobInputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      };
    }

    const data = parseResult.data;
    const updateData: Prisma.JobUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.hiringManagerContactId !== undefined) {
      updateData.hiringManagerContact = data.hiringManagerContactId
        ? { connect: { id: data.hiringManagerContactId } }
        : { disconnect: true };
    }
    if (data.ownerId !== undefined && (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER)) {
      updateData.owner = data.ownerId ? { connect: { id: data.ownerId } } : { disconnect: true };
    }
    if (data.openings !== undefined) updateData.openings = data.openings;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
    if (data.salaryMin !== undefined) {
      updateData.salaryMin = data.salaryMin != null ? new Prisma.Decimal(data.salaryMin) : null;
    }
    if (data.salaryMax !== undefined) {
      updateData.salaryMax = data.salaryMax != null ? new Prisma.Decimal(data.salaryMax) : null;
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.requirements !== undefined) updateData.requirements = data.requirements;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;

    const updated = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, legalName: true, code: true } },
        owner: { select: { id: true, name: true, email: true } },
        hiringManagerContact: { select: { id: true, name: true, email: true } },
        rounds: { where: { isArchived: false }, orderBy: { roundOrder: 'asc' } },
      },
    });

    await logJobEvent(user.id, 'job.update_configuration', id, existing, updated);

    revalidatePath('/jobs');
    revalidatePath(`/jobs/${id}`);
    return { success: true, data: serializeJob(updated, user.role) };
  } catch (error: any) {
    console.error('[updateJobConfigurationAction] Error:', error);
    return { success: false, error: error.message || 'Failed to update job configuration' };
  }
}

// -------------------------------------------------------------
// 5. STATUS TRANSITIONS
// -------------------------------------------------------------
export async function transitionJobStatusAction(id: string, input: TransitionJobStatusInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const parseResult = TransitionJobStatusSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid transition payload' };
    }

    const { targetStatus, reason, closingNote, note } = parseResult.data;

    const job = await prisma.job.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    const requireJobApproval = false;
    const transitionResult = isValidJobStatusTransition(
      job.status as JobStatus,
      targetStatus,
      requireJobApproval
    );

    if (!transitionResult.valid) {
      return { success: false, error: `Invalid status transition: ${transitionResult.reason}` };
    }

    if (user.role === UserRole.RECRUITER && (targetStatus === JobStatus.CLOSED || targetStatus === JobStatus.ACTIVE)) {
      const isAssigned = await prisma.jobAssignment.findFirst({
        where: { jobId: id, recruiterId: user.id, status: 'ACTIVE' },
      });
      if (job.ownerId !== user.id && !isAssigned) {
        return { success: false, error: 'Forbidden: Not authorized to transition this job' };
      }
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
      const updatePayload: Prisma.JobUpdateInput = {
        status: targetStatus as any,
      };

      if (targetStatus === JobStatus.PAUSED) {
        updatePayload.pauseReason = reason || 'ON_HOLD';
      } else if (targetStatus === JobStatus.ACTIVE && job.status === JobStatus.PAUSED) {
        updatePayload.resumeReason = reason || 'RESUMED';
      } else if (targetStatus === JobStatus.ACTIVE && job.status === JobStatus.CLOSED) {
        updatePayload.reopenReason = reason || 'REOPENED';
        updatePayload.closingReason = null;
        updatePayload.closingNote = null;
      } else if (targetStatus === JobStatus.CLOSED) {
        updatePayload.closingReason = reason || 'CLOSED';
        if (closingNote) updatePayload.closingNote = closingNote;
      }

      const res = await tx.job.update({
        where: { id },
        data: updatePayload,
        include: {
          client: { select: { id: true, legalName: true, code: true } },
          owner: { select: { id: true, name: true, email: true } },
          hiringManagerContact: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: id,
          previousStatus: job.status as any,
          newStatus: targetStatus as any,
          changedById: user.id,
          reason: reason || null,
          note: note || closingNote || null,
          createdById: user.id,
        },
      });

      return res;
    });

    await logJobEvent(user.id, `job.transition.${targetStatus.toLowerCase()}`, id, {
      status: job.status,
    }, {
      status: updatedJob.status,
      reason,
    });

    revalidatePath('/jobs');
    revalidatePath(`/jobs/${id}`);
    return { success: true, data: serializeJob(updatedJob, user.role) };
  } catch (error: any) {
    console.error('[transitionJobStatusAction] Error:', error);
    return { success: false, error: error.message || 'Failed to update job status' };
  }
}

export async function activateJobAction(id: string) {
  return transitionJobStatusAction(id, { targetStatus: JobStatus.ACTIVE, reason: 'ACTIVATED' });
}

export async function pauseJobAction(id: string, reason: string, note?: string) {
  return transitionJobStatusAction(id, { targetStatus: JobStatus.PAUSED, reason, note });
}

export async function resumeJobAction(id: string, note?: string) {
  return transitionJobStatusAction(id, { targetStatus: JobStatus.ACTIVE, reason: 'RESUMED', note });
}

export async function closeJobAction(id: string, closingReason: string, closingNote?: string, note?: string) {
  return transitionJobStatusAction(id, {
    targetStatus: JobStatus.CLOSED,
    reason: closingReason,
    closingNote,
    note,
  });
}

export async function reopenJobAction(id: string, reason?: string, note?: string) {
  return transitionJobStatusAction(id, { targetStatus: JobStatus.ACTIVE, reason: reason || 'REOPENED', note });
}

// -------------------------------------------------------------
// 6. INTERVIEW ROUNDS ACTIONS
// -------------------------------------------------------------
export async function createJobRoundAction(jobId: string, input: CreateJobRoundInput) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { success: false, error: 'Forbidden' };
    }

    const parseResult = CreateJobRoundSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid round data', details: parseResult.error.flatten() };
    }

    const data = parseResult.data;
    const existing = await prisma.jobRound.findMany({
      where: { jobId, isArchived: false },
      select: { roundOrder: true },
    });
    const maxOrder = existing.reduce((max, r) => Math.max(max, r.roundOrder), 0);
    const roundOrder = data.roundOrder || maxOrder + 1;

    const round = await prisma.jobRound.create({
      data: {
        jobId,
        name: data.name,
        roundOrder,
        interviewType: data.interviewType,
        durationMinutes: data.durationMinutes,
        panelMembers: data.panelMembers,
        description: data.description || null,
        createdById: user.id,
      },
    });

    await logJobEvent(user.id, 'job.add_round', jobId, null, { roundId: round.id, name: round.name });
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, data: round };
  } catch (error: any) {
    console.error('[createJobRoundAction] Error:', error);
    return { success: false, error: error.message || 'Failed to create round' };
  }
}

export async function updateJobRoundAction(jobId: string, roundId: string, input: UpdateJobRoundInput) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { success: false, error: 'Forbidden' };
    }

    const parseResult = UpdateJobRoundSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid round update', details: parseResult.error.flatten() };
    }

    const data = parseResult.data;
    const updated = await prisma.jobRound.update({
      where: { id: roundId, jobId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.interviewType ? { interviewType: data.interviewType } : {}),
        ...(data.durationMinutes ? { durationMinutes: data.durationMinutes } : {}),
        ...(data.panelMembers ? { panelMembers: data.panelMembers } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });

    await logJobEvent(user.id, 'job.update_round', jobId, null, { roundId, name: updated.name });
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('[updateJobRoundAction] Error:', error);
    return { success: false, error: error.message || 'Failed to update round' };
  }
}

export async function reorderJobRoundsAction(jobId: string, roundIds: string[]) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { success: false, error: 'Forbidden' };
    }

    const parseResult = ReorderJobRoundsSchema.safeParse({ roundIds });
    if (!parseResult.success) {
      return { success: false, error: 'Invalid reorder input' };
    }

    await prisma.$transaction(
      roundIds.map((roundId, index) =>
        prisma.jobRound.update({
          where: { id: roundId, jobId },
          data: { roundOrder: index + 1 },
        })
      )
    );

    await logJobEvent(user.id, 'job.reorder_rounds', jobId, null, { roundIds });
    revalidatePath(`/jobs/${jobId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[reorderJobRoundsAction] Error:', error);
    return { success: false, error: error.message || 'Failed to reorder rounds' };
  }
}

export async function archiveJobRoundAction(jobId: string, roundId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { success: false, error: 'Forbidden' };
    }

    const archived = await prisma.jobRound.update({
      where: { id: roundId, jobId },
      data: { isArchived: true },
    });

    await logJobEvent(user.id, 'job.archive_round', jobId, null, { roundId, name: archived.name });
    revalidatePath(`/jobs/${jobId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[archiveJobRoundAction] Error:', error);
    return { success: false, error: error.message || 'Failed to deactivate round' };
  }
}

// -------------------------------------------------------------
// 7. RECRUITER ASSIGNMENTS & REASSIGNMENT REQUESTS
// -------------------------------------------------------------
export async function assignRecruiterAction(jobId: string, recruiterId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
      return { success: false, error: 'Forbidden: Only Managers and Admins can assign recruiters' };
    }

    const assignment = await prisma.jobAssignment.upsert({
      where: { jobId_recruiterId: { jobId, recruiterId } },
      create: {
        jobId,
        recruiterId,
        assignedById: user.id,
        status: 'ACTIVE',
        createdById: user.id,
      },
      update: {
        status: 'ACTIVE',
        assignedById: user.id,
      },
    });

    await logJobEvent(user.id, 'job.assign_recruiter', jobId, null, { recruiterId });
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, data: assignment };
  } catch (error: any) {
    console.error('[assignRecruiterAction] Error:', error);
    return { success: false, error: error.message || 'Failed to assign recruiter' };
  }
}

export async function unassignRecruiterAction(jobId: string, recruiterId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
      return { success: false, error: 'Forbidden: Only Managers and Admins can unassign recruiters' };
    }

    await prisma.jobAssignment.updateMany({
      where: { jobId, recruiterId },
      data: { status: 'INACTIVE' },
    });

    await logJobEvent(user.id, 'job.unassign_recruiter', jobId, null, { recruiterId });
    revalidatePath(`/jobs/${jobId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[unassignRecruiterAction] Error:', error);
    return { success: false, error: error.message || 'Failed to unassign recruiter' };
  }
}

export async function requestReassignmentAction(jobId: string, input: CreateReassignmentRequestInput) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { success: false, error: 'Forbidden' };
    }

    const parseResult = CreateReassignmentRequestSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid reassignment request', details: parseResult.error.flatten() };
    }

    const { targetRecruiterId, reason } = parseResult.data;

    const request = await prisma.jobReassignmentRequest.create({
      data: {
        jobId,
        requestingRecruiterId: user.id,
        targetRecruiterId: targetRecruiterId || null,
        reason,
        status: 'PENDING',
        createdById: user.id,
      },
    });

    await logJobEvent(user.id, 'job.reassignment_requested', jobId, null, { requestId: request.id, reason });
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, data: request };
  } catch (error: any) {
    console.error('[requestReassignmentAction] Error:', error);
    return { success: false, error: error.message || 'Failed to submit reassignment request' };
  }
}

export async function reviewReassignmentRequestAction(jobId: string, requestId: string, input: ReviewReassignmentRequestInput) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
      return { success: false, error: 'Forbidden: Only Managers and Admins can review reassignment requests' };
    }

    const parseResult = ReviewReassignmentRequestSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid review payload' };
    }

    const { status, reviewNotes } = parseResult.data;

    const reqRecord = await prisma.jobReassignmentRequest.findFirst({
      where: { id: requestId, jobId },
    });
    if (!reqRecord) {
      return { success: false, error: 'Reassignment request not found' };
    }

    const reviewed = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.jobReassignmentRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        },
      });

      if (status === 'APPROVED' && reqRecord.targetRecruiterId) {
        await tx.job.update({
          where: { id: jobId },
          data: { ownerId: reqRecord.targetRecruiterId },
        });

        await tx.jobAssignment.upsert({
          where: {
            jobId_recruiterId: { jobId, recruiterId: reqRecord.targetRecruiterId },
          },
          create: {
            jobId,
            recruiterId: reqRecord.targetRecruiterId,
            assignedById: user.id,
            status: 'ACTIVE',
            createdById: user.id,
          },
          update: {
            status: 'ACTIVE',
            assignedById: user.id,
          },
        });
      }

      return updatedReq;
    });

    await logJobEvent(user.id, `job.reassignment_${status.toLowerCase()}`, jobId, null, {
      requestId,
      status,
      reviewNotes,
    });

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, data: reviewed };
  } catch (error: any) {
    console.error('[reviewReassignmentRequestAction] Error:', error);
    return { success: false, error: error.message || 'Failed to review reassignment request' };
  }
}

// -------------------------------------------------------------
// 8. METADATA HELPER (For Form Dropdowns)
// -------------------------------------------------------------
export async function getJobFormMetadataAction() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const [clients, recruiters] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId: user.organizationId, isArchived: false },
        select: {
          id: true,
          legalName: true,
          code: true,
          contacts: {
            select: { id: true, name: true, email: true, designation: true },
          },
        },
        orderBy: { legalName: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
          role: { in: [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN] },
          status: 'ACTIVE',
          isArchived: false,
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      success: true,
      data: {
        clients,
        recruiters,
      },
    };
  } catch (error: any) {
    console.error('[getJobFormMetadataAction] Error:', error);
    return { success: false, error: 'Failed to fetch form metadata' };
  }
}
