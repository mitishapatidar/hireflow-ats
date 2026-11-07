import { FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  JobStatus,
  ApplicationStatus,
  canTransitionApplicationStage,
  TransitionApplicationStageSchema,
  RejectApplicationSchema,
  AddCandidateToJobSchema,
  CreateApplicationNoteSchema,
  PipelineColumnQuerySchema,
  serializePipelineCard,
  getStorageProvider,
} from '@hireflow/shared';

export const pipelineRoutes: FastifyPluginAsync = async (server) => {
  // Helper: Structured audit logging
  async function logPipelineEvent(
    actorId: string,
    action: string,
    entity: 'application' | 'candidate_note',
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
      server.log.error(err, 'Failed to log pipeline audit event');
    }
  }

  // Helper: Verify job access permission
  async function verifyJobAccess(jobId: string, user: any) {
    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { allowed: false, status: 403, error: 'Access denied: Pipeline board is restricted to internal recruitment team.' };
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: true,
        owner: true,
        assignments: true,
      },
    });

    if (!job || job.organizationId !== user.organizationId) {
      return { allowed: false, status: 404, error: 'Job not found in your organization.' };
    }

    // Role checks
    if (user.role === UserRole.RECRUITER) {
      const isOwner = job.ownerId === user.id;
      const isAssigned = job.assignments.some((a) => a.recruiterId === user.id);
      if (!isOwner && !isAssigned) {
        return {
          allowed: false,
          status: 403,
          error: 'Access denied: You are not assigned to this job mandate.',
        };
      }
    }

    return { allowed: true, job };
  }

  // -------------------------------------------------------------
  // 1. GET /api/jobs/:jobId/pipeline (Board Initialization)
  // -------------------------------------------------------------
  server.get(
    '/api/jobs/:jobId/pipeline',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { jobId } = request.params as { jobId: string };
      const access = await verifyJobAccess(jobId, user);
      if (!access.allowed || !access.job) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }
      const job = access.job;

      // 1. Resolve client custom stages if published workflow exists; otherwise default organization stages
      let resolvedStages: Array<{
        id: string;
        name: string;
        stageType: string;
        order: number;
        isArchived: boolean;
        colorHex?: string;
        isProtected?: boolean;
      }> = [];

      if (job.clientId) {
        const publishedWorkflow = await prisma.clientWorkflow.findFirst({
          where: { clientId: job.clientId, status: 'PUBLISHED' },
          include: {
            stages: { where: { isArchived: false, isActive: true }, orderBy: { order: 'asc' } },
          },
          orderBy: { version: 'desc' },
        });

        if (publishedWorkflow && publishedWorkflow.stages.length > 0) {
          resolvedStages = publishedWorkflow.stages.map((cs) => ({
            id: cs.id,
            name: cs.name,
            stageType: cs.stageType,
            order: cs.order,
            isArchived: cs.isArchived,
            colorHex: (cs.configuration as any)?.colorHex || '#4A5568',
            isProtected: cs.stageType === 'HIRED' || cs.stageType === 'PLACED' || cs.name.toLowerCase() === 'placed' || cs.name.toLowerCase() === 'joined',
          }));
        }
      }

      if (resolvedStages.length === 0) {
        const defaultStages = await prisma.stage.findMany({
          where: {
            organizationId: user.organizationId,
            isArchived: false,
          },
          orderBy: { order: 'asc' },
        });
        resolvedStages = defaultStages.map((st) => ({
          id: st.id,
          name: st.name,
          stageType: st.stageType,
          order: st.order,
          isArchived: st.isArchived,
          colorHex: '#4A5568',
          isProtected: st.stageType === 'PLACED' || st.name.toLowerCase() === 'placed',
        }));
      }

      // 2. Fetch cards & total counts per stage
      const columns: Record<string, any> = {};

      for (const st of resolvedStages) {
        const stageCondition: any = {
          jobId,
          OR: [
            { stageId: st.id },
            { stage: { name: st.name } },
            { stage: { stageType: st.stageType as any } },
            { status: st.stageType as any },
          ],
        };

        const [applications, count] = await Promise.all([
          prisma.application.findMany({
            where: stageCondition,
            include: {
              candidate: {
                include: {
                  owner: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 20,
          }),
          prisma.application.count({ where: stageCondition }),
        ]);

        const cards = applications.map((app) => serializePipelineCard(app, user.role));
        const hasMore = count > cards.length;
        const nextCursor = hasMore && applications.length > 0 ? applications[applications.length - 1].id : undefined;

        columns[st.id] = {
          stage: {
            id: st.id,
            name: st.name,
            stageType: st.stageType,
            order: st.order,
            isArchived: st.isArchived,
            colorHex: st.colorHex,
            isProtected: st.isProtected,
          },
          totalCount: count,
          cards,
          hasMore,
          nextCursor,
        };
      }

      const totalApplications = Object.values(columns).reduce(
        (acc: number, col: any) => acc + (col.totalCount || 0),
        0
      );
      const countsMap: Record<string, number> = {};
      for (const st of resolvedStages) {
        countsMap[st.id] = columns[st.id]?.totalCount || 0;
      }

      return reply.send({
        success: true,
        data: {
          job: {
            id: job.id,
            code: job.code,
            title: job.title,
            clientId: job.clientId,
            clientName: job.client.legalName,
            status: job.status,
            ownerId: job.ownerId,
            ownerName: job.owner?.name || null,
            openings: job.openings,
            totalApplications,
          },
          stages: resolvedStages.map((st: any) => ({
            id: st.id,
            name: st.name,
            stageType: st.stageType,
            order: st.order,
          })),
          counts: countsMap,
          columns,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 2. GET /api/jobs/:jobId/pipeline/columns/:stageId (Per-Column Pagination)
  // -------------------------------------------------------------
  server.get(
    '/api/jobs/:jobId/pipeline/columns/:stageId',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { jobId, stageId } = request.params as { jobId: string; stageId: string };
      const access = await verifyJobAccess(jobId, user);
      if (!access.allowed) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const queryResult = PipelineColumnQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        return reply.status(400).send({ success: false, error: 'Invalid query parameters' });
      }
      const { cursor, limit } = queryResult.data;

      const totalCount = await prisma.application.count({
        where: { jobId, stageId },
      });

      const findOptions: Prisma.ApplicationFindManyArgs = {
        where: { jobId, stageId },
        include: {
          candidate: {
            include: {
              owner: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      };

      if (cursor) {
        findOptions.cursor = { id: cursor };
        findOptions.skip = 1;
      }

      const applications = await prisma.application.findMany(findOptions);
      const hasMore = applications.length > limit;
      const returnedApps = hasMore ? applications.slice(0, limit) : applications;
      const nextCursor = hasMore && returnedApps.length > 0 ? returnedApps[returnedApps.length - 1].id : undefined;

      const cards = returnedApps.map((app) => serializePipelineCard(app, user.role));

      return reply.send({
        success: true,
        data: {
          stageId,
          totalCount,
          cards,
          hasMore,
          nextCursor,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 3. GET /api/jobs/:jobId/pipeline/counts (Totals Strip)
  // -------------------------------------------------------------
  server.get(
    '/api/jobs/:jobId/pipeline/counts',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { jobId } = request.params as { jobId: string };
      const access = await verifyJobAccess(jobId, user);
      if (!access.allowed) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const stageCountsRaw = await prisma.application.groupBy({
        by: ['stageId'],
        where: { jobId },
        _count: { id: true },
      });

      const countsMap: Record<string, number> = {};
      let totalApplications = 0;
      stageCountsRaw.forEach((sc) => {
        if (sc.stageId) {
          countsMap[sc.stageId] = sc._count.id;
          totalApplications += sc._count.id;
        }
      });

      return reply.send({
        success: true,
        data: {
          counts: countsMap,
          totalApplications,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 4. POST /api/jobs/:jobId/applications (Add Candidate to Job)
  // -------------------------------------------------------------
  server.post(
    '/api/jobs/:jobId/applications',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { jobId } = request.params as { jobId: string };
      const access = await verifyJobAccess(jobId, user);
      if (!access.allowed || !access.job) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }
      const job = access.job;

      // Lifecycle Guard: Paused or closed jobs cannot receive applications
      if (job.status === JobStatus.PAUSED || job.status === JobStatus.CLOSED) {
        return reply.status(409).send({
          success: false,
          error: `Job mandate is currently ${job.status} and cannot accept new candidate submissions. New applications are strictly blocked.`,
        });
      }

      const parseResult = AddCandidateToJobSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }
      const { candidateId, initialStageId } = parseResult.data;

      // Verify candidate exists and belongs to organization
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
      });
      if (!candidate || candidate.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Candidate record not found.' });
      }

      // Concurrency-safe duplicate application check
      const existingApp = await prisma.application.findUnique({
        where: {
          candidateId_jobId: {
            candidateId,
            jobId,
          },
        },
        include: {
          stage: true,
        },
      });

      if (existingApp) {
        return reply.status(409).send({
          success: false,
          error: `Candidate is already in the pipeline for this job (Current Stage: ${existingApp.stage?.name || existingApp.status}). Duplicate applications are prohibited.`,
          code: 'DUPLICATE_APPLICATION',
          existingApplicationId: existingApp.id,
        });
      }

      // Determine initial stage
      let stage: any = null;
      if (initialStageId) {
        stage = await prisma.stage.findFirst({
          where: { id: initialStageId, organizationId: user.organizationId, isArchived: false },
        });
      }
      if (!stage) {
        // Fallback to order 1 stage
        stage = await prisma.stage.findFirst({
          where: { organizationId: user.organizationId, isArchived: false },
          orderBy: { order: 'asc' },
        });
      }

      if (!stage) {
        return reply.status(500).send({ success: false, error: 'No active pipeline stages configured.' });
      }

      // Create application in transaction
      const newApp = await prisma.$transaction(async (tx) => {
        const app = await tx.application.create({
          data: {
            candidateId,
            jobId,
            stageId: stage.id,
            status: stage.stageType,
            createdById: user.id,
          },
          include: {
            candidate: {
              include: {
                owner: { select: { id: true, name: true } },
              },
            },
            stage: true,
          },
        });

        // Stage history initial entry
        await tx.applicationStageHistory.create({
          data: {
            applicationId: app.id,
            fromStage: null,
            toStage: stage.name,
            changedById: user.id,
            comments: 'Candidate added to job pipeline.',
            createdById: user.id,
          },
        });

        return app;
      });

      await logPipelineEvent(
        user.id,
        'APPLICATION_CREATED',
        'application',
        newApp.id,
        null,
        {
          jobId,
          candidateId,
          stage: stage.name,
        },
        request.ip
      );

      return reply.status(201).send({
        success: true,
        data: serializePipelineCard(newApp, user.role),
      });
    }
  );

  // -------------------------------------------------------------
  // 5. POST /api/applications/:applicationId/stage (Stage Transition Engine)
  // -------------------------------------------------------------
  server.post(
    '/api/applications/:applicationId/stage',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { applicationId } = request.params as { applicationId: string };
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            include: {
              assignments: true,
            },
          },
          stage: true,
          candidate: true,
        },
      });

      if (!app || app.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Application not found.' });
      }

      // Role authorization
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      if (user.role === UserRole.RECRUITER) {
        const isOwner = app.job.ownerId === user.id;
        const isAssigned = app.job.assignments.some((a) => a.recruiterId === user.id);
        if (!isOwner && !isAssigned) {
          return reply.status(403).send({
            success: false,
            error: 'Access denied: You are not assigned to manage this job pipeline.',
          });
        }
      }

      const parseResult = TransitionApplicationStageSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }
      const { targetStageId, comments, rejectionReasonId, rejectionFeedback } = parseResult.data;

      // Fetch target stage
      const targetStage = await prisma.stage.findFirst({
        where: {
          id: targetStageId,
          organizationId: user.organizationId,
          isArchived: false,
        },
      });

      if (!targetStage) {
        return reply.status(404).send({ success: false, error: 'Target stage does not exist or is archived.' });
      }

      // State machine validation
      const validation = canTransitionApplicationStage(
        app.status as unknown as ApplicationStatus,
        targetStage.stageType as unknown as ApplicationStatus,
        app.job.status as any
      );
      if (!validation.allowed) {
        return reply.status(409).send({
          success: false,
          error: validation.reason || 'Invalid stage transition.',
        });
      }

      // If target stage is REJECTED, enforce mandatory rejection reason
      const isRejection = targetStage.stageType === ApplicationStatus.REJECTED;
      if (isRejection) {
        if (!rejectionReasonId) {
          return reply.status(400).send({
            success: false,
            error: 'A valid rejection reason is mandatory when rejecting a candidate.',
          });
        }
        if (!rejectionFeedback || rejectionFeedback.trim().length < 3) {
          return reply.status(400).send({
            success: false,
            error: 'Internal feedback is mandatory when rejecting a candidate (minimum 3 characters).',
          });
        }
      }

      // Atomic transition execution
      const updatedApp = await prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
          where: { id: applicationId },
          data: {
            stageId: targetStage.id,
            status: targetStage.stageType,
            rejectionReasonId: isRejection ? rejectionReasonId : null,
            rejectionFeedback: isRejection ? rejectionFeedback : null,
            rejectedAt: isRejection ? new Date() : null,
          },
          include: {
            candidate: {
              include: {
                owner: { select: { id: true, name: true } },
              },
            },
            stage: true,
          },
        });

        // Stage history audit entry
        await tx.applicationStageHistory.create({
          data: {
            applicationId,
            fromStage: app.stage?.name || app.status,
            toStage: targetStage.name,
            changedById: user.id,
            comments: comments || (isRejection ? rejectionFeedback : `Moved to ${targetStage.name}`),
            createdById: user.id,
          },
        });

        return updated;
      });

      await logPipelineEvent(
        user.id,
        isRejection ? 'APPLICATION_REJECTED' : 'APPLICATION_STAGE_CHANGED',
        'application',
        applicationId,
        {
          stageId: app.stageId,
          stageName: app.stage?.name || app.status,
          status: app.status,
        },
        {
          stageId: targetStage.id,
          stageName: targetStage.name,
          status: targetStage.stageType,
          rejectionReasonId: isRejection ? rejectionReasonId : undefined,
        },
        request.ip
      );

      return reply.send({
        success: true,
        data: serializePipelineCard(updatedApp, user.role),
      });
    }
  );

  // -------------------------------------------------------------
  // 6. POST /api/applications/:applicationId/reject (Dedicated Rejection)
  // -------------------------------------------------------------
  server.post(
    '/api/applications/:applicationId/reject',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { applicationId } = request.params as { applicationId: string };
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: { include: { assignments: true } },
          stage: true,
        },
      });

      if (!app || app.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Application not found.' });
      }

      // Role check
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }
      if (user.role === UserRole.RECRUITER) {
        const isOwner = app.job.ownerId === user.id;
        const isAssigned = app.job.assignments.some((a) => a.recruiterId === user.id);
        if (!isOwner && !isAssigned) {
          return reply.status(403).send({ success: false, error: 'Access denied' });
        }
      }

      // Lifecycle check
      if (app.job.status === JobStatus.PAUSED || app.job.status === JobStatus.CLOSED) {
        return reply.status(409).send({
          success: false,
          error: `Job mandate is ${app.job.status}. Candidate status cannot be changed.`,
        });
      }

      const parseResult = RejectApplicationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }
      const { rejectionReasonId, rejectionFeedback } = parseResult.data;

      // Verify rejection reason exists
      const reason = await prisma.rejectionReason.findUnique({
        where: { code: rejectionReasonId },
      });
      if (!reason && !(await prisma.rejectionReason.findUnique({ where: { id: rejectionReasonId } }))) {
        return reply.status(400).send({ success: false, error: 'Invalid rejection reason selected.' });
      }

      // Find Rejected stage
      const rejectedStage = await prisma.stage.findFirst({
        where: {
          organizationId: user.organizationId,
          stageType: ApplicationStatus.REJECTED,
          isArchived: false,
        },
      });

      if (!rejectedStage) {
        return reply.status(500).send({ success: false, error: 'Rejected stage is not configured in organization.' });
      }

      // Execute rejection transaction
      const updatedApp = await prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
          where: { id: applicationId },
          data: {
            stageId: rejectedStage.id,
            status: ApplicationStatus.REJECTED,
            rejectionReasonId: reason ? reason.id : rejectionReasonId,
            rejectionFeedback,
            rejectedAt: new Date(),
          },
          include: {
            candidate: {
              include: {
                owner: { select: { id: true, name: true } },
              },
            },
            stage: true,
          },
        });

        await tx.applicationStageHistory.create({
          data: {
            applicationId,
            fromStage: app.stage?.name || app.status,
            toStage: rejectedStage.name,
            changedById: user.id,
            comments: `Rejection: ${reason?.reason || rejectionReasonId}. Feedback: ${rejectionFeedback}`,
            createdById: user.id,
          },
        });

        return updated;
      });

      await logPipelineEvent(
        user.id,
        'APPLICATION_REJECTED',
        'application',
        applicationId,
        { status: app.status, stageId: app.stageId },
        { status: ApplicationStatus.REJECTED, reason: reason?.reason, feedback: rejectionFeedback },
        request.ip
      );

      return reply.send({
        success: true,
        data: serializePipelineCard(updatedApp, user.role),
      });
    }
  );

  // -------------------------------------------------------------
  // 7. GET /api/applications/:applicationId/drawer (Candidate Drawer Data)
  // -------------------------------------------------------------
  server.get(
    '/api/applications/:applicationId/drawer',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { applicationId } = request.params as { applicationId: string };
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            include: {
              client: true,
              assignments: true,
            },
          },
          stage: true,
          rejectionReason: true,
          candidate: {
            include: {
              owner: { select: { id: true, name: true, email: true } },
              documents: {
                orderBy: { uploadedAt: 'desc' },
                take: 5,
              },
              notes: {
                orderBy: { createdAt: 'desc' },
                take: 20,
              },
            },
          },
          stageHistories: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!app || app.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Application not found.' });
      }

      // Authorization guard
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      // Resolve resume download URL if document exists
      const resumeDoc = app.candidate.documents.find((d) => d.documentType === 'RESUME') || app.candidate.documents[0];
      let resumeSignedUrl: string | null = null;
      if (resumeDoc) {
        try {
          const storage = getStorageProvider();
          resumeSignedUrl = await storage.getSignedUrl(resumeDoc.fileUrl, 3600);
        } catch {
          resumeSignedUrl = null;
        }
      }

      // Fetch user names for stage histories
      const changerIds = Array.from(new Set(app.stageHistories.map((h) => h.changedById)));
      const users = await prisma.user.findMany({
        where: { id: { in: changerIds } },
        select: { id: true, name: true, role: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.name]));

      // Fetch note author names
      const noteAuthorIds = Array.from(new Set(app.candidate.notes.map((n) => n.authorId)));
      const noteAuthors = await prisma.user.findMany({
        where: { id: { in: noteAuthorIds } },
        select: { id: true, name: true },
      });
      const noteAuthorMap = new Map(noteAuthors.map((u) => [u.id, u.name]));

      return reply.send({
        success: true,
        data: {
          applicationId: app.id,
          candidate: {
            id: app.candidate.id,
            code: app.candidate.code,
            name: app.candidate.name,
            email: app.candidate.email,
            phone: app.candidate.phone,
            currentTitle: app.candidate.currentTitle,
            currentCompany: app.candidate.currentCompany,
            experienceYears: app.candidate.experienceYears != null ? Number(app.candidate.experienceYears) : null,
            expectedSalary: app.candidate.expectedSalary ? `₹${(Number(app.candidate.expectedSalary) / 100000).toFixed(1)} LPA` : null,
            currentSalary: app.candidate.currentSalary ? `₹${(Number(app.candidate.currentSalary) / 100000).toFixed(1)} LPA` : null,
            location: app.candidate.location,
            skills: app.candidate.skills,
            ownerName: app.candidate.owner?.name || null,
          },
          job: {
            id: app.job.id,
            code: app.job.code,
            title: app.job.title,
            clientName: app.job.client.legalName,
            status: app.job.status,
          },
          stage: {
            id: app.stage?.id || app.stageId,
            name: app.stage?.name || app.status,
            stageType: app.status,
          },
          rejection: app.status === ApplicationStatus.REJECTED ? {
            reason: app.rejectionReason?.reason || null,
            category: app.rejectionReason?.category || null,
            feedback: app.rejectionFeedback || null,
            rejectedAt: app.rejectedAt ? app.rejectedAt.toISOString() : null,
          } : null,
          resume: resumeDoc ? {
            fileName: resumeDoc.fileName,
            downloadUrl: resumeSignedUrl,
            uploadedAt: resumeDoc.uploadedAt.toISOString(),
          } : null,
          notes: app.candidate.notes.map((n) => ({
            id: n.id,
            content: n.content,
            authorName: noteAuthorMap.get(n.authorId) || 'Recruiter',
            createdAt: n.createdAt.toISOString(),
            isInternalOnly: n.isInternalOnly,
          })),
          activity: app.stageHistories.map((h) => ({
            id: h.id,
            fromStage: h.fromStage,
            toStage: h.toStage,
            changedByName: userMap.get(h.changedById) || 'Recruiter',
            comments: h.comments,
            createdAt: h.createdAt.toISOString(),
          })),
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 8. POST /api/applications/:applicationId/notes (Add Candidate Note)
  // -------------------------------------------------------------
  server.post(
    '/api/applications/:applicationId/notes',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Internal team only.' });
      }

      const { applicationId } = request.params as { applicationId: string };
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { id: true, candidateId: true, job: { select: { organizationId: true } } },
      });

      if (!app || app.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Application not found.' });
      }

      const parseResult = CreateApplicationNoteSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }
      const { content } = parseResult.data;

      const note = await prisma.candidateNote.create({
        data: {
          candidateId: app.candidateId,
          authorId: user.id,
          content,
          isInternalOnly: true,
          createdById: user.id,
        },
      });

      await logPipelineEvent(
        user.id,
        'CANDIDATE_NOTE_CREATED',
        'candidate_note',
        note.id,
        null,
        { applicationId, candidateId: app.candidateId },
        request.ip
      );

      return reply.status(201).send({
        success: true,
        data: {
          id: note.id,
          content: note.content,
          authorName: user.name || 'Recruiter',
          createdAt: note.createdAt.toISOString(),
          isInternalOnly: true,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 9. GET /api/pipeline/rejection-reasons (List Rejection Reasons)
  // -------------------------------------------------------------
  server.get(
    '/api/pipeline/rejection-reasons',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const reasons = await prisma.rejectionReason.findMany({
        where: { isArchived: false },
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      });

      return reply.send({
        success: true,
        data: reasons.map((r) => ({
          id: r.id,
          code: r.code,
          reason: r.reason,
          category: r.category,
        })),
      });
    }
  );

  // -------------------------------------------------------------
  // 10. GET /api/candidates/search-available (Search Candidates for Job)
  // -------------------------------------------------------------
  server.get(
    '/api/candidates/search-available',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const { jobId, q } = request.query as { jobId: string; q?: string };
      if (!jobId) {
        return reply.status(400).send({ success: false, error: 'jobId is required' });
      }

      // Existing candidate IDs already in this job
      const existingApps = await prisma.application.findMany({
        where: { jobId },
        select: { candidateId: true },
      });
      const appliedCandidateIds = existingApps.map((a) => a.candidateId);

      const where: Prisma.CandidateWhereInput = {
        organizationId: user.organizationId,
        isArchived: false,
        id: { notIn: appliedCandidateIds },
      };

      if (q && q.trim()) {
        const query = q.trim();
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { currentTitle: { contains: query, mode: 'insensitive' } },
          { skills: { has: query } },
        ];
      }

      const candidates = await prisma.candidate.findMany({
        where,
        take: 20,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          currentTitle: true,
          experienceYears: true,
          location: true,
          skills: true,
        },
      });

      return reply.send({
        success: true,
        data: candidates.map((c) => ({
          ...c,
          experienceYears: c.experienceYears != null ? Number(c.experienceYears) : null,
        })),
      });
    }
  );
};
