'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  JobStatus,
  SubmissionApprovalStatus,
  assertNotSelfApproval,
  validateSubmissionAgainstClientRules,
  buildClientFacingProfile,
} from '@hireflow/shared';

// Helper: Require Manager or Admin
function assertManagerOrAdmin(user: any) {
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    throw new Error('Forbidden: Approval Center is restricted to designated Managers and Administrators.');
  }
}

// Helper: Subordinate resolution
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

export async function getApprovalsAction(params?: {
  tab?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const tab = params?.tab || 'submissions';
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(50, params?.limit || 20));

    let subordinateIds: string[] | null = null;
    if (user!.role === UserRole.MANAGER) {
      subordinateIds = await getSubordinateUserIds(user!.id, user!.organizationId);
    }

    if (tab === 'submissions') {
      const where: Prisma.SubmissionWhereInput = {
        application: {
          job: {
            organizationId: user!.organizationId,
            isArchived: false,
          },
        },
        approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
        isArchived: false,
      };

      const andConditions: Prisma.SubmissionWhereInput[] = [];

      if (subordinateIds !== null) {
        andConditions.push({
          OR: [
            { application: { candidate: { ownerId: { in: subordinateIds } } } },
            { application: { job: { ownerId: { in: subordinateIds } } } },
            { createdById: { in: subordinateIds } },
          ],
        });
      }

      if (params?.search) {
        const s = params.search.trim();
        andConditions.push({
          OR: [
            { code: { contains: s, mode: 'insensitive' } },
            { application: { candidate: { name: { contains: s, mode: 'insensitive' } } } },
            { application: { job: { title: { contains: s, mode: 'insensitive' } } } },
            { application: { job: { client: { legalName: { contains: s, mode: 'insensitive' } } } } },
          ],
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
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

      return {
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
            isSelfSubmission: sub.createdById === user!.id || sub.application.job.ownerId === user!.id,
          })),
          total,
          page,
          limit,
        },
      };
    }

    if (tab === 'jobs') {
      const where: Prisma.JobWhereInput = {
        organizationId: user!.organizationId,
        status: JobStatus.PENDING_APPROVAL as any,
        isArchived: false,
      };

      const andConditions: Prisma.JobWhereInput[] = [];

      if (subordinateIds !== null) {
        andConditions.push({
          OR: [
            { ownerId: { in: subordinateIds } },
            { createdById: { in: subordinateIds } },
          ],
        });
      }

      if (params?.search) {
        const s = params.search.trim();
        andConditions.push({
          OR: [
            { code: { contains: s, mode: 'insensitive' } },
            { title: { contains: s, mode: 'insensitive' } },
            { client: { legalName: { contains: s, mode: 'insensitive' } } },
          ],
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
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

      return {
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
            isSelfSubmission: j.ownerId === user!.id || j.createdById === user!.id,
          })),
          total,
          page,
          limit,
        },
      };
    }

    if (tab === 'changes_requested') {
      const [submissions, jobs] = await Promise.all([
        prisma.submission.findMany({
          where: {
            application: { job: { organizationId: user!.organizationId } },
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
            job: { organizationId: user!.organizationId },
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

      return {
        success: true,
        data: {
          items,
          total: items.length,
          page: 1,
          limit,
        },
      };
    }

    return { success: true, data: { items: [], total: 0, page, limit } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch approvals' };
  }
}

export async function getSubmissionReviewDataAction(id: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            candidate: {
              include: {
                documents: { orderBy: { createdAt: 'desc' } },
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
      return { success: false, error: 'Submission not found' };
    }

    if (submission.application.job.organizationId !== user!.organizationId) {
      return { success: false, error: 'Submission not found in your organization.' };
    }

    const activeWorkflow = submission.application.job.client.workflows[0] || null;
    const subRule = activeWorkflow?.submissionRules?.[0] || null;
    const currentProfileVersion = submission.profileVersions[0] || null;
    const resumeDoc = submission.application.candidate.documents.find((d) => d.documentType === 'RESUME') || null;

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

    const clientFacingProfile = currentProfileVersion
      ? buildClientFacingProfile(currentProfileVersion.contentSnapshot as any)
      : null;

    const reviewerIds = Array.from(new Set(submission.approvals.map((a) => a.reviewerId)));
    const reviewers = reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
    const reviewerMap = new Map(reviewers.map((r) => [r.id, r.name]));

    const isSelfSubmission =
      submission.createdById === user!.id ||
      submission.application.job.ownerId === user!.id ||
      submission.application.candidate.ownerId === user!.id;

    return {
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
          reviewerName: reviewerMap.get(a.reviewerId) || 'Manager',
          decision: a.decision,
          comments: a.comments,
          approvedAt: a.approvedAt?.toISOString() || null,
          createdAt: a.createdAt.toISOString(),
          isInvalidated: a.isInvalidated,
          invalidationReason: a.invalidationReason,
          profileVersion: a.profileVersion,
        })),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to retrieve submission review' };
  }
}

export async function approveSubmissionAction(id: string, comments?: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

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
      return { success: false, error: 'Submission not found' };
    }

    if (sub.application.job.organizationId !== user!.organizationId) {
      return { success: false, error: 'Submission not found in your organization.' };
    }

    // Server-side self approval guard
    assertNotSelfApproval({
      reviewerId: user!.id,
      submitterId: sub.createdById,
      ownerId: sub.application.job.ownerId,
      candidateOwnerId: sub.application.candidate.ownerId,
    });

    const activeWorkflow = sub.application.job.client.workflows[0] || null;
    const subRule = activeWorkflow?.submissionRules?.[0] || null;
    const currentProfileVersion = sub.profileVersions[0] || null;
    const resumeDoc = sub.application.candidate.documents[0] || null;

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

    if (!ruleEvaluation.isValid && !ruleEvaluation.allPassed) {
      return {
        success: false,
        error: 'Client submission rules validation failed. Review issues before approving.',
        ruleValidation: ruleEvaluation,
      };
    }

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
          approvedById: user!.id,
        },
      });

      await tx.submissionApproval.create({
        data: {
          submissionId: sub.id,
          reviewerId: user!.id,
          decision: 'APPROVED',
          comments: comments || 'Approved for client presentation',
          approvedAt: new Date(),
          profileVersion: sub.version,
          submissionVersion: sub.version,
          clientWorkflowVersion: activeWorkflow?.version || 1,
          validationSnapshot: ruleEvaluation as any,
          contentHash: currentProfileVersion?.contentHash || null,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        actorId: user!.id,
        action: 'SUBMISSION_APPROVED',
        entity: 'submission',
        entityId: sub.id,
        before: { previousStatus: sub.approvalStatus },
        after: { newStatus: SubmissionApprovalStatus.APPROVED, profileVersion: sub.version },
        ipAddress: '127.0.0.1',
      },
    });

    revalidatePath('/approvals');
    revalidatePath('/manager');
    return {
      success: true,
      data: {
        submissionId: sub.id,
        approvalStatus: SubmissionApprovalStatus.APPROVED,
        approvedAt: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to approve submission' };
  }
}

export async function requestSubmissionChangesAction(id: string, comments: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    if (!comments || comments.trim().length === 0) {
      return { success: false, error: 'Change request comments are mandatory to guide the recruiter.' };
    }

    const sub = await prisma.submission.findUnique({
      where: { id },
      include: {
        application: { include: { candidate: true, job: true } },
        profileVersions: { where: { isCurrent: true }, take: 1 },
      },
    });

    if (!sub || sub.isArchived) return { success: false, error: 'Submission not found' };
    if (sub.application.job.organizationId !== user!.organizationId) return { success: false, error: 'Unauthorized' };

    assertNotSelfApproval({
      reviewerId: user!.id,
      submitterId: sub.createdById,
      ownerId: sub.application.job.ownerId,
      candidateOwnerId: sub.application.candidate.ownerId,
    });

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: sub.id },
        data: { approvalStatus: SubmissionApprovalStatus.CHANGES_REQUESTED },
      });

      await tx.submissionApproval.create({
        data: {
          submissionId: sub.id,
          reviewerId: user!.id,
          decision: 'CHANGES_REQUESTED',
          comments: comments.trim(),
          profileVersion: sub.version,
          submissionVersion: sub.version,
          contentHash: sub.profileVersions[0]?.contentHash || null,
        },
      });
    });

    revalidatePath('/approvals');
    revalidatePath('/manager');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to request changes' };
  }
}

export async function rejectSubmissionAction(id: string, comments: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    if (!comments || comments.trim().length === 0) {
      return { success: false, error: 'Rejection reason comments are mandatory.' };
    }

    const sub = await prisma.submission.findUnique({
      where: { id },
      include: {
        application: { include: { candidate: true, job: true } },
        profileVersions: { where: { isCurrent: true }, take: 1 },
      },
    });

    if (!sub || sub.isArchived) return { success: false, error: 'Submission not found' };
    if (sub.application.job.organizationId !== user!.organizationId) return { success: false, error: 'Unauthorized' };

    assertNotSelfApproval({
      reviewerId: user!.id,
      submitterId: sub.createdById,
      ownerId: sub.application.job.ownerId,
      candidateOwnerId: sub.application.candidate.ownerId,
    });

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: sub.id },
        data: { approvalStatus: SubmissionApprovalStatus.REJECTED },
      });

      await tx.submissionApproval.create({
        data: {
          submissionId: sub.id,
          reviewerId: user!.id,
          decision: 'REJECTED',
          comments: comments.trim(),
          profileVersion: sub.version,
          submissionVersion: sub.version,
          contentHash: sub.profileVersions[0]?.contentHash || null,
        },
      });
    });

    revalidatePath('/approvals');
    revalidatePath('/manager');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject submission' };
  }
}

export async function approveJobAction(id: string, comments?: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || job.isArchived) return { success: false, error: 'Job mandate not found' };
    if (job.organizationId !== user!.organizationId) return { success: false, error: 'Unauthorized' };

    if (job.ownerId === user!.id || job.createdById === user!.id) {
      return { success: false, error: 'Self-approval is strictly prevented. Managers cannot approve job mandates they created or own.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: { status: JobStatus.ACTIVE as any },
      });

      await tx.jobApproval.create({
        data: {
          jobId: job.id,
          reviewerId: user!.id,
          decision: 'APPROVED',
          comments: comments || 'Job mandate approved and activated.',
          approvedAt: new Date(),
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: job.id,
          previousStatus: JobStatus.PENDING_APPROVAL as any,
          newStatus: JobStatus.ACTIVE as any,
          changedById: user!.id,
          reason: 'MANAGER_APPROVAL',
          note: comments || 'Approved in Approval Center',
          createdById: user!.id,
        },
      });
    });

    revalidatePath('/approvals');
    revalidatePath('/manager');
    revalidatePath('/jobs');
    return { success: true, data: { status: JobStatus.ACTIVE } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to approve job' };
  }
}

export async function requestJobChangesAction(id: string, comments: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    if (!comments || comments.trim().length === 0) {
      return { success: false, error: 'Change request comments are mandatory.' };
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || job.isArchived) return { success: false, error: 'Job mandate not found' };
    if (job.organizationId !== user!.organizationId) return { success: false, error: 'Unauthorized' };

    if (job.ownerId === user!.id || job.createdById === user!.id) {
      return { success: false, error: 'Self-approval is strictly prevented.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: { status: JobStatus.DRAFT as any },
      });

      await tx.jobApproval.create({
        data: {
          jobId: job.id,
          reviewerId: user!.id,
          decision: 'CHANGES_REQUESTED',
          comments: comments.trim(),
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: job.id,
          previousStatus: job.status as any,
          newStatus: JobStatus.DRAFT as any,
          changedById: user!.id,
          reason: 'CHANGES_REQUESTED',
          note: comments.trim(),
          createdById: user!.id,
        },
      });
    });

    revalidatePath('/approvals');
    revalidatePath('/manager');
    revalidatePath('/jobs');
    return { success: true, data: { status: JobStatus.DRAFT } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to request changes on job' };
  }
}

export async function rejectJobAction(id: string, comments: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    if (!comments || comments.trim().length === 0) {
      return { success: false, error: 'Rejection reason is mandatory.' };
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || job.isArchived) return { success: false, error: 'Job mandate not found' };
    if (job.organizationId !== user!.organizationId) return { success: false, error: 'Unauthorized' };

    if (job.ownerId === user!.id || job.createdById === user!.id) {
      return { success: false, error: 'Self-approval is strictly prevented.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.CLOSED as any,
          closingReason: 'REJECTED_BY_MANAGER',
          closingNote: comments.trim(),
        },
      });

      await tx.jobApproval.create({
        data: {
          jobId: job.id,
          reviewerId: user!.id,
          decision: 'REJECTED',
          comments: comments.trim(),
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: job.id,
          previousStatus: job.status as any,
          newStatus: JobStatus.CLOSED as any,
          changedById: user!.id,
          reason: 'REJECTED_BY_MANAGER',
          note: comments.trim(),
          createdById: user!.id,
        },
      });
    });

    revalidatePath('/approvals');
    revalidatePath('/manager');
    revalidatePath('/jobs');
    return { success: true, data: { status: JobStatus.CLOSED } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject job' };
  }
}

export async function getApprovalHistoryAction(page = 1, limit = 20) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const [submissionApprovals, jobApprovals] = await Promise.all([
      prisma.submissionApproval.findMany({
        where: {
          submission: { application: { job: { organizationId: user!.organizationId } } },
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
        where: { job: { organizationId: user!.organizationId } },
        include: {
          job: { include: { client: { select: { legalName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const reviewerIds = Array.from(
      new Set([
        ...submissionApprovals.map((sa) => sa.reviewerId),
        ...jobApprovals.map((ja) => ja.reviewerId),
      ])
    );
    const reviewers = reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const reviewerMap = new Map(reviewers.map((r) => [r.id, r.name]));

    const history = [
      ...submissionApprovals.map((sa) => ({
        id: sa.id,
        type: 'SUBMISSION_APPROVAL',
        targetCode: sa.submission.code,
        targetTitle: `${sa.submission.application.candidate.name} → ${sa.submission.application.job.title}`,
        clientName: sa.submission.application.job.client.legalName,
        reviewerName: reviewerMap.get(sa.reviewerId) || 'Manager',
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
        reviewerName: reviewerMap.get(ja.reviewerId) || 'Manager',
        decision: ja.decision,
        comments: ja.comments,
        approvedAt: ja.approvedAt?.toISOString() || null,
        createdAt: ja.createdAt.toISOString(),
        isInvalidated: ja.isInvalidated,
        invalidationReason: ja.invalidationReason,
        profileVersion: ja.jobVersion,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      success: true,
      data: {
        items: history.slice(0, limit),
        total: history.length,
        page,
        limit,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch history' };
  }
}
