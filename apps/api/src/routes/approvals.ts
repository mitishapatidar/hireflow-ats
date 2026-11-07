import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  JobStatus,
  SubmissionApprovalStatus,
  assertNotSelfApproval,
  validateSubmissionAgainstClientRules,
  buildClientFacingProfile,
} from '@hireflow/shared';

export const approvalRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Verify Manager or Admin role
  function requireManagerOrAdmin(user: any, reply: any): user is NonNullable<any> {
    if (!user) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return false;
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
      reply.status(403).send({
        success: false,
        error: 'Forbidden: Approval Center is restricted to designated Managers and Administrators.',
      });
      return false;
    }
    return true;
  }

  // Helper: Get subordinate recruiter user IDs for manager scoping
  async function getSubordinateUserIds(managerId: string, organizationId: string): Promise<string[]> {
    const direct = await prisma.user.findMany({
      where: { managerId, organizationId },
      select: { id: true },
    });
    const directIds = direct.map((u) => u.id);
    const allSubordinateIds = new Set<string>(directIds);

    let currentLayer = directIds;
    while (currentLayer.length > 0) {
      const nextLayer = await prisma.user.findMany({
        where: { managerId: { in: currentLayer }, organizationId },
        select: { id: true },
      });
      const nextIds = nextLayer.map((u) => u.id).filter((id) => !allSubordinateIds.has(id));
      for (const id of nextIds) {
        allSubordinateIds.add(id);
      }
      currentLayer = nextIds;
    }
    return Array.from(allSubordinateIds);
  }

  // Helper: Audit logger
  async function logApprovalAudit(
    actorId: string,
    action: string,
    entity: 'submission' | 'job',
    entityId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null
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
          ipAddress: '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log approval audit event');
    }
  }

  // -------------------------------------------------------------
  // 1. GET /api/approvals (List Pending Submissions & Jobs)
  // -------------------------------------------------------------
  server.get(
    '/',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const query = request.query as {
        type?: string;
        tab?: string;
        search?: string;
        page?: string;
        limit?: string;
      };

      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.max(1, Math.min(50, parseInt(query.limit || '20', 10)));
      const tab = query.tab || 'submissions'; // 'submissions' | 'jobs' | 'changes_requested' | 'history'

      let subordinateIds: string[] | null = null;
      if (user.role === UserRole.MANAGER) {
        subordinateIds = await getSubordinateUserIds(user.id, user.organizationId);
      }

      if (tab === 'submissions') {
        const where: Prisma.SubmissionWhereInput = {
          application: {
            job: {
              organizationId: user.organizationId,
              isArchived: false,
            },
          },
          approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
          isArchived: false,
        };

        if (subordinateIds !== null) {
          (where as any).application = {
            ...where.application,
            OR: [
              { candidate: { ownerId: { in: subordinateIds } } },
              { job: { ownerId: { in: subordinateIds }, organizationId: user.organizationId } },
              { createdById: { in: subordinateIds } },
            ],
          };
        }

        if (query.search) {
          const s = query.search.trim();
          where.OR = [
            { code: { contains: s, mode: 'insensitive' } },
            { application: { candidate: { name: { contains: s, mode: 'insensitive' } } } },
            { application: { job: { title: { contains: s, mode: 'insensitive' } } } },
            { application: { job: { client: { legalName: { contains: s, mode: 'insensitive' } } } } },
          ];
        }

        const [submissions, total] = await Promise.all([
          prisma.submission.findMany({
            where,
            include: {
              application: {
                include: {
                  candidate: { select: { id: true, name: true, code: true, currentTitle: true, currentCompany: true, location: true, ownerId: true } },
                  job: {
                    select: {
                      id: true,
                      code: true,
                      title: true,
                      ownerId: true,
                      client: { select: { id: true, legalName: true, code: true } },
                    },
                  },
                },
              },
              profileVersions: {
                where: { isCurrent: true },
                include: { createdBy: { select: { id: true, name: true, email: true } } },
                take: 1,
              },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.submission.count({ where }),
        ]);

        return reply.send({
          success: true,
          data: {
            items: submissions.map((sub) => ({
              id: sub.id,
              code: sub.code,
              type: 'SUBMISSION',
              candidateName: sub.application.candidate.name,
              candidateCode: sub.application.candidate.code,
              candidateTitle: sub.application.candidate.currentTitle,
              candidateCompany: sub.application.candidate.currentCompany,
              candidateLocation: sub.application.candidate.location,
              jobTitle: sub.application.job.title,
              jobCode: sub.application.job.code,
              clientName: sub.application.job.client.legalName,
              submittedBy: sub.profileVersions[0]?.createdBy?.name || 'Recruiter',
              submittedById: sub.profileVersions[0]?.createdBy?.id || sub.createdById || '',
              submittedAt: sub.createdAt.toISOString(),
              version: sub.version,
              approvalStatus: sub.approvalStatus,
              isSelfSubmission: sub.createdById === user.id || sub.application.job.ownerId === user.id,
            })),
            total,
            page,
            limit,
          },
        });
      }

      if (tab === 'jobs') {
        const where: Prisma.JobWhereInput = {
          organizationId: user.organizationId,
          status: JobStatus.PENDING_APPROVAL as any,
          isArchived: false,
        };

        if (subordinateIds !== null) {
          where.OR = [
            { ownerId: { in: subordinateIds } },
            { createdById: { in: subordinateIds } },
          ];
        }

        if (query.search) {
          const s = query.search.trim();
          where.OR = [
            { code: { contains: s, mode: 'insensitive' } },
            { title: { contains: s, mode: 'insensitive' } },
            { client: { legalName: { contains: s, mode: 'insensitive' } } },
          ];
        }

        const [jobs, total] = await Promise.all([
          prisma.job.findMany({
            where,
            include: {
              client: { select: { id: true, legalName: true, code: true } },
              owner: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.job.count({ where }),
        ]);

        return reply.send({
          success: true,
          data: {
            items: jobs.map((j) => ({
              id: j.id,
              code: j.code,
              type: 'JOB',
              title: j.title,
              clientName: j.client.legalName,
              ownerName: j.owner?.name || 'Unassigned',
              ownerId: j.ownerId,
              openings: j.openings,
              employmentType: j.employmentType,
              location: j.location,
              salaryMin: j.salaryMin ? Number(j.salaryMin) : null,
              salaryMax: j.salaryMax ? Number(j.salaryMax) : null,
              status: j.status,
              createdAt: j.createdAt.toISOString(),
              isSelfSubmission: j.ownerId === user.id || j.createdById === user.id,
            })),
            total,
            page,
            limit,
          },
        });
      }

      if (tab === 'changes_requested') {
        const [submissions, jobs] = await Promise.all([
          prisma.submission.findMany({
            where: {
              application: { job: { organizationId: user.organizationId } },
              approvalStatus: SubmissionApprovalStatus.CHANGES_REQUESTED,
              isArchived: false,
            },
            include: {
              application: {
                include: {
                  candidate: { select: { id: true, name: true, code: true } },
                  job: { select: { id: true, code: true, title: true, client: { select: { legalName: true } } } },
                },
              },
              profileVersions: {
                where: { isCurrent: true },
                include: { createdBy: { select: { name: true } } },
                take: 1,
              },
              approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
            orderBy: { updatedAt: 'desc' },
            take: limit,
          }),
          prisma.jobApproval.findMany({
            where: {
              decision: 'CHANGES_REQUESTED',
              job: { organizationId: user.organizationId },
            },
            include: {
              job: {
                include: {
                  client: { select: { legalName: true } },
                  owner: { select: { name: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
        ]);

        const items = [
          ...submissions.map((s) => ({
            id: s.id,
            code: s.code,
            type: 'SUBMISSION',
            candidateName: s.application.candidate.name,
            jobTitle: s.application.job.title,
            clientName: s.application.job.client.legalName,
            submittedBy: s.profileVersions[0]?.createdBy?.name || 'Recruiter',
            comments: s.approvals[0]?.comments || 'Changes requested',
            requestedAt: s.approvals[0]?.createdAt?.toISOString() || s.updatedAt.toISOString(),
          })),
          ...jobs.map((ja) => ({
            id: ja.job.id,
            code: ja.job.code,
            type: 'JOB',
            jobTitle: ja.job.title,
            clientName: ja.job.client.legalName,
            submittedBy: ja.job.owner?.name || 'Recruiter',
            comments: ja.comments || 'Changes requested',
            requestedAt: ja.createdAt.toISOString(),
          })),
        ];

        return reply.send({
          success: true,
          data: {
            items,
            total: items.length,
            page: 1,
            limit,
          },
        });
      }

      return reply.send({ success: true, data: { items: [], total: 0, page, limit } });
    }
  );

  // -------------------------------------------------------------
  // 2. GET /api/approvals/submissions/:id (Detailed Review Data)
  // -------------------------------------------------------------
  server.get(
    '/submissions/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };

      const submission = await prisma.submission.findUnique({
        where: { id },
        include: {
          application: {
            include: {
              candidate: {
                include: {
                  documents: {
                    orderBy: { createdAt: 'desc' },
                  },
                },
              },
              job: {
                include: {
                  client: {
                    include: {
                      workflows: {
                        where: { status: 'PUBLISHED' },
                        include: {
                          submissionRules: { take: 1 },
                          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
                          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
                        },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
          profileVersions: {
            where: { isCurrent: true },
            include: { createdBy: { select: { id: true, name: true, email: true } } },
            take: 1,
          },
          approvals: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!submission || submission.isArchived) {
        return reply.status(404).send({ success: false, error: 'Submission not found' });
      }

      if (submission.application.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Submission not found in your organization.' });
      }

      const activeWorkflow = submission.application.job.client.workflows[0] || null;
      const subRule = activeWorkflow?.submissionRules?.[0] || null;
      const currentProfileVersion = submission.profileVersions[0] || null;
      const resumeDoc = submission.application.candidate.documents.find((d) => d.documentType === 'RESUME') || null;

      // Rule validation
      const ruleEvaluation = validateSubmissionAgainstClientRules({
        candidate: {
          id: submission.application.candidate.id,
          fullName: submission.application.candidate.name,
          headline: submission.application.candidate.currentTitle,
          summary: currentProfileVersion?.summary,
          coreSkills: (currentProfileVersion?.selectedSkills as string[]) || submission.application.candidate.skills,
          expectedSalary: submission.application.candidate.expectedSalary ? Number(submission.application.candidate.expectedSalary) : null,
          noticePeriod: submission.application.candidate.noticePeriod,
          consentGiven: Boolean(submission.application.candidate.consentRecordedAt),
          hasCv: Boolean(resumeDoc),
          portfolioUrl: currentProfileVersion?.portfolioUrl,
        },
        submission: {
          id: submission.id,
          portfolioUrl: currentProfileVersion?.portfolioUrl,
          standardProfileVersion: currentProfileVersion?.versionTag,
        },
        rules: subRule
          ? {
              requireCompleteProfile: subRule.requireCompleteProfile,
              requireCvDocument: subRule.requireCvDocument,
              requirePortfolioUrl: subRule.requirePortfolioUrl,
              requireExpectedSalary: subRule.requireExpectedSalary,
              requireNoticePeriod: subRule.requireNoticePeriod,
              requireCandidateConsent: subRule.requireCandidateConsent,
            }
          : null,
        workflowVersion: activeWorkflow?.version || 1,
      });

      // Build sanitized standard profile preview
      const clientFacingProfile = currentProfileVersion
        ? buildClientFacingProfile(currentProfileVersion.contentSnapshot as any)
        : null;

      const isSelfSubmission =
        submission.createdById === user.id ||
        submission.application.job.ownerId === user.id ||
        submission.application.candidate.ownerId === user.id;

      return reply.send({
        success: true,
        data: {
          submission: {
            id: submission.id,
            code: submission.code,
            version: submission.version,
            approvalStatus: submission.approvalStatus,
            format: submission.standardProfileVersion,
            createdAt: submission.createdAt.toISOString(),
            submittedBy: currentProfileVersion?.createdBy?.name || 'Recruiter',
            submittedById: currentProfileVersion?.createdBy?.id || submission.createdById || '',
          },
          candidate: {
            id: submission.application.candidate.id,
            name: submission.application.candidate.name,
            code: submission.application.candidate.code,
            currentTitle: submission.application.candidate.currentTitle,
            currentCompany: submission.application.candidate.currentCompany,
            location: submission.application.candidate.location,
            expectedSalary: submission.application.candidate.expectedSalary ? Number(submission.application.candidate.expectedSalary) : null,
            noticePeriod: submission.application.candidate.noticePeriod,
            consentGiven: Boolean(submission.application.candidate.consentRecordedAt),
          },
          job: {
            id: submission.application.job.id,
            code: submission.application.job.code,
            title: submission.application.job.title,
            status: submission.application.job.status,
            clientName: submission.application.job.client.legalName,
            clientId: submission.application.job.clientId,
          },
          workflow: activeWorkflow
            ? {
                id: activeWorkflow.id,
                version: activeWorkflow.version,
                status: activeWorkflow.status,
              }
            : null,
          ruleValidation: ruleEvaluation,
          profilePreview: clientFacingProfile,
          cvDocument: resumeDoc
            ? {
                id: resumeDoc.id,
                fileName: resumeDoc.fileName,
                fileUrl: resumeDoc.fileUrl,
                uploadedAt: resumeDoc.createdAt.toISOString(),
              }
            : null,
          isSelfSubmission,
          approvalHistory: submission.approvals.map((a) => ({
            id: a.id,
            reviewerName: (a as any).reviewer?.name || a.reviewerId || 'Manager',
            decision: a.decision,
            comments: a.comments,
            approvedAt: a.approvedAt?.toISOString() || null,
            createdAt: a.createdAt.toISOString(),
            isInvalidated: a.isInvalidated,
            invalidationReason: a.invalidationReason,
            profileVersion: a.profileVersion,
          })),
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 3. POST /api/approvals/submissions/:id/approve
  // -------------------------------------------------------------
  server.post(
    '/submissions/:id/approve',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };

      const sub = await prisma.submission.findUnique({
        where: { id },
        include: {
          application: {
            include: {
              candidate: {
                include: {
                  documents: { where: { documentType: 'RESUME' } },
                },
              },
              job: {
                include: {
                  client: {
                    include: {
                      workflows: {
                        where: { status: 'PUBLISHED' },
                        include: { submissionRules: { take: 1 } },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
          profileVersions: {
            where: { isCurrent: true },
            take: 1,
          },
        },
      });

      if (!sub || sub.isArchived) {
        return reply.status(404).send({ success: false, error: 'Submission not found' });
      }

      if (sub.application.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Submission not found in your organization.' });
      }

      // ── STRICT SERVER-SIDE SELF-APPROVAL GUARD ──
      try {
        assertNotSelfApproval(user.id, {
          submitterId: sub.createdById,
          ownerId: sub.application.job.ownerId,
          candidateOwnerId: sub.application.candidate.ownerId,
        });
      } catch (err: any) {
        return reply.status(403).send({
          success: false,
          error: err.message || 'Forbidden: Self-approval is strictly prevented.',
          code: 'SELF_APPROVAL_FORBIDDEN',
        });
      }

      const activeWorkflow = sub.application.job.client.workflows[0] || null;
      const subRule = activeWorkflow?.submissionRules?.[0] || null;
      const currentProfileVersion = sub.profileVersions[0] || null;
      const resumeDoc = sub.application.candidate.documents[0] || null;

      // ── VALIDATE CLIENT SUBMISSION RULES ──
      const ruleEvaluation = validateSubmissionAgainstClientRules({
        candidate: {
          id: sub.application.candidate.id,
          fullName: sub.application.candidate.name,
          headline: sub.application.candidate.currentTitle,
          summary: currentProfileVersion?.summary,
          coreSkills: (currentProfileVersion?.selectedSkills as string[]) || sub.application.candidate.skills,
          expectedSalary: sub.application.candidate.expectedSalary ? Number(sub.application.candidate.expectedSalary) : null,
          noticePeriod: sub.application.candidate.noticePeriod,
          consentGiven: Boolean(sub.application.candidate.consentRecordedAt),
          hasCv: Boolean(resumeDoc),
          portfolioUrl: currentProfileVersion?.portfolioUrl,
        },
        submission: {
          id: sub.id,
          portfolioUrl: currentProfileVersion?.portfolioUrl,
          standardProfileVersion: currentProfileVersion?.versionTag,
        },
        rules: subRule
          ? {
              requireCompleteProfile: subRule.requireCompleteProfile,
              requireCvDocument: subRule.requireCvDocument,
              requirePortfolioUrl: subRule.requirePortfolioUrl,
              requireExpectedSalary: subRule.requireExpectedSalary,
              requireNoticePeriod: subRule.requireNoticePeriod,
              requireCandidateConsent: subRule.requireCandidateConsent,
            }
          : null,
        workflowVersion: activeWorkflow?.version || 1,
      });

      if (!ruleEvaluation.isValid) {
        return reply.status(400).send({
          success: false,
          error: 'Client submission rules validation failed. Review issues before approving.',
          ruleValidation: ruleEvaluation,
        });
      }

      const body = (request.body as { comments?: string }) || {};

      // Invalidate any past non-invalidated approvals and stamp exact 3-way versions
      await prisma.$transaction(async (tx) => {
        await tx.submissionApproval.updateMany({
          where: { submissionId: sub.id, isInvalidated: false },
          data: {
            isInvalidated: true,
            invalidatedAt: new Date(),
            invalidationReason: 'Superseded by new manager approval decision',
          },
        });

        await tx.submission.update({
          where: { id: sub.id },
          data: {
            approvalStatus: SubmissionApprovalStatus.APPROVED,
            approvedById: user.id,
          },
        });

        await tx.submissionApproval.create({
          data: {
            submissionId: sub.id,
            reviewerId: user.id,
            decision: 'APPROVED',
            comments: body.comments || 'Approved for client presentation',
            approvedAt: new Date(),
            profileVersion: sub.version,
            submissionVersion: sub.version,
            clientWorkflowVersion: activeWorkflow?.version || 1,
            validationSnapshot: ruleEvaluation as any,
            contentHash: currentProfileVersion?.contentHash || null,
          },
        });
      });

      await logApprovalAudit(user.id, 'SUBMISSION_APPROVED', 'submission', sub.id, {
        previousStatus: sub.approvalStatus,
      }, {
        newStatus: SubmissionApprovalStatus.APPROVED,
        profileVersion: sub.version,
        clientWorkflowVersion: activeWorkflow?.version || 1,
      });

      return reply.send({
        success: true,
        data: {
          submissionId: sub.id,
          approvalStatus: SubmissionApprovalStatus.APPROVED,
          approvedAt: new Date().toISOString(),
          approvedBy: user.name,
          profileVersion: sub.version,
          clientWorkflowVersion: activeWorkflow?.version || 1,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 4. POST /api/approvals/submissions/:id/request-changes
  // -------------------------------------------------------------
  server.post(
    '/submissions/:id/request-changes',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };
      const body = request.body as { comments?: string };

      if (!body?.comments || body.comments.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Change request comments are mandatory to guide the recruiter.',
        });
      }

      const sub = await prisma.submission.findUnique({
        where: { id },
        include: {
          application: {
            include: { candidate: true, job: true },
          },
          profileVersions: { where: { isCurrent: true }, take: 1 },
        },
      });

      if (!sub || sub.isArchived) {
        return reply.status(404).send({ success: false, error: 'Submission not found' });
      }

      if (sub.application.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Submission not found in your organization.' });
      }

      try {
        assertNotSelfApproval(user.id, {
          submitterId: sub.createdById,
          ownerId: sub.application.job.ownerId,
          candidateOwnerId: sub.application.candidate.ownerId,
        });
      } catch (err: any) {
        return reply.status(403).send({
          success: false,
          error: err.message || 'Forbidden: Self-approval is strictly prevented.',
          code: 'SELF_APPROVAL_FORBIDDEN',
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.submission.update({
          where: { id: sub.id },
          data: {
            approvalStatus: SubmissionApprovalStatus.CHANGES_REQUESTED,
          },
        });

        await tx.submissionApproval.create({
          data: {
            submissionId: sub.id,
            reviewerId: user.id,
            decision: 'CHANGES_REQUESTED',
            comments: body.comments ? body.comments.trim() : null,
            profileVersion: sub.version,
            submissionVersion: sub.version,
            contentHash: sub.profileVersions[0]?.contentHash || null,
          },
        });
      });

      await logApprovalAudit(user.id, 'SUBMISSION_CHANGES_REQUESTED', 'submission', sub.id, {
        previousStatus: sub.approvalStatus,
      }, {
        newStatus: SubmissionApprovalStatus.CHANGES_REQUESTED,
        comments: body.comments.trim(),
      });

      return reply.send({
        success: true,
        data: {
          submissionId: sub.id,
          approvalStatus: SubmissionApprovalStatus.CHANGES_REQUESTED,
          reviewedBy: user.name,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 5. POST /api/approvals/submissions/:id/reject
  // -------------------------------------------------------------
  server.post(
    '/submissions/:id/reject',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };
      const body = request.body as { comments?: string };

      if (!body?.comments || body.comments.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Rejection reason comments are mandatory.',
        });
      }

      const sub = await prisma.submission.findUnique({
        where: { id },
        include: {
          application: {
            include: { candidate: true, job: true },
          },
          profileVersions: { where: { isCurrent: true }, take: 1 },
        },
      });

      if (!sub || sub.isArchived) {
        return reply.status(404).send({ success: false, error: 'Submission not found' });
      }

      if (sub.application.job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Submission not found in your organization.' });
      }

      try {
        assertNotSelfApproval(user.id, {
          submitterId: sub.createdById,
          ownerId: sub.application.job.ownerId,
          candidateOwnerId: sub.application.candidate.ownerId,
        });
      } catch (err: any) {
        return reply.status(403).send({
          success: false,
          error: err.message || 'Forbidden: Self-approval is strictly prevented.',
          code: 'SELF_APPROVAL_FORBIDDEN',
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.submission.update({
          where: { id: sub.id },
          data: {
            approvalStatus: SubmissionApprovalStatus.REJECTED,
          },
        });

        await tx.submissionApproval.create({
          data: {
            submissionId: sub.id,
            reviewerId: user.id,
            decision: 'REJECTED',
            comments: body.comments ? body.comments.trim() : null,
            profileVersion: sub.version,
            submissionVersion: sub.version,
            contentHash: sub.profileVersions[0]?.contentHash || null,
          },
        });
      });

      await logApprovalAudit(user.id, 'SUBMISSION_REJECTED', 'submission', sub.id, {
        previousStatus: sub.approvalStatus,
      }, {
        newStatus: SubmissionApprovalStatus.REJECTED,
        comments: body.comments.trim(),
      });

      return reply.send({
        success: true,
        data: {
          submissionId: sub.id,
          approvalStatus: SubmissionApprovalStatus.REJECTED,
          reviewedBy: user.name,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 6. GET /api/approvals/jobs/:id (Job Review Data)
  // -------------------------------------------------------------
  server.get(
    '/jobs/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };

      const job = await prisma.job.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, legalName: true, code: true } },
          owner: { select: { id: true, name: true, email: true } },
          hiringManagerContact: { select: { id: true, name: true, email: true } },
          rounds: { orderBy: { roundOrder: 'asc' } },
          approvals: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!job || job.isArchived) {
        return reply.status(404).send({ success: false, error: 'Job mandate not found' });
      }

      if (job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Job not found in your organization.' });
      }

      const isSelfJob = job.ownerId === user.id || job.createdById === user.id;

      return reply.send({
        success: true,
        data: {
          job: {
            id: job.id,
            code: job.code,
            title: job.title,
            status: job.status,
            clientName: job.client.legalName,
            clientId: job.clientId,
            ownerName: job.owner?.name || 'Unassigned',
            ownerId: job.ownerId,
            openings: job.openings,
            employmentType: job.employmentType,
            location: job.location,
            salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
            salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
            description: job.description,
            requirements: job.requirements,
            deadline: job.deadline?.toISOString() || null,
            createdAt: job.createdAt.toISOString(),
          },
          rounds: job.rounds.map((r) => ({
            id: r.id,
            name: r.name,
            roundOrder: r.roundOrder,
            interviewType: r.interviewType,
            durationMinutes: r.durationMinutes,
            description: r.description,
          })),
          isSelfJob,
          approvals: job.approvals.map((a) => ({
            id: a.id,
            reviewerName: (a as any).reviewer?.name || a.reviewerId || 'Manager',
            decision: a.decision,
            comments: a.comments,
            createdAt: a.createdAt.toISOString(),
            approvedAt: a.approvedAt?.toISOString() || null,
          })),
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 7. POST /api/approvals/jobs/:id/approve (Approve Job Mandate)
  // -------------------------------------------------------------
  server.post(
    '/jobs/:id/approve',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };

      const job = await prisma.job.findUnique({
        where: { id },
      });

      if (!job || job.isArchived) {
        return reply.status(404).send({ success: false, error: 'Job mandate not found' });
      }

      if (job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Job not found in your organization.' });
      }

      // Self-approval check
      if (job.ownerId === user.id || job.createdById === user.id) {
        return reply.status(403).send({
          success: false,
          error: 'Self-approval is strictly prevented. Managers cannot approve job mandates they created or own.',
          code: 'SELF_APPROVAL_FORBIDDEN',
        });
      }

      if (job.status !== (JobStatus.PENDING_APPROVAL as any)) {
        return reply.status(409).send({
          success: false,
          error: `Job cannot be approved from current status "${job.status}". Must be in PENDING_APPROVAL.`,
        });
      }

      const body = (request.body as { comments?: string }) || {};

      await prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: job.id },
          data: { status: JobStatus.ACTIVE as any },
        });

        await tx.jobApproval.create({
          data: {
            jobId: job.id,
            reviewerId: user.id,
            decision: 'APPROVED',
            comments: body.comments || 'Job mandate approved and activated.',
            approvedAt: new Date(),
          },
        });

        await tx.jobStatusHistory.create({
          data: {
            jobId: job.id,
            previousStatus: JobStatus.PENDING_APPROVAL as any,
            newStatus: JobStatus.ACTIVE as any,
            changedById: user.id,
            reason: 'MANAGER_APPROVAL',
            note: body.comments || 'Approved in Approval Center',
            createdById: user.id,
          },
        });
      });

      await logApprovalAudit(user.id, 'JOB_APPROVED', 'job', job.id, {
        previousStatus: job.status,
      }, {
        newStatus: JobStatus.ACTIVE,
        comments: body.comments,
      });

      return reply.send({
        success: true,
        data: {
          jobId: job.id,
          status: JobStatus.ACTIVE,
          approvedBy: user.name,
          approvedAt: new Date().toISOString(),
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 8. POST /api/approvals/jobs/:id/request-changes
  // -------------------------------------------------------------
  server.post(
    '/jobs/:id/request-changes',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };
      const body = request.body as { comments?: string };

      if (!body?.comments || body.comments.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Change request comments are mandatory for job review.',
        });
      }

      const job = await prisma.job.findUnique({
        where: { id },
      });

      if (!job || job.isArchived) {
        return reply.status(404).send({ success: false, error: 'Job mandate not found' });
      }

      if (job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Job not found in your organization.' });
      }

      if (job.ownerId === user.id || job.createdById === user.id) {
        return reply.status(403).send({
          success: false,
          error: 'Self-approval is strictly prevented.',
          code: 'SELF_APPROVAL_FORBIDDEN',
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: job.id },
          data: { status: JobStatus.DRAFT as any },
        });

        await tx.jobApproval.create({
          data: {
            jobId: job.id,
            reviewerId: user.id,
            decision: 'CHANGES_REQUESTED',
            comments: body.comments ? body.comments.trim() : null,
          },
        });

        await tx.jobStatusHistory.create({
          data: {
            jobId: job.id,
            previousStatus: job.status as any,
            newStatus: JobStatus.DRAFT as any,
            changedById: user.id,
            reason: 'CHANGES_REQUESTED',
            note: body.comments ? body.comments.trim() : null,
            createdById: user.id,
          },
        });
      });

      await logApprovalAudit(user.id, 'JOB_CHANGES_REQUESTED', 'job', job.id, {
        previousStatus: job.status,
      }, {
        newStatus: JobStatus.DRAFT,
        comments: body.comments.trim(),
      });

      return reply.send({
        success: true,
        data: {
          jobId: job.id,
          status: JobStatus.DRAFT,
          reviewedBy: user.name,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 9. POST /api/approvals/jobs/:id/reject
  // -------------------------------------------------------------
  server.post(
    '/jobs/:id/reject',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { id } = request.params as { id: string };
      const body = request.body as { comments?: string };

      if (!body?.comments || body.comments.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Rejection reason is mandatory.',
        });
      }

      const job = await prisma.job.findUnique({
        where: { id },
      });

      if (!job || job.isArchived) {
        return reply.status(404).send({ success: false, error: 'Job mandate not found' });
      }

      if (job.organizationId !== user.organizationId) {
        return reply.status(404).send({ success: false, error: 'Job not found in your organization.' });
      }

      if (job.ownerId === user.id || job.createdById === user.id) {
        return reply.status(403).send({
          success: false,
          error: 'Self-approval is strictly prevented.',
          code: 'SELF_APPROVAL_FORBIDDEN',
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.CLOSED as any,
            closingReason: 'REJECTED_BY_MANAGER',
            closingNote: body.comments ? body.comments.trim() : null,
          },
        });

        await tx.jobApproval.create({
          data: {
            jobId: job.id,
            reviewerId: user.id,
            decision: 'REJECTED',
            comments: body.comments ? body.comments.trim() : null,
          },
        });

        await tx.jobStatusHistory.create({
          data: {
            jobId: job.id,
            previousStatus: job.status as any,
            newStatus: JobStatus.CLOSED as any,
            changedById: user.id,
            reason: 'REJECTED_BY_MANAGER',
            note: body.comments ? body.comments.trim() : null,
            createdById: user.id,
          },
        });
      });

      await logApprovalAudit(user.id, 'JOB_REJECTED', 'job', job.id, {
        previousStatus: job.status,
      }, {
        newStatus: JobStatus.CLOSED,
        comments: body.comments.trim(),
      });

      return reply.send({
        success: true,
        data: {
          jobId: job.id,
          status: JobStatus.CLOSED,
          reviewedBy: user.name,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 10. GET /api/approvals/history (Immutable Decision Audit Trail)
  // -------------------------------------------------------------
  server.get(
    '/history',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user!;
      if (!requireManagerOrAdmin(user, reply)) return;

      const query = request.query as { page?: string; limit?: string };
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.max(1, Math.min(50, parseInt(query.limit || '20', 10)));

      const [submissionApprovals, jobApprovals] = await Promise.all([
        prisma.submissionApproval.findMany({
          where: {
            submission: {
              application: { job: { organizationId: user.organizationId } },
            },
          },
          include: {
            submission: {
              include: {
                application: {
                  include: {
                    candidate: { select: { name: true, code: true } },
                    job: { select: { title: true, code: true, client: { select: { legalName: true } } } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.jobApproval.findMany({
          where: {
            job: { organizationId: user.organizationId },
          },
          include: {
            job: {
              include: {
                client: { select: { legalName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ]);

      const history = [
        ...submissionApprovals.map((sa) => ({
          id: sa.id,
          type: 'SUBMISSION_APPROVAL',
          targetCode: sa.submission.code,
          targetTitle: `${sa.submission.application.candidate.name} → ${sa.submission.application.job.title}`,
          clientName: sa.submission.application.job.client.legalName,
          reviewerName: (sa as any).reviewer?.name || sa.reviewerId || 'Manager',
          decision: sa.decision,
          comments: sa.comments,
          approvedAt: sa.approvedAt?.toISOString() || null,
          createdAt: sa.createdAt.toISOString(),
          isInvalidated: sa.isInvalidated,
          invalidationReason: sa.invalidationReason,
          profileVersion: sa.profileVersion,
        })),
        ...jobApprovals.map((ja) => ({
          id: ja.id,
          type: 'JOB_APPROVAL',
          targetCode: ja.job.code,
          targetTitle: ja.job.title,
          clientName: ja.job.client.legalName,
          reviewerName: (ja as any).reviewer?.name || ja.reviewerId || 'Manager',
          decision: ja.decision,
          comments: ja.comments,
          approvedAt: ja.approvedAt?.toISOString() || null,
          createdAt: ja.createdAt.toISOString(),
          isInvalidated: ja.isInvalidated,
          invalidationReason: ja.invalidationReason,
          profileVersion: ja.jobVersion,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return reply.send({
        success: true,
        data: {
          items: history.slice(0, limit),
          total: history.length,
          page,
          limit,
        },
      });
    }
  );
};
