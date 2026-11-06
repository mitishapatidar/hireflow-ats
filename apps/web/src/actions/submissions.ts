'use server';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  JobStatus,
  SubmissionApprovalStatus,
  buildClientFacingProfile,
  computeProfileContentHash,
  generateCVWatermarkText,
  calculateCandidateJobMatch,
  CreateSubmissionSchema,
  UpdateStandardProfileSchema,
  SendSubmissionSchema,
  ReviewApprovalSchema,
  SubmissionRowDTO,
  ClientFacingStandardProfileDTO,
} from '@hireflow/shared';

function canAccessSubmissions(userRole: string): boolean {
  return (
    userRole === UserRole.ADMIN ||
    userRole === UserRole.MANAGER ||
    userRole === UserRole.RECRUITER
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET SUBMISSIONS (Figma Frame 07)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSubmissionsAction(filters: {
  status?: string;
  search?: string;
  clientId?: string;
  jobId?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: SubmissionRowDTO[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: { all: number; awaitingApproval: number; approved: number };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSubmissions(user.role)) {
      return {
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        stats: { all: 0, awaitingApproval: 0, approved: 0 },
        error: 'Forbidden',
      };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;

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
        skip: (page - 1) * limit,
        take: limit,
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

    const data: SubmissionRowDTO[] = submissions.map((s) => {
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

    return {
      data,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        all: countAll,
        awaitingApproval: countAwaiting,
        approved: countApproved,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      stats: { all: 0, awaitingApproval: 0, approved: 0 },
      error: msg,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET SUBMISSION DETAIL & CURRENT PROFILE (Figma Frame 29)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSubmissionDetailAction(submissionId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSubmissions(user.role)) return { error: 'Forbidden' };

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        application: {
          include: {
            candidate: true,
            job: {
              include: {
                client: {
                  include: {
                    contacts: true,
                  },
                },
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

    if (!sub || sub.isArchived) return { error: 'Submission not found' };

    const currentVersion = sub.profileVersions[0];
    const clientContacts = sub.application.job.client.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      designation: c.designation,
    }));

    // Generate client-facing sanitized profile DTO
    const clientProfile = currentVersion
      ? buildClientFacingProfile(currentVersion.contentSnapshot as any)
      : null;

    return {
      data: {
        id: sub.id,
        code: sub.code,
        version: sub.version,
        approvalStatus: sub.approvalStatus,
        sendState: sub.sendState,
        sentAt: sub.sentAt?.toISOString() || null,
        clientDecision: sub.clientDecision,
        matchScore: sub.matchScore ?? 85,
        matchDetails: sub.matchDetails,
        candidate: {
          id: sub.application.candidate.id,
          name: sub.application.candidate.name,
          code: sub.application.candidate.code,
          currentTitle: sub.application.candidate.currentTitle,
          currentCompany: sub.application.candidate.currentCompany,
          location: sub.application.candidate.location,
          skills: sub.application.candidate.skills,
        },
        job: {
          id: sub.application.job.id,
          title: sub.application.job.title,
          code: sub.application.job.code,
          status: sub.application.job.status,
          client: {
            id: sub.application.job.client.id,
            name: sub.application.job.client.legalName,
            code: sub.application.job.client.code,
            contacts: clientContacts,
          },
        },
        profile: clientProfile,
        versions: sub.profileVersions.map((v) => ({
          versionNumber: v.versionNumber,
          versionTag: v.versionTag,
          changeSummary: v.changeSummary,
          contentHash: v.contentHash,
          createdAt: v.createdAt.toISOString(),
          isCurrent: v.isCurrent,
        })),
        latestApproval: sub.approvals[0]
          ? {
              decision: sub.approvals[0].decision,
              comments: sub.approvals[0].comments,
              approvedAt: sub.approvals[0].approvedAt?.toISOString() || null,
              isInvalidated: sub.approvals[0].isInvalidated,
            }
          : null,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UPDATE STANDARD PROFILE & CREATE NEW VERSION (Frame 29 Recruiter Editing)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProfileVersionAction(
  submissionId: string,
  data: {
    headline?: string;
    summary?: string;
    selectedSkills: string[];
    experienceHighlights?: Array<{ title: string; company: string; duration?: string; description?: string }>;
    educationHighlights?: Array<{ degree: string; institution: string; year?: string }>;
    portfolioUrl?: string;
    changeSummary: string;
  }
): Promise<{ success: boolean; versionTag?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSubmissions(user.role)) return { success: false, error: 'Forbidden' };

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        application: {
          include: {
            candidate: true,
            job: { include: { client: true } },
          },
        },
      },
    });

    if (!sub || sub.isArchived) return { success: false, error: 'Submission not found' };

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

    await prisma.$transaction(async (tx) => {
      // Mark old versions non-current
      await tx.submissionProfileVersion.updateMany({
        where: { submissionId },
        data: { isCurrent: false },
      });

      // Invalidate existing approvals
      await tx.submissionApproval.updateMany({
        where: { submissionId, isInvalidated: false },
        data: {
          isInvalidated: true,
          invalidatedAt: new Date(),
          invalidationReason: `New profile version ${nextVersionTag} created: ${data.changeSummary}`,
        },
      });

      // Save new version
      await tx.submissionProfileVersion.create({
        data: {
          submissionId,
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

      // Update submission status to APPROVAL_INVALIDATED
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          version: nextVersionNumber,
          approvalStatus: SubmissionApprovalStatus.APPROVAL_INVALIDATED,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PROFILE_VERSION_CREATED',
          entity: 'submission',
          entityId: submissionId,
          before: { version: sub.version },
          after: { version: nextVersionNumber, versionTag: nextVersionTag, changeSummary: data.changeSummary },
          ipAddress: '127.0.0.1',
        },
      });
    });

    revalidatePath('/submissions');
    return { success: true, versionTag: nextVersionTag };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. REQUEST MANAGER APPROVAL
// ─────────────────────────────────────────────────────────────────────────────

export async function requestApprovalAction(submissionId: string, comments?: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSubmissions(user.role)) return { success: false, error: 'Forbidden' };

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { profileVersions: { where: { isCurrent: true } } },
    });
    if (!sub || sub.isArchived) return { success: false, error: 'Submission not found' };

    const currentVersion = sub.profileVersions[0];

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: { approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL },
      });

      await tx.submissionApproval.create({
        data: {
          submissionId,
          reviewerId: user.id,
          decision: 'PENDING',
          comments: comments || `Approval requested for profile ${currentVersion?.versionTag || sub.code}`,
          profileVersion: sub.version,
          contentHash: currentVersion?.contentHash || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'SUBMISSION_APPROVAL_REQUESTED',
          entity: 'submission',
          entityId: submissionId,
          after: { approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL, version: sub.version },
          ipAddress: '127.0.0.1',
        },
      });
    });

    revalidatePath('/submissions');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. REVIEW APPROVAL (MANAGER / ADMIN ONLY)
// ─────────────────────────────────────────────────────────────────────────────

export async function reviewApprovalAction(
  submissionId: string,
  decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
  comments: string
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
      return { success: false, error: 'Forbidden: Only managers and admins can review approvals.' };
    }

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { profileVersions: { where: { isCurrent: true } } },
    });
    if (!sub || sub.isArchived) return { success: false, error: 'Submission not found' };

    const currentVersion = sub.profileVersions[0];

    let newStatus: SubmissionApprovalStatus;
    if (decision === 'APPROVED') newStatus = SubmissionApprovalStatus.APPROVED;
    else if (decision === 'CHANGES_REQUESTED') newStatus = SubmissionApprovalStatus.CHANGES_REQUESTED;
    else newStatus = SubmissionApprovalStatus.REJECTED;

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          approvalStatus: newStatus,
          approvedById: decision === 'APPROVED' ? user.id : null,
        },
      });

      await tx.submissionApproval.create({
        data: {
          submissionId,
          reviewerId: user.id,
          decision,
          comments,
          approvedAt: decision === 'APPROVED' ? new Date() : null,
          profileVersion: sub.version,
          contentHash: currentVersion?.contentHash || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'SUBMISSION_APPROVAL_REVIEWED',
          entity: 'submission',
          entityId: submissionId,
          after: { decision, approvalStatus: newStatus, comments },
          ipAddress: '127.0.0.1',
        },
      });
    });

    revalidatePath('/submissions');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SEND SUBMISSION TO CLIENT (With ACTIVE Job Restriction)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendSubmissionAction(
  submissionId: string,
  recipientContactId: string,
  emailSubject?: string,
  coverNote?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSubmissions(user.role)) return { success: false, error: 'Forbidden' };

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        application: {
          include: {
            job: {
              include: {
                client: {
                  include: { contacts: true },
                },
              },
            },
          },
        },
      },
    });

    if (!sub || sub.isArchived) return { success: false, error: 'Submission not found' };

    const job = sub.application.job;

    // ── CRITICAL LIFECYCLE RESTRICTION: Job MUST be ACTIVE ───────────
    if (job.status !== JobStatus.ACTIVE) {
      return {
        success: false,
        error: `Client presentation blocked: Job mandate "${job.title}" (${job.code}) is ${job.status}. Submissions are only permitted for ACTIVE job mandates.`,
      };
    }

    // Verify contact
    const contact = job.client.contacts.find((c) => c.id === recipientContactId);
    if (!contact) {
      return { success: false, error: 'Selected recipient contact does not belong to the mandate client.' };
    }

    // Verify approval
    if (sub.approvalStatus !== SubmissionApprovalStatus.APPROVED && sub.approvalStatus !== SubmissionApprovalStatus.APPROVAL_NOT_REQUIRED) {
      return {
        success: false,
        error: `Submission cannot be sent in "${sub.approvalStatus}" status. Manager approval is required.`,
      };
    }

    const sentTime = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          sendState: 'SENT',
          sentAt: sentTime,
          sentById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'SUBMISSION_SENT_TO_CLIENT',
          entity: 'submission',
          entityId: submissionId,
          after: {
            sendState: 'SENT',
            recipientName: contact.name,
            recipientEmail: contact.email,
            jobStatus: job.status,
            version: sub.version,
          },
          ipAddress: '127.0.0.1',
        },
      });
    });

    revalidatePath('/submissions');
    return {
      success: true,
      recipientName: contact.name,
      recipientEmail: contact.email,
      sentAt: sentTime.toISOString(),
      providerNotice: 'Simulation mode: Email logged to audit trail. Live mailbox OAuth provider arrives in Prompt 14.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GET WATERMARKED CV DETAILS
// ─────────────────────────────────────────────────────────────────────────────

export async function getCVPreviewAction(submissionId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessSubmissions(user.role)) return { error: 'Forbidden' };

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        application: {
          include: {
            candidate: true,
            job: { include: { client: true } },
          },
        },
      },
    });

    if (!sub || sub.isArchived) return { error: 'Submission not found' };

    const watermark = generateCVWatermarkText(sub.application.job.client.legalName);

    const doc = await prisma.candidateDocument.findFirst({
      where: { candidateId: sub.application.candidateId, documentType: 'RESUME' },
      orderBy: { version: 'desc' },
    });

    return {
      data: {
        candidateName: sub.application.candidate.name,
        clientName: sub.application.job.client.legalName,
        watermarkText: watermark,
        documentAvailable: Boolean(doc),
        fileName: doc?.fileName || 'candidate_resume.pdf',
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { error: msg };
  }
}
