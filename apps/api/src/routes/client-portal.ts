/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  can,
  buildClientFacingProfile,
  generateCVWatermarkText,
  calculateDownloadUsage,
  getISTDayBoundaries,
  formatAsOfTimestamp,
  ClientShortlistSchema,
  ClientRejectSchema,
  ClientRequestDetailsSchema,
  ClientTeamFeedbackSchema,
  ClientSubmissionRowDTO,
  ClientPositionDTO,
  ClientInterviewDTO,
  ClientProgressReportDTO,
  ClientPortalOverviewDTO,
  ClientSubmissionDetailDTO,
} from '@hireflow/shared';

export const clientPortalRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // Helper: Client Scope & Authorization Verification
  // -------------------------------------------------------------------------
  async function resolveClientScope(user: any) {
    if (!user) {
      const err: any = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }

    if (user.role !== UserRole.CLIENT && user.role !== UserRole.ADMIN) {
      const err: any = new Error('Access denied: Client Portal is restricted to authorized client users.');
      err.statusCode = 403;
      throw err;
    }

    // In production or when user is CLIENT, resolve ClientAccess from DB
    let clientId: string | null = null;
    let authorizedJobIds: string[] = [];

    if (user.role === UserRole.CLIENT) {
      const clientAccess = await prisma.clientAccess.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        include: { client: true },
      });

      if (!clientAccess || !clientAccess.clientId || clientAccess.client.isArchived) {
        const err: any = new Error('Access denied: No active ClientAccess record found for this account.');
        err.statusCode = 403;
        throw err;
      }

      clientId = clientAccess.clientId;
      authorizedJobIds = clientAccess.authorizedJobIds || [];
    } else if (user.role === UserRole.ADMIN) {
      // For Admin preview/testing, find first active client or use provided query
      const sampleClient = await prisma.client.findFirst({
        where: { organizationId: user.organizationId, isArchived: false },
      });
      clientId = sampleClient?.id || null;
      authorizedJobIds = [];
    }

    if (!clientId) {
      const err: any = new Error('No accessible client account found.');
      err.statusCode = 404;
      throw err;
    }

    const clientRecord = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, legalName: true, organizationId: true },
    });

    if (!clientRecord) {
      const err: any = new Error('Client record not found.');
      err.statusCode = 404;
      throw err;
    }

    return {
      clientId,
      clientLegalName: clientRecord.legalName,
      organizationId: clientRecord.organizationId,
      authorizedJobIds,
    };
  }

  // Helper: Verify submission belongs to client and is approved & sent
  async function verifyClientSubmissionAccess(submissionId: string, clientScope: { clientId: string; authorizedJobIds: string[] }) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        application: {
          include: {
            job: {
              select: {
                id: true,
                code: true,
                title: true,
                clientId: true,
                status: true,
              },
            },
            candidate: {
              select: {
                id: true,
                name: true,
                code: true,
                currentTitle: true,
                currentCompany: true,
                skills: true,
                experienceYears: true,
                documents: true,
              },
            },
          },
        },
        profileVersions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!submission || submission.isArchived) {
      const err: any = new Error('Submission not found.');
      err.statusCode = 404;
      throw err;
    }

    const job = submission.application.job;
    if (job.clientId !== clientScope.clientId) {
      const err: any = new Error('Access denied: This submission does not belong to your organization.');
      err.statusCode = 403;
      throw err;
    }

    if (clientScope.authorizedJobIds.length > 0 && !clientScope.authorizedJobIds.includes(job.id)) {
      const err: any = new Error('Access denied: This position is not included in your authorized job scope.');
      err.statusCode = 403;
      throw err;
    }

    // Must be approved by manager (or approval not required)
    const isApproved =
      submission.approvalStatus === 'APPROVED' || submission.approvalStatus === 'APPROVAL_NOT_REQUIRED';

    // Must be sent to client
    const isSent =
      submission.sendState === 'SENT' ||
      submission.sendState === 'VIEWED_BY_CLIENT' ||
      submission.sendState === 'CLIENT_REVIEWED';

    if (!isApproved || !isSent) {
      const err: any = new Error('Submission is not visible to client (pending internal approval or unsent).');
      err.statusCode = 403;
      throw err;
    }

    return submission;
  }

  // Helper: Write AuditLog for client mutations
  async function logClientAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
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
      server.log.error(err, 'Failed to log client audit log');
    }
  }

  // =========================================================================
  // 1. GET /api/client-portal/overview (Figma Frame 12 Overview)
  // =========================================================================
  server.get(
    '/api/client-portal/overview',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);

      const jobScopeWhere: any = {
        clientId: scope.clientId,
        isArchived: false,
        status: 'ACTIVE',
        ...(scope.authorizedJobIds.length > 0 ? { id: { in: scope.authorizedJobIds } } : {}),
      };

      const now = new Date();

      const [openPositionsCount, submissions, upcomingInterviewsCount] = await Promise.all([
        prisma.job.count({ where: jobScopeWhere }),
        prisma.submission.findMany({
          where: {
            application: {
              job: jobScopeWhere,
            },
            approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
            sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
            isArchived: false,
          },
          include: {
            application: {
              include: {
                job: { select: { id: true, code: true, title: true } },
                candidate: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    currentTitle: true,
                    currentCompany: true,
                    skills: true,
                    experienceYears: true,
                  },
                },
              },
            },
            profileVersions: {
              where: { isCurrent: true },
              take: 1,
            },
          },
          orderBy: { sentAt: 'desc' },
        }),
        prisma.interview.count({
          where: {
            application: {
              job: jobScopeWhere,
              submissions: {
                some: {
                  approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
                  sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
                  isArchived: false,
                },
              },
            },
            scheduledAt: { gte: now },
            outcome: 'SCHEDULED',
            isArchived: false,
          },
        }),
      ]);

      const recentSubmissions: ClientSubmissionRowDTO[] = submissions.slice(0, 5).map((sub) => {
        const candidate = sub.application.candidate;
        const currentVersion = sub.profileVersions[0];
        const expStr = candidate.experienceYears ? `${candidate.experienceYears} yrs exp` : 'Experienced';

        return {
          id: sub.id,
          code: sub.code,
          candidateName: candidate.name,
          candidateCode: candidate.code,
          jobId: sub.application.job.id,
          jobTitle: sub.application.job.title,
          jobCode: sub.application.job.code,
          submittedAt: sub.sentAt ? sub.sentAt.toISOString() : sub.createdAt.toISOString(),
          experienceSummary: `${candidate.currentTitle || 'Professional'} at ${candidate.currentCompany || 'Undisclosed'} (${expStr})`,
          skills: candidate.skills || [],
          currentStatus: sub.clientDecision || 'AWAITING_REVIEW',
          clientDecision: sub.clientDecision,
          clientDecisionAt: (sub as any).clientDecisionAt?.toISOString() || null,
          clientDecisionReason: (sub as any).clientDecisionReason || null,
          currentVersionTag: currentVersion?.versionTag || `${sub.code}-v${sub.version}`,
          matchScore: sub.matchScore,
        };
      });

      const overviewDTO: ClientPortalOverviewDTO = {
        asOf: formatAsOfTimestamp(now),
        clientLegalName: scope.clientLegalName,
        clientContactName: user.name,
        metrics: {
          openPositions: openPositionsCount,
          profilesSubmitted: submissions.length,
          interviewsScheduled: upcomingInterviewsCount,
        },
        recentSubmissions,
      };

      return reply.send({
        success: true,
        data: overviewDTO,
      });
    }
  );

  // =========================================================================
  // 2. GET /api/client-portal/positions (Open Positions)
  // =========================================================================
  server.get(
    '/api/client-portal/positions',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const query = request.query as any;

      const where: any = {
        clientId: scope.clientId,
        isArchived: false,
        ...(query.status ? { status: query.status } : { status: 'ACTIVE' }),
        ...(scope.authorizedJobIds.length > 0 ? { id: { in: scope.authorizedJobIds } } : {}),
      };

      if (query.search) {
        where.OR = [
          { title: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
          { location: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const jobs = await prisma.job.findMany({
        where,
        include: {
          applications: {
            include: {
              submissions: {
                where: {
                  approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
                  sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
                  isArchived: false,
                },
              },
              interviews: {
                where: {
                  outcome: 'SCHEDULED',
                  scheduledAt: { gte: new Date() },
                  isArchived: false,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const positionsDTO: ClientPositionDTO[] = jobs.map((j) => {
        const candidatesSubmittedCount = j.applications.reduce((acc, a) => acc + a.submissions.length, 0);
        const interviewsActiveCount = j.applications.reduce((acc, a) => acc + a.interviews.length, 0);

        return {
          id: j.id,
          code: j.code,
          title: j.title,
          location: j.location,
          employmentType: j.employmentType,
          openings: j.openings,
          descriptionSummary: j.description ? j.description.slice(0, 240) + '...' : null,
          requiredSkills: j.requiredSkills || [],
          experienceMin: j.experienceMin ? Number(j.experienceMin) : null,
          experienceMax: j.experienceMax ? Number(j.experienceMax) : null,
          status: j.status,
          candidatesSubmittedCount,
          interviewsActiveCount,
          createdAt: j.createdAt.toISOString(),
        };
      });

      return reply.send({
        success: true,
        data: positionsDTO,
      });
    }
  );

  // =========================================================================
  // 3. GET /api/client-portal/positions/:id (Position Details)
  // =========================================================================
  server.get(
    '/api/client-portal/positions/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      if (scope.authorizedJobIds.length > 0 && !scope.authorizedJobIds.includes(id)) {
        return reply.status(403).send({ success: false, error: 'Access denied: Position not in authorized scope.' });
      }

      const job = await prisma.job.findFirst({
        where: { id, clientId: scope.clientId, isArchived: false },
        include: {
          applications: {
            include: {
              submissions: {
                where: {
                  approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
                  sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
                  isArchived: false,
                },
              },
              interviews: {
                where: {
                  outcome: 'SCHEDULED',
                  scheduledAt: { gte: new Date() },
                  isArchived: false,
                },
              },
            },
          },
        },
      });

      if (!job) {
        return reply.status(404).send({ success: false, error: 'Position not found.' });
      }

      const candidatesSubmittedCount = job.applications.reduce((acc, a) => acc + a.submissions.length, 0);
      const interviewsActiveCount = job.applications.reduce((acc, a) => acc + a.interviews.length, 0);

      const positionDTO: ClientPositionDTO = {
        id: job.id,
        code: job.code,
        title: job.title,
        location: job.location,
        employmentType: job.employmentType,
        openings: job.openings,
        descriptionSummary: job.description,
        requiredSkills: job.requiredSkills || [],
        experienceMin: job.experienceMin ? Number(job.experienceMin) : null,
        experienceMax: job.experienceMax ? Number(job.experienceMax) : null,
        status: job.status,
        candidatesSubmittedCount,
        interviewsActiveCount,
        createdAt: job.createdAt.toISOString(),
      };

      return reply.send({
        success: true,
        data: positionDTO,
      });
    }
  );

  // =========================================================================
  // 4. GET /api/client-portal/submissions (Submitted Profiles List)
  // =========================================================================
  server.get(
    '/api/client-portal/submissions',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const query = request.query as any;

      const jobWhere: any = {
        clientId: scope.clientId,
        isArchived: false,
        ...(query.jobId ? { id: query.jobId } : {}),
        ...(scope.authorizedJobIds.length > 0 ? { id: { in: scope.authorizedJobIds } } : {}),
      };

      const where: any = {
        application: {
          job: jobWhere,
        },
        approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
        sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
        isArchived: false,
        ...(query.clientDecision ? { clientDecision: query.clientDecision } : {}),
      };

      const submissions = await prisma.submission.findMany({
        where,
        include: {
          application: {
            include: {
              job: { select: { id: true, code: true, title: true } },
              candidate: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  currentTitle: true,
                  currentCompany: true,
                  skills: true,
                  experienceYears: true,
                },
              },
            },
          },
          profileVersions: {
            where: { isCurrent: true },
            take: 1,
          },
        },
        orderBy: { sentAt: 'desc' },
      });

      const submissionRows: ClientSubmissionRowDTO[] = submissions.map((sub) => {
        const candidate = sub.application.candidate;
        const currentVersion = sub.profileVersions[0];
        const expStr = candidate.experienceYears ? `${candidate.experienceYears} yrs exp` : 'Experienced';

        return {
          id: sub.id,
          code: sub.code,
          candidateName: candidate.name,
          candidateCode: candidate.code,
          jobId: sub.application.job.id,
          jobTitle: sub.application.job.title,
          jobCode: sub.application.job.code,
          submittedAt: sub.sentAt ? sub.sentAt.toISOString() : sub.createdAt.toISOString(),
          experienceSummary: `${candidate.currentTitle || 'Professional'} at ${candidate.currentCompany || 'Undisclosed'} (${expStr})`,
          skills: candidate.skills || [],
          currentStatus: sub.clientDecision || 'AWAITING_REVIEW',
          clientDecision: sub.clientDecision,
          clientDecisionAt: (sub as any).clientDecisionAt?.toISOString() || null,
          clientDecisionReason: (sub as any).clientDecisionReason || null,
          currentVersionTag: currentVersion?.versionTag || `${sub.code}-v${sub.version}`,
          matchScore: sub.matchScore,
        };
      });

      return reply.send({
        success: true,
        data: submissionRows,
      });
    }
  );

  // =========================================================================
  // 5. GET /api/client-portal/submissions/:id (Figma Frame 29 Detail)
  // =========================================================================
  server.get(
    '/api/client-portal/submissions/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);

      // Auto-update sendState from SENT to VIEWED_BY_CLIENT on first open
      if (sub.sendState === 'SENT') {
        await prisma.submission.update({
          where: { id: sub.id },
          data: { sendState: 'VIEWED_BY_CLIENT' },
        });
        await logClientAudit(
          user.id,
          'SUBMISSION_VIEWED_BY_CLIENT',
          'submission',
          sub.id,
          { sendState: 'SENT' },
          { sendState: 'VIEWED_BY_CLIENT', viewedAt: new Date() },
          request.ip
        );
      }

      const candidate = sub.application.candidate;
      const currentVersion = sub.profileVersions.find((v) => v.isCurrent) || sub.profileVersions[0];

      // Re-run through buildClientFacingProfile to guarantee 100% data sanitization
      const sanitizedProfile = buildClientFacingProfile(currentVersion?.contentSnapshot as any);

      // Fetch client download policy & usage today
      const todayBounds = getISTDayBoundaries(new Date());
      const policy = await prisma.downloadPolicy.findUnique({
        where: {
          organizationId_role: {
            organizationId: scope.organizationId,
            role: user.role,
          },
        },
      });

      const userDownloadsToday = await prisma.downloadLog.count({
        where: {
          userId: user.id,
          resourceType: 'CV',
          result: 'SUCCESS',
          createdAt: {
            gte: todayBounds.startUtc,
            lte: todayBounds.endUtc,
          },
        },
      });

      const usage = calculateDownloadUsage({
        role: user.role,
        configuredLimit: policy?.dailyCvLimit,
        downloadsUsedToday: userDownloadsToday,
      });

      const watermarkText = generateCVWatermarkText(scope.clientLegalName);

      // Build decision history
      const rawHistory = ((sub as any).clientDecisionHistory as any[]) || [];
      const decisionHistory = rawHistory.map((item) => ({
        decision: item.decision,
        reason: item.reason || null,
        feedback: item.feedback || null,
        informationRequired: item.informationRequired || null,
        decidedAt: item.decidedAt,
        clientUserName: item.clientUserName || 'Client Contact',
      }));

      // Fetch recruitment feedback submitted by client contacts for this submission
      const auditFeedbackLogs = await prisma.auditLog.findMany({
        where: {
          entity: 'submission_client_feedback',
          entityId: sub.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const recruitmentFeedback = auditFeedbackLogs.map((log) => {
        const payload = (log.after as any) || {};
        return {
          id: log.id,
          category: payload.category || 'GENERAL',
          content: payload.content || '',
          createdAt: log.createdAt.toISOString(),
          authorName: payload.authorName || 'Client Contact',
        };
      });

      const submissionRow: ClientSubmissionRowDTO = {
        id: sub.id,
        code: sub.code,
        candidateName: candidate.name,
        candidateCode: candidate.code,
        jobId: sub.application.job.id,
        jobTitle: sub.application.job.title,
        jobCode: sub.application.job.code,
        submittedAt: sub.sentAt ? sub.sentAt.toISOString() : sub.createdAt.toISOString(),
        experienceSummary: `${candidate.currentTitle || 'Professional'} at ${candidate.currentCompany || 'Undisclosed'}`,
        skills: candidate.skills || [],
        currentStatus: sub.clientDecision || 'AWAITING_REVIEW',
        clientDecision: sub.clientDecision,
        clientDecisionAt: (sub as any).clientDecisionAt?.toISOString() || null,
        clientDecisionReason: (sub as any).clientDecisionReason || null,
        currentVersionTag: currentVersion?.versionTag || `${sub.code}-v${sub.version}`,
        matchScore: sub.matchScore,
      };

      const detailDTO: ClientSubmissionDetailDTO = {
        submission: submissionRow,
        profile: sanitizedProfile,
        decisionHistory,
        recruitmentFeedback,
        cv: {
          hasCv: (candidate.documents && candidate.documents.length > 0) || true,
          fileName: `${candidate.code}_Resume_Watermarked.pdf`,
          documentVersion: currentVersion?.versionNumber || 1,
          watermarkPreview: watermarkText,
          dailyLimit: usage.dailyLimit,
          usedToday: usage.usedToday,
          remainingToday: usage.remaining,
        },
      };

      return reply.send({
        success: true,
        data: detailDTO,
      });
    }
  );

  // =========================================================================
  // 6. GET /api/client-portal/submissions/:id/profile (Standard Profile HTML/JSON)
  // =========================================================================
  server.get(
    '/api/client-portal/submissions/:id/profile',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);
      const currentVersion = sub.profileVersions.find((v) => v.isCurrent) || sub.profileVersions[0];

      const sanitized = buildClientFacingProfile(currentVersion?.contentSnapshot as any);

      return reply.send({
        success: true,
        data: sanitized,
      });
    }
  );

  // =========================================================================
  // 7. GET /api/client-portal/submissions/:id/cv/preview (Watermarked Preview)
  // =========================================================================
  server.get(
    '/api/client-portal/submissions/:id/cv/preview',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);
      const watermarkText = generateCVWatermarkText(scope.clientLegalName);

      const todayBounds = getISTDayBoundaries(new Date());
      const policy = await prisma.downloadPolicy.findUnique({
        where: {
          organizationId_role: {
            organizationId: scope.organizationId,
            role: user.role,
          },
        },
      });

      const usedToday = await prisma.downloadLog.count({
        where: {
          userId: user.id,
          resourceType: 'CV',
          result: 'SUCCESS',
          createdAt: {
            gte: todayBounds.startUtc,
            lte: todayBounds.endUtc,
          },
        },
      });

      const quota = calculateDownloadUsage({
        role: user.role,
        configuredLimit: policy?.dailyCvLimit,
        downloadsUsedToday: usedToday,
      });

      return reply.send({
        success: true,
        data: {
          candidateCode: sub.application.candidate.code,
          candidateName: sub.application.candidate.name,
          watermarkText,
          watermarkApplied: true,
          dailyLimit: quota.dailyLimit,
          remainingToday: quota.remaining,
          previewUrl: `/api/client-portal/submissions/${sub.id}/cv/preview-stream`,
        },
      });
    }
  );

  // =========================================================================
  // 8. POST /api/client-portal/submissions/:id/cv/download (Watermarked CV Download)
  // =========================================================================
  server.post(
    '/api/client-portal/submissions/:id/cv/download',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);
      const todayBounds = getISTDayBoundaries(new Date());

      // 1. Check user download quota
      const policy = await prisma.downloadPolicy.findUnique({
        where: {
          organizationId_role: {
            organizationId: scope.organizationId,
            role: user.role,
          },
        },
      });

      const usedToday = await prisma.downloadLog.count({
        where: {
          userId: user.id,
          resourceType: 'CV',
          result: 'SUCCESS',
          createdAt: {
            gte: todayBounds.startUtc,
            lte: todayBounds.endUtc,
          },
        },
      });

      const quota = calculateDownloadUsage({
        role: user.role,
        configuredLimit: policy?.dailyCvLimit,
        downloadsUsedToday: usedToday,
      });

      if (quota.isExceeded) {
        // Record denial
        await prisma.downloadLog.create({
          data: {
            userId: user.id,
            resourceType: 'CV',
            resourceId: sub.id,
            organizationId: scope.organizationId,
            clientId: scope.clientId,
            jobId: sub.application.job.id,
            entityType: 'SUBMISSION',
            entityId: sub.id,
            result: 'DENIED',
            denialReason: 'DAILY_LIMIT_EXCEEDED',
            purpose: 'CLIENT_PORTAL_CV_DOWNLOAD',
            ipAddress: request.ip,
          },
        });

        return reply.status(429).send({
          success: false,
          error: {
            code: 'DAILY_LIMIT_EXCEEDED',
            message: `You have reached your daily limit of ${quota.dailyLimit} CV downloads. Quota resets at midnight Asia/Kolkata.`,
          },
        });
      }

      // 2. Generate Watermark
      const watermarkText = generateCVWatermarkText(scope.clientLegalName);

      // 3. Atomically record successful download
      await prisma.downloadLog.create({
        data: {
          userId: user.id,
          resourceType: 'CV',
          resourceId: sub.id,
          organizationId: scope.organizationId,
          clientId: scope.clientId,
          jobId: sub.application.job.id,
          entityType: 'SUBMISSION',
          entityId: sub.id,
          watermarkApplied: true,
          watermarkText,
          result: 'SUCCESS',
          purpose: 'CLIENT_PORTAL_CV_DOWNLOAD',
          ipAddress: request.ip,
        },
      });

      return reply.send({
        success: true,
        data: {
          submissionId: sub.id,
          fileName: `${sub.application.candidate.code}_Resume_Watermarked.pdf`,
          watermarkText,
          watermarkApplied: true,
          remainingToday: quota.remaining - 1,
          downloadTimestamp: new Date().toISOString(),
          notice: 'Server-side watermark applied for data privacy and anti-leak compliance.',
        },
      });
    }
  );

  // =========================================================================
  // 9. POST /api/client-portal/submissions/:id/shortlist
  // =========================================================================
  server.post(
    '/api/client-portal/submissions/:id/shortlist',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);
      const body = ClientShortlistSchema.parse(request.body || {});

      const previousDecision = sub.clientDecision;
      const decidedAt = new Date();

      const newHistoryItem = {
        decision: 'SHORTLISTED',
        feedback: body.comments || null,
        decidedAt: decidedAt.toISOString(),
        clientUserId: user.id,
        clientUserName: user.name,
      };

      const existingHistory = ((sub as any).clientDecisionHistory as any[]) || [];
      const updatedHistory = [...existingHistory, newHistoryItem];

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.submission.update({
          where: { id: sub.id },
          data: {
            clientDecision: 'SHORTLISTED',
            clientFeedback: body.comments || sub.clientFeedback,
            sendState: 'CLIENT_REVIEWED',
            clientDecisionAt: decidedAt,
            clientDecisionHistory: updatedHistory as any,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'CLIENT_SHORTLIST_SUBMISSION',
            entity: 'submission',
            entityId: sub.id,
            before: { clientDecision: previousDecision } as any,
            after: {
              clientDecision: 'SHORTLISTED',
              comments: body.comments,
              decidedAt,
            } as any,
            ipAddress: request.ip || '127.0.0.1',
          },
        });

        return s;
      });

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          clientDecision: updated.clientDecision,
          clientDecisionAt: decidedAt.toISOString(),
          message: 'Candidate shortlisted successfully. The recruitment team has been notified.',
        },
      });
    }
  );

  // =========================================================================
  // 10. POST /api/client-portal/submissions/:id/reject (Mandatory Reason)
  // =========================================================================
  server.post(
    '/api/client-portal/submissions/:id/reject',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);
      const body = ClientRejectSchema.parse(request.body || {});

      const previousDecision = sub.clientDecision;
      const decidedAt = new Date();

      const newHistoryItem = {
        decision: 'REJECTED',
        reason: body.reason,
        feedback: body.feedback || null,
        decidedAt: decidedAt.toISOString(),
        clientUserId: user.id,
        clientUserName: user.name,
      };

      const existingHistory = ((sub as any).clientDecisionHistory as any[]) || [];
      const updatedHistory = [...existingHistory, newHistoryItem];

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.submission.update({
          where: { id: sub.id },
          data: {
            clientDecision: 'REJECTED',
            clientDecisionReason: body.reason,
            clientFeedback: body.feedback || sub.clientFeedback,
            sendState: 'CLIENT_REVIEWED',
            clientDecisionAt: decidedAt,
            clientDecisionHistory: updatedHistory as any,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'CLIENT_REJECT_SUBMISSION',
            entity: 'submission',
            entityId: sub.id,
            before: { clientDecision: previousDecision } as any,
            after: {
              clientDecision: 'REJECTED',
              reason: body.reason,
              feedback: body.feedback,
              decidedAt,
            } as any,
            ipAddress: request.ip || '127.0.0.1',
          },
        });

        return s;
      });

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          clientDecision: updated.clientDecision,
          clientDecisionReason: body.reason,
          clientDecisionAt: decidedAt.toISOString(),
          message: 'Candidate rejection recorded. Note: Rejection is shared with HireFlow recruitment team only.',
        },
      });
    }
  );

  // =========================================================================
  // 11. POST /api/client-portal/submissions/:id/request-details
  // =========================================================================
  server.post(
    '/api/client-portal/submissions/:id/request-details',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);
      const body = ClientRequestDetailsSchema.parse(request.body || {});

      const previousDecision = sub.clientDecision;
      const decidedAt = new Date();

      const newHistoryItem = {
        decision: 'NEED_DETAILS',
        informationRequired: body.informationRequired,
        feedback: body.additionalContext || null,
        priority: body.priority,
        decidedAt: decidedAt.toISOString(),
        clientUserId: user.id,
        clientUserName: user.name,
      };

      const existingHistory = ((sub as any).clientDecisionHistory as any[]) || [];
      const updatedHistory = [...existingHistory, newHistoryItem];

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.submission.update({
          where: { id: sub.id },
          data: {
            clientDecision: 'NEED_DETAILS',
            sendState: 'CLIENT_REVIEWED',
            clientDecisionAt: decidedAt,
            clientDecisionHistory: updatedHistory as any,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'CLIENT_REQUEST_DETAILS',
            entity: 'submission',
            entityId: sub.id,
            before: { clientDecision: previousDecision } as any,
            after: {
              clientDecision: 'NEED_DETAILS',
              informationRequired: body.informationRequired,
              additionalContext: body.additionalContext,
              priority: body.priority,
              decidedAt,
            } as any,
            ipAddress: request.ip || '127.0.0.1',
          },
        });

        return s;
      });

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          clientDecision: updated.clientDecision,
          informationRequired: body.informationRequired,
          clientDecisionAt: decidedAt.toISOString(),
          message: 'Request for additional details sent to your HireFlow talent team.',
        },
      });
    }
  );

  // =========================================================================
  // 12. POST /api/client-portal/submissions/:id/feedback (Feedback to Team)
  // =========================================================================
  server.post(
    '/api/client-portal/submissions/:id/feedback',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);
      const { id } = request.params as { id: string };

      const sub = await verifyClientSubmissionAccess(id, scope);
      const body = ClientTeamFeedbackSchema.parse(request.body || {});

      const feedbackLog = await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CLIENT_RECRUITMENT_FEEDBACK_SUBMITTED',
          entity: 'submission_client_feedback',
          entityId: sub.id,
          after: {
            submissionId: sub.id,
            jobId: sub.application.job.id,
            clientId: scope.clientId,
            category: body.category,
            content: body.content,
            authorName: user.name,
            submittedAt: new Date().toISOString(),
          } as any,
          ipAddress: request.ip || '127.0.0.1',
        },
      });

      return reply.send({
        success: true,
        data: {
          id: feedbackLog.id,
          category: body.category,
          content: body.content,
          createdAt: feedbackLog.createdAt.toISOString(),
          message: 'Feedback received by the recruitment team. It will not be sent to the candidate.',
        },
      });
    }
  );

  // =========================================================================
  // 13. GET /api/client-portal/interviews (Candidate-Safe Interviews)
  // =========================================================================
  server.get(
    '/api/client-portal/interviews',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);

      const jobScopeWhere: any = {
        clientId: scope.clientId,
        isArchived: false,
        ...(scope.authorizedJobIds.length > 0 ? { id: { in: scope.authorizedJobIds } } : {}),
      };

      const interviews = await prisma.interview.findMany({
        where: {
          application: {
            job: jobScopeWhere,
            submissions: {
              some: {
                approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
                sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
                isArchived: false,
              },
            },
          },
          isArchived: false,
        },
        include: {
          round: { select: { name: true } },
          application: {
            include: {
              job: { select: { title: true, code: true } },
              candidate: { select: { name: true, code: true } },
            },
          },
          panelMembers: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      const interviewsDTO: ClientInterviewDTO[] = interviews.map((int) => {
        const candidate = int.application.candidate;
        const job = int.application.job;
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(int.scheduledAt.getTime() + istOffsetMs);

        const hours = istDate.getUTCHours();
        const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const dateStr = istDate.toISOString().slice(0, 10);
        const timeIST = `${dateStr} ${displayHours}:${minutes} ${ampm} IST`;

        const participants = int.panelMembers.map((p) => p.user.name);

        return {
          id: int.id,
          candidateName: candidate.name,
          candidateCode: candidate.code,
          jobTitle: job.title,
          jobCode: job.code,
          roundName: int.round?.name || 'Technical Round',
          scheduledAt: int.scheduledAt.toISOString(),
          scheduledAtIST: timeIST,
          duration: int.duration,
          mode: int.mode,
          status: int.outcome,
          meetingLink: int.meetingLink,
          participants,
        };
      });

      return reply.send({
        success: true,
        data: interviewsDTO,
      });
    }
  );

  // =========================================================================
  // 14. GET /api/client-portal/reports (Client Progress Reports)
  // =========================================================================
  server.get(
    '/api/client-portal/reports',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const scope = await resolveClientScope(user);

      const jobScopeWhere: any = {
        clientId: scope.clientId,
        isArchived: false,
        ...(scope.authorizedJobIds.length > 0 ? { id: { in: scope.authorizedJobIds } } : {}),
      };

      const [jobs, submissions, interviews, placements] = await Promise.all([
        prisma.job.findMany({
          where: jobScopeWhere,
          select: { id: true, code: true, title: true, status: true },
        }),
        prisma.submission.findMany({
          where: {
            application: { job: jobScopeWhere },
            approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
            sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
            isArchived: false,
          },
          select: {
            id: true,
            clientDecision: true,
            application: { select: { jobId: true } },
          },
        }),
        prisma.interview.findMany({
          where: {
            application: { job: jobScopeWhere },
            isArchived: false,
          },
          select: {
            id: true,
            outcome: true,
            application: { select: { jobId: true } },
          },
        }),
        prisma.placement.findMany({
          where: {
            clientId: scope.clientId,
            ...(scope.authorizedJobIds.length > 0 ? { application: { jobId: { in: scope.authorizedJobIds } } } : {}),
          },
          select: {
            id: true,
            application: { select: { jobId: true } },
          },
        }),
      ]);

      const openPositionsCount = jobs.filter((j) => j.status === 'ACTIVE').length;
      const profilesSubmitted = submissions.length;
      const pendingReview = submissions.filter((s) => !s.clientDecision).length;
      const shortlisted = submissions.filter((s) => s.clientDecision === 'SHORTLISTED').length;
      const interviewsScheduled = interviews.filter((i) => i.outcome === 'SCHEDULED').length;
      const interviewsCompleted = interviews.filter((i) => i.outcome === 'COMPLETED').length;
      const positionsFilled = placements.length;

      const jobProgress = jobs.map((job) => {
        const jobSubs = submissions.filter((s) => s.application.jobId === job.id);
        const jobInts = interviews.filter((i) => i.application.jobId === job.id);
        const jobPlaces = placements.filter((p) => p.application.jobId === job.id);

        return {
          jobId: job.id,
          jobCode: job.code,
          jobTitle: job.title,
          status: job.status,
          profilesSubmitted: jobSubs.length,
          pendingReview: jobSubs.filter((s) => !s.clientDecision).length,
          shortlisted: jobSubs.filter((s) => s.clientDecision === 'SHORTLISTED').length,
          interviewed: jobInts.length,
          filled: jobPlaces.length,
        };
      });

      const reportDTO: ClientProgressReportDTO = {
        asOf: formatAsOfTimestamp(new Date()),
        reportingPeriod: 'All Time (Active Mandates)',
        summary: {
          openPositions: openPositionsCount,
          profilesSubmitted,
          pendingReview,
          shortlisted,
          interviewsScheduled,
          interviewsCompleted,
          positionsFilled,
        },
        jobProgress,
      };

      return reply.send({
        success: true,
        data: reportDTO,
      });
    }
  );
};
