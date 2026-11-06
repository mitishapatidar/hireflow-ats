import { FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  can,
  UserRole,
  JobStatus,
  generateJobCode,
  isValidJobStatusTransition,
  canJobAcceptApplications,
  getCurrentMonthDateRange,
  CreateJobInputSchema,
  UpdateJobInputSchema,
  TransitionJobStatusSchema,
  CreateJobRoundSchema,
  UpdateJobRoundSchema,
  ReorderJobRoundsSchema,
  CreateReassignmentRequestSchema,
  ReviewReassignmentRequestSchema,
  JobQueryFiltersSchema,
  serializeJob,
} from '@hireflow/shared';

export const jobRoutes: FastifyPluginAsync = async (server) => {
  // Helper: Log Job Audit Event
  async function logJobEvent(
    actorId: string,
    action: string,
    jobId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'job',
          entityId: jobId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log job audit event');
    }
  }

  // -------------------------------------------------------------
  // 1. GET /api/jobs (List with search, filters, pagination, live stats)
  // -------------------------------------------------------------
  server.get(
    '/api/jobs',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const parseResult = JobQueryFiltersSchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: parseResult.error.flatten(),
        });
      }

      const filters = parseResult.data;
      const organizationId = user.organizationId;

      // Base query condition: enforce organization boundary and archive status
      const where: Prisma.JobWhereInput = {
        organizationId,
        ...(filters.includeArchived ? {} : { isArchived: false }),
      };

      // Role-based restrictions:
      // Client role can only view jobs in authorizedJobIds
      if (user.role === UserRole.CLIENT) {
        const authorizedIds = user.clientAccess?.authorizedJobIds || [];
        where.id = { in: authorizedIds };
        // Client only sees ACTIVE or PAUSED jobs (not DRAFT)
        where.status = { not: JobStatus.DRAFT as any };
      }

      // Filter by specific status
      if (filters.status) {
        where.status = filters.status as any;
      }

      // Filter by client
      if (filters.clientId) {
        where.clientId = filters.clientId;
      }

      // Filter by owner
      if (filters.ownerId) {
        where.ownerId = filters.ownerId;
      }

      // Filter by location
      if (filters.location) {
        where.location = { contains: filters.location, mode: 'insensitive' };
      }

      // Multi-predicate search (title, code, client name, recruiter name, location)
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

      // Calculate "Filled This Month" UTC boundaries for Asia/Kolkata
      const { startUtc, endUtc } = getCurrentMonthDateRange('Asia/Kolkata');

      // Execute queries in parallel
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
        // Stats: Open Jobs (ACTIVE status in tenant)
        prisma.job.count({
          where: {
            organizationId,
            status: JobStatus.ACTIVE as any,
            isArchived: false,
          },
        }),
        // Stats: On Hold (PAUSED status in tenant)
        prisma.job.count({
          where: {
            organizationId,
            status: JobStatus.PAUSED as any,
            isArchived: false,
          },
        }),
        // Stats: Filled This Month (Placements created this month OR Job closed with POSITION_FILLED this month)
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

      return reply.send({
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
      });
    }
  );

  // -------------------------------------------------------------
  // 2. GET /api/jobs/:id (Job Record with all details)
  // -------------------------------------------------------------
  server.get(
    '/api/jobs/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
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
        return reply.status(404).send({ success: false, error: 'Job not found' });
      }

      // Check client authorization
      if (user.role === UserRole.CLIENT) {
        const authorizedIds = user.clientAccess?.authorizedJobIds || [];
        if (!authorizedIds.includes(job.id)) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Unauthorized job access' });
        }
      }

      const serialized = serializeJob(job, user.role);
      return reply.send({ success: true, data: serialized });
    }
  );

  // -------------------------------------------------------------
  // 3. POST /api/jobs (Create new Job with sequential code)
  // -------------------------------------------------------------
  server.post(
    '/api/jobs',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient permissions to create jobs' });
      }

      const parseResult = CreateJobInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      // Verify client belongs to organization and is active
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, organizationId: user.organizationId, isArchived: false },
      });
      if (!client) {
        return reply.status(400).send({ success: false, error: 'Invalid or archived client specified' });
      }

      // Generate sequential job code (e.g. J-201 -> J-209)
      const existingJobs = await prisma.job.findMany({
        where: { organizationId: user.organizationId },
        select: { code: true },
      });
      const generatedCode = generateJobCode(existingJobs.map((j) => j.code));

      // Default rounds if none provided
      const defaultRounds = input.initialRounds && input.initialRounds.length > 0
        ? input.initialRounds
        : [
            { name: 'Initial Screening', roundOrder: 1, interviewType: 'VIDEO', durationMinutes: 30, description: 'HR / Recruiter Screening' },
            { name: 'Technical Assessment', roundOrder: 2, interviewType: 'TECHNICAL', durationMinutes: 60, description: 'Coding & Architecture evaluation' },
            { name: 'Hiring Manager Interview', roundOrder: 3, interviewType: 'HIRING_MANAGER', durationMinutes: 45, description: 'Direct manager fit & alignment' },
            { name: 'Culture & Leadership', roundOrder: 4, interviewType: 'CULTURE_FIT', durationMinutes: 45, description: 'Values and team synergy' },
          ];

      const ownerId = input.ownerId || user.id;

      // Create transactionally
      const newJob = await prisma.$transaction(async (tx) => {
        const created = await tx.job.create({
          data: {
            code: generatedCode,
            title: input.title,
            clientId: input.clientId,
            hiringManagerContactId: input.hiringManagerContactId || null,
            ownerId,
            organizationId: user.organizationId,
            openings: input.openings,
            location: input.location || null,
            employmentType: input.employmentType,
            salaryMin: input.salaryMin != null ? new Prisma.Decimal(input.salaryMin) : null,
            salaryMax: input.salaryMax != null ? new Prisma.Decimal(input.salaryMax) : null,
            description: input.description || null,
            requirements: input.requirements || null,
            deadline: input.deadline || null,
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

        // Add assignments if specified
        if (input.assignedRecruiterIds && input.assignedRecruiterIds.length > 0) {
          for (const recId of input.assignedRecruiterIds) {
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
          // Default assign owner
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

      return reply.status(201).send({
        success: true,
        data: serializeJob(newJob, user.role),
      });
    }
  );

  // -------------------------------------------------------------
  // 4. PATCH /api/jobs/:id (Update Job Configuration)
  // -------------------------------------------------------------
  server.patch(
    '/api/jobs/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const existing = await prisma.job.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Job not found' });
      }

      // Check permission
      if (
        user.role === UserRole.RECRUITER &&
        existing.ownerId !== user.id &&
        !(await prisma.jobAssignment.findFirst({ where: { jobId: id, recruiterId: user.id, status: 'ACTIVE' } }))
      ) {
        return reply.status(403).send({ success: false, error: 'Forbidden: You do not have permission to edit this job' });
      }

      const parseResult = UpdateJobInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;
      const updateData: Prisma.JobUpdateInput = {};

      if (input.title !== undefined) updateData.title = input.title;
      if (input.hiringManagerContactId !== undefined) {
        updateData.hiringManagerContact = input.hiringManagerContactId
          ? { connect: { id: input.hiringManagerContactId } }
          : { disconnect: true };
      }
      if (input.ownerId !== undefined && (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER)) {
        updateData.owner = input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true };
      }
      if (input.openings !== undefined) updateData.openings = input.openings;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.employmentType !== undefined) updateData.employmentType = input.employmentType;
      if (input.salaryMin !== undefined) {
        updateData.salaryMin = input.salaryMin != null ? new Prisma.Decimal(input.salaryMin) : null;
      }
      if (input.salaryMax !== undefined) {
        updateData.salaryMax = input.salaryMax != null ? new Prisma.Decimal(input.salaryMax) : null;
      }
      if (input.description !== undefined) updateData.description = input.description;
      if (input.requirements !== undefined) updateData.requirements = input.requirements;
      if (input.deadline !== undefined) updateData.deadline = input.deadline;

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

      return reply.send({ success: true, data: serializeJob(updated, user.role) });
    }
  );

  // Helper: Perform Job Status Transition with validation, atomic transaction, history, and audit
  async function performStatusTransition(
    id: string,
    targetStatus: JobStatus,
    user: any,
    options?: { reason?: string; closingNote?: string; note?: string }
  ): Promise<{ status: number; error?: string; data?: any }> {
    const job = await prisma.job.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!job) {
      return { status: 404, error: 'Job not found' };
    }

    // Check security policy for requireJobApproval
    const securityPolicy = await prisma.securityPolicy.findUnique({
      where: { organizationId: user.organizationId },
    });
    const requireJobApproval = securityPolicy?.requireJobApproval ?? false;
    const transitionResult = isValidJobStatusTransition(
      job.status as JobStatus,
      targetStatus,
      requireJobApproval
    );

    if (!transitionResult.valid) {
      return {
        status: 409,
        error: `Invalid status transition: ${transitionResult.reason}`,
      };
    }

    // Role check for specific transitions
    if (user.role === UserRole.RECRUITER && (targetStatus === JobStatus.CLOSED || targetStatus === JobStatus.ACTIVE)) {
      const isAssigned = await prisma.jobAssignment.findFirst({
        where: { jobId: id, recruiterId: user.id, status: 'ACTIVE' },
      });
      if (job.ownerId !== user.id && !isAssigned) {
        return { status: 403, error: 'Forbidden: Not authorized to transition this job' };
      }
    }

    const { reason, closingNote, note } = options || {};

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

    return { status: 200, data: serializeJob(updatedJob, user.role) };
  }

  // -------------------------------------------------------------
  // 5. POST /api/jobs/:id/transition (Job Status State Machine)
  // -------------------------------------------------------------
  server.post(
    '/api/jobs/:id/transition',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const parseResult = TransitionJobStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid transition payload',
          details: parseResult.error.flatten(),
        });
      }

      const { targetStatus, reason, closingNote, note } = parseResult.data;
      const result = await performStatusTransition(id, targetStatus, user, { reason, closingNote, note });
      if (result.error) {
        return reply.status(result.status).send({ success: false, error: result.error });
      }
      return reply.status(result.status).send({ success: true, data: result.data });
    }
  );

  // -------------------------------------------------------------
  // 6. CONVENIENCE TRANSITION ENDPOINTS
  // -------------------------------------------------------------
  server.post('/api/jobs/:id/activate', { preHandler: [(server as any).authenticate] }, async (req, rep) => {
    const result = await performStatusTransition((req.params as any).id, JobStatus.ACTIVE, req.user, { reason: 'ACTIVATED' });
    return rep.status(result.status).send(result.error ? { success: false, error: result.error } : { success: true, data: result.data });
  });

  server.post('/api/jobs/:id/submit-for-approval', { preHandler: [(server as any).authenticate] }, async (req, rep) => {
    const body = (req.body as any) || {};
    const result = await performStatusTransition((req.params as any).id, JobStatus.PENDING_APPROVAL, req.user, {
      reason: body.reason || 'SUBMITTED_FOR_APPROVAL',
      note: body.note,
    });
    return rep.status(result.status).send(result.error ? { success: false, error: result.error } : { success: true, data: result.data });
  });

  server.post('/api/jobs/:id/pause', { preHandler: [(server as any).authenticate] }, async (req, rep) => {
    const body = (req.body as any) || {};
    const result = await performStatusTransition((req.params as any).id, JobStatus.PAUSED, req.user, {
      reason: body.reason || 'CLIENT_HOLD',
      note: body.note,
    });
    return rep.status(result.status).send(result.error ? { success: false, error: result.error } : { success: true, data: result.data });
  });

  server.post('/api/jobs/:id/resume', { preHandler: [(server as any).authenticate] }, async (req, rep) => {
    const body = (req.body as any) || {};
    const result = await performStatusTransition((req.params as any).id, JobStatus.ACTIVE, req.user, {
      reason: body.reason || 'RESUMED',
      note: body.note,
    });
    return rep.status(result.status).send(result.error ? { success: false, error: result.error } : { success: true, data: result.data });
  });

  server.post('/api/jobs/:id/close', { preHandler: [(server as any).authenticate] }, async (req, rep) => {
    const body = (req.body as any) || {};
    const result = await performStatusTransition((req.params as any).id, JobStatus.CLOSED, req.user, {
      reason: body.closingReason || 'POSITION_FILLED',
      closingNote: body.closingNote,
      note: body.note,
    });
    return rep.status(result.status).send(result.error ? { success: false, error: result.error } : { success: true, data: result.data });
  });

  server.post('/api/jobs/:id/reopen', { preHandler: [(server as any).authenticate] }, async (req, rep) => {
    const body = (req.body as any) || {};
    const result = await performStatusTransition((req.params as any).id, JobStatus.ACTIVE, req.user, {
      reason: body.reason || 'REOPENED',
      note: body.note,
    });
    return rep.status(result.status).send(result.error ? { success: false, error: result.error } : { success: true, data: result.data });
  });

  // -------------------------------------------------------------
  // 7. INTERVIEW ROUNDS CONFIGURATION
  // -------------------------------------------------------------
  server.get(
    '/api/jobs/:id/rounds',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      const rounds = await prisma.jobRound.findMany({
        where: { jobId: id, isArchived: false },
        orderBy: { roundOrder: 'asc' },
      });

      return reply.send({ success: true, data: rounds });
    }
  );

  server.post(
    '/api/jobs/:id/rounds',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = CreateJobRoundSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid round data',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      // Find max existing roundOrder
      const existingRounds = await prisma.jobRound.findMany({
        where: { jobId: id, isArchived: false },
        select: { roundOrder: true },
      });
      const maxOrder = existingRounds.reduce((max, r) => Math.max(max, r.roundOrder), 0);
      const nextOrder = input.roundOrder || maxOrder + 1;

      const round = await prisma.jobRound.create({
        data: {
          jobId: id,
          name: input.name,
          roundOrder: nextOrder,
          interviewType: input.interviewType,
          durationMinutes: input.durationMinutes,
          panelMembers: input.panelMembers,
          description: input.description || null,
          createdById: user.id,
        },
      });

      await logJobEvent(user.id, 'job.add_round', id, null, { roundId: round.id, name: round.name });

      return reply.status(201).send({ success: true, data: round });
    }
  );

  server.patch(
    '/api/jobs/:id/rounds/:roundId',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id, roundId } = request.params as { id: string; roundId: string };

      if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = UpdateJobRoundSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid round update',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;
      const updated = await prisma.jobRound.update({
        where: { id: roundId, jobId: id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.interviewType ? { interviewType: input.interviewType } : {}),
          ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
          ...(input.panelMembers ? { panelMembers: input.panelMembers } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });

      await logJobEvent(user.id, 'job.update_round', id, null, { roundId, name: updated.name });

      return reply.send({ success: true, data: updated });
    }
  );

  server.post(
    '/api/jobs/:id/rounds/reorder',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = ReorderJobRoundsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid reorder payload',
          details: parseResult.error.flatten(),
        });
      }

      const { roundIds } = parseResult.data;

      // Update round orders sequentially in a transaction
      await prisma.$transaction(
        roundIds.map((roundId, index) =>
          prisma.jobRound.update({
            where: { id: roundId, jobId: id },
            data: { roundOrder: index + 1 },
          })
        )
      );

      await logJobEvent(user.id, 'job.reorder_rounds', id, null, { roundIds });

      const updatedRounds = await prisma.jobRound.findMany({
        where: { jobId: id, isArchived: false },
        orderBy: { roundOrder: 'asc' },
      });

      return reply.send({ success: true, data: updatedRounds });
    }
  );

  // Safe round deactivation (Preserves past interview links!)
  server.delete(
    '/api/jobs/:id/rounds/:roundId',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id, roundId } = request.params as { id: string; roundId: string };

      if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const archived = await prisma.jobRound.update({
        where: { id: roundId, jobId: id },
        data: { isArchived: true },
      });

      await logJobEvent(user.id, 'job.archive_round', id, null, { roundId, name: archived.name });

      return reply.send({
        success: true,
        message: 'Round safely deactivated without affecting historical interviews',
      });
    }
  );

  // -------------------------------------------------------------
  // 8. JOB RECRUITER ASSIGNMENTS & REASSIGNMENT REQUESTS
  // -------------------------------------------------------------
  server.post(
    '/api/jobs/:id/assignments',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Only Managers and Admins can assign recruiters' });
      }

      const { recruiterId } = request.body as { recruiterId: string };
      if (!recruiterId) {
        return reply.status(400).send({ success: false, error: 'recruiterId is required' });
      }

      const assignment = await prisma.jobAssignment.upsert({
        where: { jobId_recruiterId: { jobId: id, recruiterId } },
        create: {
          jobId: id,
          recruiterId,
          assignedById: user.id,
          status: 'ACTIVE',
          createdById: user.id,
        },
        update: {
          status: 'ACTIVE',
          assignedById: user.id,
        },
        include: {
          recruiter: { select: { id: true, name: true, email: true } },
        },
      });

      await logJobEvent(user.id, 'job.assign_recruiter', id, null, { recruiterId });

      return reply.status(201).send({ success: true, data: assignment });
    }
  );

  server.delete(
    '/api/jobs/:id/assignments/:recruiterId',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id, recruiterId } = request.params as { id: string; recruiterId: string };

      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Only Managers and Admins can unassign recruiters' });
      }

      await prisma.jobAssignment.updateMany({
        where: { jobId: id, recruiterId },
        data: { status: 'INACTIVE' },
      });

      await logJobEvent(user.id, 'job.unassign_recruiter', id, null, { recruiterId });

      return reply.send({ success: true, message: 'Recruiter unassigned successfully' });
    }
  );

  server.post(
    '/api/jobs/:id/reassignment-requests',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = CreateReassignmentRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid reassignment request',
          details: parseResult.error.flatten(),
        });
      }

      const { targetRecruiterId, reason } = parseResult.data;

      const newRequest = await prisma.jobReassignmentRequest.create({
        data: {
          jobId: id,
          requestingRecruiterId: user.id,
          targetRecruiterId: targetRecruiterId || null,
          reason,
          status: 'PENDING',
          createdById: user.id,
        },
        include: {
          requestingRecruiter: { select: { id: true, name: true } },
          targetRecruiter: { select: { id: true, name: true } },
        },
      });

      await logJobEvent(user.id, 'job.reassignment_requested', id, null, {
        requestId: newRequest.id,
        reason,
      });

      return reply.status(201).send({ success: true, data: newRequest });
    }
  );

  server.patch(
    '/api/jobs/:id/reassignment-requests/:requestId',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id, requestId } = request.params as { id: string; requestId: string };

      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Only Managers and Admins can review reassignment requests' });
      }

      const parseResult = ReviewReassignmentRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid review payload',
          details: parseResult.error.flatten(),
        });
      }

      const { status, reviewNotes } = parseResult.data;

      const reqRecord = await prisma.jobReassignmentRequest.findFirst({
        where: { id: requestId, jobId: id },
      });
      if (!reqRecord) {
        return reply.status(404).send({ success: false, error: 'Reassignment request not found' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const reviewed = await tx.jobReassignmentRequest.update({
          where: { id: requestId },
          data: {
            status,
            reviewedById: user.id,
            reviewedAt: new Date(),
            reviewNotes: reviewNotes || null,
          },
        });

        // If approved and a target recruiter was specified, reassign owner/assignment
        if (status === 'APPROVED' && reqRecord.targetRecruiterId) {
          await tx.job.update({
            where: { id },
            data: { ownerId: reqRecord.targetRecruiterId },
          });

          await tx.jobAssignment.upsert({
            where: {
              jobId_recruiterId: { jobId: id, recruiterId: reqRecord.targetRecruiterId },
            },
            create: {
              jobId: id,
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

        return reviewed;
      });

      await logJobEvent(user.id, `job.reassignment_${status.toLowerCase()}`, id, null, {
        requestId,
        status,
        reviewNotes,
      });

      return reply.send({ success: true, data: updated });
    }
  );

};
