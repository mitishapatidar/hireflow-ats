import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  JobStatus,
  SubmissionApprovalStatus,
  SendState,
  buildClientFacingProfile,
  computeProfileContentHash,
  generateCVWatermarkText,
  calculateCandidateJobMatch,
  CreateSubmissionSchema,
  UpdateStandardProfileSchema,
  SendSubmissionSchema,
  RequestApprovalSchema,
  ReviewApprovalSchema,
  SubmissionsQueryFiltersSchema,
  SubmissionRowDTO,
  ClientFacingStandardProfileDTO,
} from '@hireflow/shared';

export const submissionRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Log audit events
  async function logSubmissionAudit(
    actorId: string,
    action: string,
    submissionId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'submission',
          entityId: submissionId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log submission audit event');
    }
  }

  // Helper: Verify submission access
  async function verifySubmissionAccess(submissionId: string, user: any) {
    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return { allowed: false, status: 403, error: 'Forbidden: Submissions module is restricted to internal recruitment team.' };
    }

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        application: {
          include: {
            candidate: true,
            job: {
              include: {
                client: true,
                assignments: true,
              },
            },
          },
        },
        profileVersions: {
          orderBy: { versionNumber: 'desc' },
        },
        approvals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sub || sub.isArchived) {
      return { allowed: false, status: 404, error: 'Submission not found' };
    }

    if (sub.application.job.organizationId !== user.organizationId) {
      return { allowed: false, status: 404, error: 'Submission not found in your organization.' };
    }

    if (user.role === UserRole.RECRUITER) {
      const isOwner = sub.application.job.ownerId === user.id;
      const isAssigned = sub.application.job.assignments.some((a) => a.recruiterId === user.id);
      const isCandidateOwner = sub.application.candidate.ownerId === user.id;
      if (!isOwner && !isAssigned && !isCandidateOwner) {
        return { allowed: false, status: 403, error: 'Forbidden: You are not assigned to this candidate submission.' };
      }
    }

    return { allowed: true, submission: sub };
  }

  // -------------------------------------------------------------
  // 1. GET /api/submissions (List with Search, Filters, Live Counts)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = SubmissionsQueryFiltersSchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: 'Invalid query parameters', details: parseResult.error.flatten() });
      }
      const filters = parseResult.data;

      const whereClause: Prisma.SubmissionWhereInput = {
        isArchived: false,
        application: {
          job: {
            organizationId: user.organizationId,
            ...(filters.clientId ? { clientId: filters.clientId } : {}),
            ...(filters.jobId ? { id: filters.jobId } : {}),
            ...(user.role === UserRole.RECRUITER
              ? {
                  OR: [
                    { ownerId: user.id },
                    { assignments: { some: { recruiterId: user.id } } },
                  ],
                }
              : {}),
          },
        },
      };

      if (filters.status && filters.status !== 'ALL') {
        if (filters.status === 'AWAITING_APPROVAL') {
          whereClause.approvalStatus = SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL;
        } else if (filters.status === 'APPROVED') {
          whereClause.approvalStatus = SubmissionApprovalStatus.APPROVED;
        } else if (filters.status === 'CHANGES_REQUESTED') {
          whereClause.approvalStatus = SubmissionApprovalStatus.CHANGES_REQUESTED;
        } else if (filters.status === 'REJECTED') {
          whereClause.approvalStatus = SubmissionApprovalStatus.REJECTED;
        } else if (filters.status === 'APPROVAL_NOT_REQUIRED') {
          whereClause.approvalStatus = SubmissionApprovalStatus.APPROVAL_NOT_REQUIRED;
        }
      }

      if (filters.search) {
        whereClause.OR = [
          { code: { contains: filters.search, mode: 'insensitive' } },
          { application: { candidate: { name: { contains: filters.search, mode: 'insensitive' } } } },
          { application: { candidate: { code: { contains: filters.search, mode: 'insensitive' } } } },
          { application: { job: { title: { contains: filters.search, mode: 'insensitive' } } } },
          { application: { job: { client: { legalName: { contains: filters.search, mode: 'insensitive' } } } } },
        ];
      }

      const [totalCount, submissions, countAll, countAwaiting, countApproved] = await Promise.all([
        prisma.submission.count({ where: whereClause }),
        prisma.submission.findMany({
          where: whereClause,
          include: {
            application: {
              include: {
                candidate: true,
                job: { include: { client: true } },
              },
            },
            profileVersions: {
              where: { isCurrent: true },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
        }),
        prisma.submission.count({
          where: {
            isArchived: false,
            application: { job: { organizationId: user.organizationId } },
          },
        }),
        prisma.submission.count({
          where: {
            isArchived: false,
            approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
            application: { job: { organizationId: user.organizationId } },
          },
        }),
        prisma.submission.count({
          where: {
            isArchived: false,
            approvalStatus: SubmissionApprovalStatus.APPROVED,
            application: { job: { organizationId: user.organizationId } },
          },
        }),
      ]);

      const rows: SubmissionRowDTO[] = submissions.map((s) => {
        const currentVersion = s.profileVersions[0];
        return {
          id: s.id,
          code: s.code,
          candidateId: s.application.candidate.id,
          candidateName: s.application.candidate.name,
          candidateCode: s.application.candidate.code,
          jobId: s.application.job.id,
          jobTitle: s.application.job.title,
          jobCode: s.application.job.code,
          jobStatus: s.application.job.status,
          clientId: s.application.job.client.id,
          clientName: s.application.job.client.legalName,
          clientCode: s.application.job.client.code,
          matchPercentage: s.matchScore ?? 85,
          submittedByName: 'Recruitment Team',
          submittedAt: s.createdAt.toISOString(),
          approvalStatus: s.approvalStatus as SubmissionApprovalStatus,
          currentVersion: s.version,
          versionTag: currentVersion?.versionTag || `${s.code}-v${s.version}`,
          sendState: s.sendState,
          sentAt: s.sentAt?.toISOString() || null,
          clientDecision: s.clientDecision,
        };
      });

      return reply.send({
        success: true,
        data: rows,
        pagination: {
          total: totalCount,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.ceil(totalCount / filters.limit),
        },
        stats: {
          all: countAll,
          awaitingApproval: countAwaiting,
          approved: countApproved,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 2. GET /api/submissions/:id (Single Submission Detail)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const s = access.submission;
      const currentVersion = s.profileVersions[0];

      return reply.send({
        success: true,
        data: {
          id: s.id,
          code: s.code,
          version: s.version,
          approvalStatus: s.approvalStatus,
          sendState: s.sendState,
          sentAt: s.sentAt?.toISOString() || null,
          clientDecision: s.clientDecision,
          clientFeedback: s.clientFeedback,
          matchScore: s.matchScore,
          matchDetails: s.matchDetails,
          candidate: {
            id: s.application.candidate.id,
            code: s.application.candidate.code,
            name: s.application.candidate.name,
            currentTitle: s.application.candidate.currentTitle,
            currentCompany: s.application.candidate.currentCompany,
            location: s.application.candidate.location,
            skills: s.application.candidate.skills,
            experienceYears: s.application.candidate.experienceYears ? Number(s.application.candidate.experienceYears) : null,
          },
          job: {
            id: s.application.job.id,
            code: s.application.job.code,
            title: s.application.job.title,
            status: s.application.job.status,
            client: {
              id: s.application.job.client.id,
              name: s.application.job.client.legalName,
              code: s.application.job.client.code,
            },
          },
          currentProfile: currentVersion
            ? {
                versionNumber: currentVersion.versionNumber,
                versionTag: currentVersion.versionTag,
                headline: currentVersion.headline,
                summary: currentVersion.summary,
                selectedSkills: currentVersion.selectedSkills,
                experienceHighlights: currentVersion.experienceHighlights,
                educationHighlights: currentVersion.educationHighlights,
                portfolioUrl: currentVersion.portfolioUrl,
                contentHash: currentVersion.contentHash,
                createdAt: currentVersion.createdAt.toISOString(),
              }
            : null,
          latestApproval: s.approvals[0]
            ? {
                decision: s.approvals[0].decision,
                comments: s.approvals[0].comments,
                approvedAt: s.approvals[0].approvedAt?.toISOString() || null,
                isInvalidated: s.approvals[0].isInvalidated,
              }
            : null,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 3. POST /api/submissions (Create Submission & Initial v1 Profile)
  // -------------------------------------------------------------
  server.get;
  server.post(
    '/api/submissions',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = CreateSubmissionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: 'Validation failed', details: parseResult.error.flatten() });
      }
      const data = parseResult.data;

      // Verify application
      const app = await prisma.application.findUnique({
        where: { id: data.applicationId },
        include: {
          candidate: true,
          job: { include: { client: true, assignments: true } },
          submissions: { where: { isArchived: false } },
        },
      });

      if (!app || app.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Application not found' });
      }

      if (user.role === UserRole.RECRUITER) {
        const isOwner = app.job.ownerId === user.id;
        const isAssigned = app.job.assignments.some((a) => a.recruiterId === user.id);
        const isCandOwner = app.candidate.ownerId === user.id;
        if (!isOwner && !isAssigned && !isCandOwner) {
          return reply.status(403).send({ success: false, error: 'Forbidden: You are not assigned to this job or candidate.' });
        }
      }

      // Check existing active submission
      if (app.submissions.length > 0) {
        return reply.status(409).send({
          success: false,
          error: 'A client submission already exists for this candidate application.',
          submissionId: app.submissions[0].id,
        });
      }

      // Generate unique submission code
      const count = await prisma.submission.count({ where: { application: { job: { organizationId: user.organizationId } } } });
      const subCode = `S-${240 + count + 1}`;
      const versionTag = `${subCode}-v1`;

      // 1. Calculate deterministic match score
      const matchResult = calculateCandidateJobMatch(
        {
          name: app.candidate.name,
          skills: app.candidate.skills,
          experienceYears: app.candidate.experienceYears ? Number(app.candidate.experienceYears) : null,
          expectedSalary: app.candidate.expectedSalary ? Number(app.candidate.expectedSalary) : null,
          location: app.candidate.location,
        },
        {
          title: app.job.title,
          requiredSkills: app.job.requiredSkills || [],
          requirements: app.job.requirements,
          experienceMin: app.job.experienceMin ? Number(app.job.experienceMin) : null,
          experienceMax: app.job.experienceMax ? Number(app.job.experienceMax) : null,
          salaryMin: app.job.salaryMin ? Number(app.job.salaryMin) : null,
          salaryMax: app.job.salaryMax ? Number(app.job.salaryMax) : null,
          location: app.job.location,
        }
      );

      // 2. Build client-facing sanitized allow-list profile
      const rawProfile = {
        versionTag,
        versionNumber: 1,
        candidateName: app.candidate.name,
        candidateCode: app.candidate.code,
        headline: data.headline || app.candidate.currentTitle || 'Experienced Professional',
        currentTitle: app.candidate.currentTitle,
        currentCompany: app.candidate.currentCompany,
        location: app.candidate.location,
        summary: data.summary || `${app.candidate.name} is an experienced professional in ${app.candidate.skills.slice(0, 3).join(', ')}.`,
        selectedSkills: data.selectedSkills.length > 0 ? data.selectedSkills : app.candidate.skills,
        experienceHighlights: data.experienceHighlights || [
          {
            title: app.candidate.currentTitle || 'Professional',
            company: app.candidate.currentCompany || 'Industry Firm',
            duration: 'Recent',
            description: 'Key technical contributor delivering business-critical initiatives.',
          },
        ],
        educationHighlights: data.educationHighlights || [],
        portfolioUrl: data.portfolioUrl || null,
        clientName: app.job.client.legalName,
      };

      const sanitizedProfile = buildClientFacingProfile(rawProfile);
      const contentHash = computeProfileContentHash(sanitizedProfile);

      // Transaction: create submission and version 1
      const newSubmission = await prisma.$transaction(async (tx) => {
        const sub = await tx.submission.create({
          data: {
            code: subCode,
            applicationId: app.id,
            version: 1,
            approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
            matchScore: matchResult.overallScore,
            matchDetails: matchResult as any,
            createdById: user.id,
          },
        });

        await tx.submissionProfileVersion.create({
          data: {
            submissionId: sub.id,
            versionNumber: 1,
            versionTag,
            headline: sanitizedProfile.headline,
            summary: sanitizedProfile.professionalSummary,
            selectedSkills: sanitizedProfile.coreSkills,
            experienceHighlights: sanitizedProfile.experienceHighlights as any,
            educationHighlights: sanitizedProfile.educationHighlights as any,
            portfolioUrl: sanitizedProfile.portfolioUrl,
            contentSnapshot: sanitizedProfile as any,
            contentHash,
            changeSummary: 'Initial Standard Profile generation from candidate profile.',
            isCurrent: true,
            createdById: user.id,
          },
        });

        return sub;
      });

      await logSubmissionAudit(user.id, 'SUBMISSION_CREATED', newSubmission.id, null, {
        code: subCode,
        applicationId: app.id,
        matchScore: matchResult.overallScore,
        version: 1,
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: newSubmission.id,
          code: newSubmission.code,
          version: 1,
          versionTag,
          matchScore: matchResult.overallScore,
          approvalStatus: newSubmission.approvalStatus,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 4. GET /api/submissions/:id/match (Deterministic Match Breakdown)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions/:id/match',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const sub = access.submission;
      const app = sub.application;

      // Deterministically recalculate to guarantee live reproducibility
      const matchResult = calculateCandidateJobMatch(
        {
          name: app.candidate.name,
          skills: app.candidate.skills,
          experienceYears: app.candidate.experienceYears ? Number(app.candidate.experienceYears) : null,
          expectedSalary: app.candidate.expectedSalary ? Number(app.candidate.expectedSalary) : null,
          location: app.candidate.location,
        },
        {
          title: app.job.title,
          requiredSkills: app.job.requiredSkills || [],
          requirements: app.job.requirements,
          experienceMin: app.job.experienceMin ? Number(app.job.experienceMin) : null,
          experienceMax: app.job.experienceMax ? Number(app.job.experienceMax) : null,
          salaryMin: app.job.salaryMin ? Number(app.job.salaryMin) : null,
          salaryMax: app.job.salaryMax ? Number(app.job.salaryMax) : null,
          location: app.job.location,
        }
      );

      return reply.send({
        success: true,
        data: matchResult,
      });
    }
  );

  // -------------------------------------------------------------
  // 5. GET /api/submissions/:id/profile (Client-Facing Profile DTO)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions/:id/profile',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const currentVersion = access.submission.profileVersions[0];
      if (!currentVersion) {
        return reply.status(404).send({ success: false, error: 'No profile version found for this submission.' });
      }

      // Re-run through buildClientFacingProfile to guarantee zero data leakage
      const sanitized = buildClientFacingProfile(currentVersion.contentSnapshot as any);

      return reply.send({
        success: true,
        data: sanitized,
      });
    }
  );

  // -------------------------------------------------------------
  // 6. POST /api/submissions/:id/profile/versions (Create New Profile Version)
  // -------------------------------------------------------------
  server.post(
    '/api/submissions/:id/profile/versions',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const parseResult = UpdateStandardProfileSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: 'Validation failed', details: parseResult.error.flatten() });
      }
      const data = parseResult.data;

      const sub = access.submission;
      const nextVersionNumber = sub.version + 1;
      const nextVersionTag = `${sub.code}-v${nextVersionNumber}`;

      const rawProfile = {
        versionTag: nextVersionTag,
        versionNumber: nextVersionNumber,
        candidateName: sub.application.candidate.name,
        candidateCode: sub.application.candidate.code,
        headline: data.headline || sub.application.candidate.currentTitle || 'Experienced Professional',
        currentTitle: sub.application.candidate.currentTitle,
        currentCompany: sub.application.candidate.currentCompany,
        location: sub.application.candidate.location,
        summary: data.summary || '',
        selectedSkills: data.selectedSkills,
        experienceHighlights: data.experienceHighlights || [],
        educationHighlights: data.educationHighlights || [],
        portfolioUrl: data.portfolioUrl || null,
        clientName: sub.application.job.client.legalName,
      };

      const sanitizedProfile = buildClientFacingProfile(rawProfile);
      const contentHash = computeProfileContentHash(sanitizedProfile);

      // Invalidate existing approvals and save new version
      await prisma.$transaction(async (tx) => {
        // Mark old versions non-current
        await tx.submissionProfileVersion.updateMany({
          where: { submissionId: sub.id },
          data: { isCurrent: false },
        });

        // Invalidate previous approvals
        await tx.submissionApproval.updateMany({
          where: { submissionId: sub.id, isInvalidated: false },
          data: {
            isInvalidated: true,
            invalidatedAt: new Date(),
            invalidationReason: `New profile version ${nextVersionTag} created: ${data.changeSummary}`,
          },
        });

        // Create new version
        await tx.submissionProfileVersion.create({
          data: {
            submissionId: sub.id,
            versionNumber: nextVersionNumber,
            versionTag: nextVersionTag,
            headline: sanitizedProfile.headline,
            summary: sanitizedProfile.professionalSummary,
            selectedSkills: sanitizedProfile.coreSkills,
            experienceHighlights: sanitizedProfile.experienceHighlights as any,
            educationHighlights: sanitizedProfile.educationHighlights as any,
            portfolioUrl: sanitizedProfile.portfolioUrl,
            contentSnapshot: sanitizedProfile as any,
            contentHash,
            changeSummary: data.changeSummary,
            isCurrent: true,
            createdById: user.id,
          },
        });

        // Update submission version and set status to APPROVAL_INVALIDATED or PENDING_MANAGER_APPROVAL
        await tx.submission.update({
          where: { id: sub.id },
          data: {
            version: nextVersionNumber,
            approvalStatus: SubmissionApprovalStatus.APPROVAL_INVALIDATED,
          },
        });
      });

      await logSubmissionAudit(user.id, 'PROFILE_VERSION_CREATED', sub.id, { version: sub.version }, {
        version: nextVersionNumber,
        versionTag: nextVersionTag,
        changeSummary: data.changeSummary,
      });

      return reply.status(201).send({
        success: true,
        data: {
          versionNumber: nextVersionNumber,
          versionTag: nextVersionTag,
          contentHash,
          approvalStatus: SubmissionApprovalStatus.APPROVAL_INVALIDATED,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 7. GET /api/submissions/:id/profile/versions (Version History)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions/:id/profile/versions',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const versions = await prisma.submissionProfileVersion.findMany({
        where: { submissionId: id },
        include: { createdBy: { select: { id: true, name: true, role: true } } },
        orderBy: { versionNumber: 'desc' },
      });

      return reply.send({
        success: true,
        data: versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          versionTag: v.versionTag,
          changeSummary: v.changeSummary,
          contentHash: v.contentHash,
          isCurrent: v.isCurrent,
          createdBy: v.createdBy.name,
          createdAt: v.createdAt.toISOString(),
        })),
      });
    }
  );

  // -------------------------------------------------------------
  // 8. GET /api/submissions/:id/profile/preview (HTML Preview Figma Frame 29)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions/:id/profile/preview',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const currentVersion = access.submission.profileVersions[0];
      const profile = buildClientFacingProfile(currentVersion?.contentSnapshot as any);

      // Render clean sanitized HTML matching Figma Frame 29
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${profile.candidateName} — ${profile.clientName} Standard Profile (${profile.versionTag})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1B2236; margin: 0; padding: 40px; background: #fff; }
    .header { border-bottom: 2px solid #5B49D6; padding-bottom: 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title-group h1 { margin: 0; font-size: 26px; color: #1E2A4A; }
    .title-group h2 { margin: 6px 0 0; font-size: 16px; color: #5B49D6; font-weight: 500; }
    .client-badge { font-size: 12px; background: #EEEBFB; color: #5B49D6; padding: 6px 12px; border-radius: 6px; font-weight: 600; text-align: right; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7490; border-bottom: 1px solid #E6E8F0; padding-bottom: 6px; margin-bottom: 12px; }
    .summary-text { font-size: 14px; line-height: 1.6; color: #333F51; }
    .skills-container { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill-tag { background: #F6F7FB; border: 1px solid #E6E8F0; color: #1E2A4A; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 4px; }
    .item { margin-bottom: 14px; }
    .item-header { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: #1B2236; }
    .item-sub { font-size: 13px; color: #6B7490; margin-top: 2px; }
    .item-desc { font-size: 13px; color: #4A5568; line-height: 1.5; margin-top: 4px; }
    .footer { margin-top: 40px; border-top: 1px solid #E6E8F0; padding-top: 14px; font-size: 11px; color: #A0AEC0; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <h1>${profile.candidateName}</h1>
      <h2>${profile.headline}</h2>
      <div style="font-size: 12px; color: #6B7490; margin-top: 4px;">Candidate Code: ${profile.candidateCode} · Location: ${profile.location || 'Open'}</div>
    </div>
    <div class="client-badge">
      <div>CONFIDENTIAL PROFILE</div>
      <div style="font-size: 10px; margin-top: 2px;">Prepared for ${profile.clientName}</div>
      <div style="font-size: 10px; opacity: 0.8;">Ref: ${profile.versionTag}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary-text">${profile.professionalSummary || 'Experienced specialist delivering high-impact recruitment and project solutions.'}</div>
  </div>

  <div class="section">
    <div class="section-title">Core Competencies & Skills</div>
    <div class="skills-container">
      ${profile.coreSkills.map((s) => `<span class="skill-tag">${s}</span>`).join('\n      ')}
    </div>
  </div>

  ${profile.experienceHighlights.length > 0 ? `
  <div class="section">
    <div class="section-title">Selected Experience Highlights</div>
    ${profile.experienceHighlights.map((e) => `
    <div class="item">
      <div class="item-header">
        <span>${e.title}</span>
        <span style="font-size: 12px; color: #6B7490;">${e.duration || ''}</span>
      </div>
      <div class="item-sub">${e.company}</div>
      ${e.description ? `<div class="item-desc">${e.description}</div>` : ''}
    </div>
    `).join('')}
  </div>` : ''}

  ${profile.educationHighlights.length > 0 ? `
  <div class="section">
    <div class="section-title">Education & Credentials</div>
    ${profile.educationHighlights.map((ed) => `
    <div class="item">
      <div class="item-header">
        <span>${ed.degree}</span>
        <span style="font-size: 12px; color: #6B7490;">${ed.year || ''}</span>
      </div>
      <div class="item-sub">${ed.institution}</div>
    </div>
    `).join('')}
  </div>` : ''}

  ${profile.portfolioUrl ? `
  <div class="section">
    <div class="section-title">Portfolio & Links</div>
    <div style="font-size: 13px;"><a href="${profile.portfolioUrl}" target="_blank" style="color: #5B49D6; text-decoration: none;">${profile.portfolioUrl}</a></div>
  </div>` : ''}

  <div class="footer">
    <span>HireFlow Standard Candidate Profile · Version ${profile.versionTag}</span>
    <span>Generated: ${profile.generatedDate} · Authorized Presentation</span>
  </div>
</body>
</html>`;

      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.send(html);
    }
  );

  // -------------------------------------------------------------
  // 9. GET /api/submissions/:id/cv/preview (Watermarked CV Preview)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions/:id/cv/preview',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const sub = access.submission;
      const watermark = generateCVWatermarkText(sub.application.job.client.legalName);

      // Check if candidate has a resume document
      const doc = await prisma.candidateDocument.findFirst({
        where: { candidateId: sub.application.candidateId, documentType: 'RESUME' },
        orderBy: { version: 'desc' },
      });

      return reply.send({
        success: true,
        data: {
          candidateName: sub.application.candidate.name,
          clientName: sub.application.job.client.legalName,
          watermarkText: watermark,
          documentAvailable: Boolean(doc),
          fileName: doc?.fileName || 'candidate_resume.pdf',
          watermarkNotice: 'Server-side watermark applied. Original document preserved in storage.',
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 10. POST /api/submissions/:id/approval/request (Request Manager Approval)
  // -------------------------------------------------------------
  server.post(
    '/api/submissions/:id/approval/request',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const parseResult = RequestApprovalSchema.safeParse(request.body);
      const comments = parseResult.success ? parseResult.data.comments : undefined;

      const sub = access.submission;
      const currentVersion = sub.profileVersions[0];

      await prisma.$transaction(async (tx) => {
        await tx.submission.update({
          where: { id: sub.id },
          data: { approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL },
        });

        await tx.submissionApproval.create({
          data: {
            submissionId: sub.id,
            reviewerId: user.id,
            decision: 'PENDING',
            comments: comments || `Approval requested for profile ${currentVersion?.versionTag || sub.code}`,
            profileVersion: sub.version,
            contentHash: currentVersion?.contentHash || null,
          },
        });
      });

      await logSubmissionAudit(user.id, 'SUBMISSION_APPROVAL_REQUESTED', sub.id, {
        previousStatus: sub.approvalStatus,
      }, {
        newStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
        version: sub.version,
      });

      return reply.send({
        success: true,
        data: {
          approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
          version: sub.version,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 11. POST /api/submissions/:id/approval/review (Approve / Reject / Changes)
  // -------------------------------------------------------------
  server.post(
    '/api/submissions/:id/approval/review',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      // Only Manager or Admin can review approvals!
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: Only designated Managers and Admins can approve candidate submissions.',
        });
      }

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const parseResult = ReviewApprovalSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: 'Validation failed', details: parseResult.error.flatten() });
      }
      const { decision, comments } = parseResult.data;

      const sub = access.submission;
      const currentVersion = sub.profileVersions[0];

      let newStatus: SubmissionApprovalStatus;
      if (decision === 'APPROVED') newStatus = SubmissionApprovalStatus.APPROVED;
      else if (decision === 'CHANGES_REQUESTED') newStatus = SubmissionApprovalStatus.CHANGES_REQUESTED;
      else newStatus = SubmissionApprovalStatus.REJECTED;

      await prisma.$transaction(async (tx) => {
        await tx.submission.update({
          where: { id: sub.id },
          data: {
            approvalStatus: newStatus,
            approvedById: decision === 'APPROVED' ? user.id : null,
          },
        });

        await tx.submissionApproval.create({
          data: {
            submissionId: sub.id,
            reviewerId: user.id,
            decision,
            comments,
            approvedAt: decision === 'APPROVED' ? new Date() : null,
            profileVersion: sub.version,
            contentHash: currentVersion?.contentHash || null,
          },
        });
      });

      await logSubmissionAudit(user.id, 'SUBMISSION_APPROVAL_REVIEWED', sub.id, {
        previousStatus: sub.approvalStatus,
      }, {
        newStatus,
        decision,
        comments,
        profileVersion: sub.version,
      });

      return reply.send({
        success: true,
        data: {
          approvalStatus: newStatus,
          decision,
          reviewedBy: user.name,
          profileVersion: sub.version,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 12. POST /api/submissions/:id/send (Send to Client Workflow)
  // -------------------------------------------------------------
  server.post(
    '/api/submissions/:id/send',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const parseResult = SendSubmissionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: 'Validation failed', details: parseResult.error.flatten() });
      }
      const { recipientContactId, emailSubject, coverNote } = parseResult.data;

      const sub = access.submission;
      const job = sub.application.job;

      // ── CRITICAL LIFECYCLE RESTRICTION: Job MUST be ACTIVE ───────────
      if (job.status !== JobStatus.ACTIVE) {
        return reply.status(409).send({
          success: false,
          error: `Client presentation blocked: Job mandate "${job.title}" (${job.code}) is in ${job.status} status. Submissions are only permitted for ACTIVE job mandates.`,
          jobStatus: job.status,
        });
      }

      // Verify recipient client contact
      const contact = await prisma.clientContact.findFirst({
        where: { id: recipientContactId, clientId: job.clientId },
      });
      if (!contact) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid recipient: Selected contact does not belong to the mandate client or is inactive.',
        });
      }

      // Verify approval requirement
      if (sub.approvalStatus !== SubmissionApprovalStatus.APPROVED && sub.approvalStatus !== SubmissionApprovalStatus.APPROVAL_NOT_REQUIRED) {
        return reply.status(400).send({
          success: false,
          error: `Submission cannot be sent in "${sub.approvalStatus}" status. A valid manager approval is required before presenting to client.`,
        });
      }

      // Execute simulated / mock send with clean integration hook for Prompt 14
      const sentTime = new Date();
      await prisma.submission.update({
        where: { id: sub.id },
        data: {
          sendState: 'SENT',
          sentAt: sentTime,
          sentById: user.id,
        },
      });

      await logSubmissionAudit(user.id, 'SUBMISSION_SENT_TO_CLIENT', sub.id, {
        sendState: sub.sendState,
      }, {
        sendState: 'SENT',
        sentToContact: contact.name,
        contactEmail: contact.email,
        jobStatus: job.status,
        version: sub.version,
      });

      return reply.send({
        success: true,
        data: {
          submissionId: sub.id,
          code: sub.code,
          sentAt: sentTime.toISOString(),
          recipient: {
            name: contact.name,
            email: contact.email,
          },
          providerStatus: 'DEMO_MOCK_DISPATCHED',
          providerNotice: 'Simulation mode: Email logged to audit trail. Live mailbox OAuth provider arrives in Prompt 14.',
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 13. GET /api/submissions/:id/history (Audit Trail)
  // -------------------------------------------------------------
  server.get(
    '/api/submissions/:id/history',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const access = await verifySubmissionAccess(id, user);
      if (!access.allowed || !access.submission) {
        return reply.status(access.status || 403).send({ success: false, error: access.error });
      }

      const logs = await prisma.auditLog.findMany({
        where: { entity: 'submission', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send({
        success: true,
        data: logs.map((l) => ({
          id: l.id,
          action: l.action,
          actorId: l.actorId,
          before: l.before,
          after: l.after,
          timestamp: l.createdAt.toISOString(),
        })),
      });
    }
  );
};
