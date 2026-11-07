'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
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

// Helper: Ensure user has valid client access scope
async function getClientScope() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required.');
  }

  if (user.role !== UserRole.CLIENT && user.role !== UserRole.ADMIN) {
    throw new Error('Access denied: Client Portal is restricted to authorized client users.');
  }

  let clientId: string | null = null;
  let authorizedJobIds: string[] = [];

  if (user.role === UserRole.CLIENT) {
    const clientAccess = await prisma.clientAccess.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { client: true },
    });

    if (!clientAccess || !clientAccess.clientId || clientAccess.client.isArchived) {
      throw new Error('Access denied: No active ClientAccess record found for this account.');
    }

    clientId = clientAccess.clientId;
    authorizedJobIds = clientAccess.authorizedJobIds || [];
  } else if (user.role === UserRole.ADMIN) {
    const sampleClient = await prisma.client.findFirst({
      where: { organizationId: user.organizationId, isArchived: false },
    });
    clientId = sampleClient?.id || null;
    authorizedJobIds = [];
  }

  if (!clientId) {
    throw new Error('No accessible client account found.');
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, legalName: true, organizationId: true },
  });

  if (!client) {
    throw new Error('Client record not found.');
  }

  return {
    user,
    clientId,
    clientLegalName: client.legalName,
    organizationId: client.organizationId,
    authorizedJobIds,
  };
}

export async function getClientOverviewAction(): Promise<{
  success: boolean;
  data?: ClientPortalOverviewDTO;
  error?: string;
}> {
  try {
    const scope = await getClientScope();

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

    const data: ClientPortalOverviewDTO = {
      asOf: formatAsOfTimestamp(now),
      clientLegalName: scope.clientLegalName,
      clientContactName: scope.user.name,
      metrics: {
        openPositions: openPositionsCount,
        profilesSubmitted: submissions.length,
        interviewsScheduled: upcomingInterviewsCount,
      },
      recentSubmissions,
    };

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch client overview' };
  }
}

export async function getClientPositionsAction(params?: {
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  data?: ClientPositionDTO[];
  error?: string;
}> {
  try {
    const scope = await getClientScope();

    const where: any = {
      clientId: scope.clientId,
      isArchived: false,
      ...(params?.status ? { status: params.status } : { status: 'ACTIVE' }),
      ...(scope.authorizedJobIds.length > 0 ? { id: { in: scope.authorizedJobIds } } : {}),
    };

    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { location: { contains: params.search, mode: 'insensitive' } },
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

    const data: ClientPositionDTO[] = jobs.map((j) => {
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

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch positions' };
  }
}

export async function getClientSubmissionsAction(params?: {
  jobId?: string;
  clientDecision?: string;
}): Promise<{
  success: boolean;
  data?: ClientSubmissionRowDTO[];
  error?: string;
}> {
  try {
    const scope = await getClientScope();

    const jobWhere: any = {
      clientId: scope.clientId,
      isArchived: false,
      ...(params?.jobId ? { id: params.jobId } : {}),
      ...(scope.authorizedJobIds.length > 0 ? { id: { in: scope.authorizedJobIds } } : {}),
    };

    const where: any = {
      application: {
        job: jobWhere,
      },
      approvalStatus: { in: ['APPROVED', 'APPROVAL_NOT_REQUIRED'] },
      sendState: { in: ['SENT', 'VIEWED_BY_CLIENT', 'CLIENT_REVIEWED'] },
      isArchived: false,
      ...(params?.clientDecision ? { clientDecision: params.clientDecision } : {}),
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

    const data: ClientSubmissionRowDTO[] = submissions.map((sub) => {
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

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch submitted profiles' };
  }
}

export async function getClientSubmissionDetailsAction(id: string): Promise<{
  success: boolean;
  data?: ClientSubmissionDetailDTO;
  error?: string;
}> {
  try {
    const scope = await getClientScope();

    const sub = await prisma.submission.findUnique({
      where: { id },
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

    if (!sub || sub.isArchived) {
      throw new Error('Submission not found.');
    }

    if (sub.application.job.clientId !== scope.clientId) {
      throw new Error('Access denied: This submission does not belong to your organization.');
    }

    if (scope.authorizedJobIds.length > 0 && !scope.authorizedJobIds.includes(sub.application.job.id)) {
      throw new Error('Access denied: This position is not included in your authorized job scope.');
    }

    const isApproved = sub.approvalStatus === 'APPROVED' || sub.approvalStatus === 'APPROVAL_NOT_REQUIRED';
    const isSent = sub.sendState === 'SENT' || sub.sendState === 'VIEWED_BY_CLIENT' || sub.sendState === 'CLIENT_REVIEWED';

    if (!isApproved || !isSent) {
      throw new Error('Submission is not visible to client (pending internal approval or unsent).');
    }

    // Auto-update to VIEWED_BY_CLIENT if SENT
    if (sub.sendState === 'SENT') {
      await prisma.submission.update({
        where: { id: sub.id },
        data: { sendState: 'VIEWED_BY_CLIENT' },
      });
    }

    const candidate = sub.application.candidate;
    const currentVersion = sub.profileVersions.find((v) => v.isCurrent) || sub.profileVersions[0];
    const sanitizedProfile = buildClientFacingProfile(currentVersion?.contentSnapshot as any);

    // Download quota
    const todayBounds = getISTDayBoundaries(new Date());
    const policy = await prisma.downloadPolicy.findUnique({
      where: {
        organizationId_role: {
          organizationId: scope.organizationId,
          role: scope.user.role,
        },
      },
    });

    const userDownloadsToday = await prisma.downloadLog.count({
      where: {
        userId: scope.user.id,
        resourceType: 'CV',
        result: 'SUCCESS',
        createdAt: {
          gte: todayBounds.startUtc,
          lte: todayBounds.endUtc,
        },
      },
    });

    const usage = calculateDownloadUsage({
      role: scope.user.role,
      configuredLimit: policy?.dailyCvLimit,
      downloadsUsedToday: userDownloadsToday,
    });

    const watermarkText = generateCVWatermarkText(scope.clientLegalName);

    // Decision history
    const rawHistory = ((sub as any).clientDecisionHistory as any[]) || [];
    const decisionHistory = rawHistory.map((item) => ({
      decision: item.decision,
      reason: item.reason || null,
      feedback: item.feedback || null,
      informationRequired: item.informationRequired || null,
      decidedAt: item.decidedAt,
      clientUserName: item.clientUserName || 'Client Contact',
    }));

    // Feedback logs
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

    const data: ClientSubmissionDetailDTO = {
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

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch submission details' };
  }
}

export async function clientShortlistAction(
  submissionId: string,
  comments?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const scope = await getClientScope();
    const validated = ClientShortlistSchema.parse({ comments });

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { application: { include: { job: true } } },
    });

    if (!sub || sub.isArchived || sub.application.job.clientId !== scope.clientId) {
      throw new Error('Submission not found or unauthorized.');
    }

    const previousDecision = sub.clientDecision;
    const decidedAt = new Date();

    const newHistoryItem = {
      decision: 'SHORTLISTED',
      feedback: validated.comments || null,
      decidedAt: decidedAt.toISOString(),
      clientUserId: scope.user.id,
      clientUserName: scope.user.name,
    };

    const existingHistory = ((sub as any).clientDecisionHistory as any[]) || [];
    const updatedHistory = [...existingHistory, newHistoryItem];

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: sub.id },
        data: {
          clientDecision: 'SHORTLISTED',
          clientFeedback: validated.comments || sub.clientFeedback,
          sendState: 'CLIENT_REVIEWED',
          clientDecisionAt: decidedAt,
          clientDecisionHistory: updatedHistory as any,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: scope.user.id,
          action: 'CLIENT_SHORTLIST_SUBMISSION',
          entity: 'submission',
          entityId: sub.id,
          before: { clientDecision: previousDecision } as any,
          after: {
            clientDecision: 'SHORTLISTED',
            comments: validated.comments,
            decidedAt,
          } as any,
          ipAddress: '127.0.0.1',
        },
      });
    });

    revalidatePath('/portal');
    revalidatePath('/submitted-profiles');
    revalidatePath(`/portal/submissions/${submissionId}`);
    return { success: true, message: 'Candidate shortlisted successfully. Your talent team has been notified.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to shortlist candidate' };
  }
}

export async function clientRejectAction(
  submissionId: string,
  input: { reason: string; feedback?: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const scope = await getClientScope();
    const validated = ClientRejectSchema.parse(input);

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { application: { include: { job: true } } },
    });

    if (!sub || sub.isArchived || sub.application.job.clientId !== scope.clientId) {
      throw new Error('Submission not found or unauthorized.');
    }

    const previousDecision = sub.clientDecision;
    const decidedAt = new Date();

    const newHistoryItem = {
      decision: 'REJECTED',
      reason: validated.reason,
      feedback: validated.feedback || null,
      decidedAt: decidedAt.toISOString(),
      clientUserId: scope.user.id,
      clientUserName: scope.user.name,
    };

    const existingHistory = ((sub as any).clientDecisionHistory as any[]) || [];
    const updatedHistory = [...existingHistory, newHistoryItem];

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: sub.id },
        data: {
          clientDecision: 'REJECTED',
          clientDecisionReason: validated.reason,
          clientFeedback: validated.feedback || sub.clientFeedback,
          sendState: 'CLIENT_REVIEWED',
          clientDecisionAt: decidedAt,
          clientDecisionHistory: updatedHistory as any,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: scope.user.id,
          action: 'CLIENT_REJECT_SUBMISSION',
          entity: 'submission',
          entityId: sub.id,
          before: { clientDecision: previousDecision } as any,
          after: {
            clientDecision: 'REJECTED',
            reason: validated.reason,
            feedback: validated.feedback,
            decidedAt,
          } as any,
          ipAddress: '127.0.0.1',
        },
      });
    });

    revalidatePath('/portal');
    revalidatePath('/submitted-profiles');
    revalidatePath(`/portal/submissions/${submissionId}`);
    return {
      success: true,
      message: 'Candidate rejection recorded. Note: Rejection is shared with HireFlow talent team only.',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject candidate' };
  }
}

export async function clientRequestDetailsAction(
  submissionId: string,
  input: { informationRequired: string; additionalContext?: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const scope = await getClientScope();
    const validated = ClientRequestDetailsSchema.parse(input);

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { application: { include: { job: true } } },
    });

    if (!sub || sub.isArchived || sub.application.job.clientId !== scope.clientId) {
      throw new Error('Submission not found or unauthorized.');
    }

    const previousDecision = sub.clientDecision;
    const decidedAt = new Date();

    const newHistoryItem = {
      decision: 'NEED_DETAILS',
      informationRequired: validated.informationRequired,
      feedback: validated.additionalContext || null,
      priority: validated.priority,
      decidedAt: decidedAt.toISOString(),
      clientUserId: scope.user.id,
      clientUserName: scope.user.name,
    };

    const existingHistory = ((sub as any).clientDecisionHistory as any[]) || [];
    const updatedHistory = [...existingHistory, newHistoryItem];

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
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
          actorId: scope.user.id,
          action: 'CLIENT_REQUEST_DETAILS',
          entity: 'submission',
          entityId: sub.id,
          before: { clientDecision: previousDecision } as any,
          after: {
            clientDecision: 'NEED_DETAILS',
            informationRequired: validated.informationRequired,
            additionalContext: validated.additionalContext,
            priority: validated.priority,
            decidedAt,
          } as any,
          ipAddress: '127.0.0.1',
        },
      });
    });

    revalidatePath('/portal');
    revalidatePath('/submitted-profiles');
    revalidatePath(`/portal/submissions/${submissionId}`);
    return { success: true, message: 'Request for additional information sent to your talent team.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to request details' };
  }
}

export async function sendClientFeedbackAction(
  submissionId: string,
  input: { category: 'GENERAL' | 'SKILLS' | 'INTERVIEW_PREP' | 'SUITABILITY'; content: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const scope = await getClientScope();
    const validated = ClientTeamFeedbackSchema.parse(input);

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { application: { include: { job: true } } },
    });

    if (!sub || sub.isArchived || sub.application.job.clientId !== scope.clientId) {
      throw new Error('Submission not found or unauthorized.');
    }

    await prisma.auditLog.create({
      data: {
        actorId: scope.user.id,
        action: 'CLIENT_RECRUITMENT_FEEDBACK_SUBMITTED',
        entity: 'submission_client_feedback',
        entityId: sub.id,
        after: {
          submissionId: sub.id,
          jobId: sub.application.job.id,
          clientId: scope.clientId,
          category: validated.category,
          content: validated.content,
          authorName: scope.user.name,
          submittedAt: new Date().toISOString(),
        } as any,
        ipAddress: '127.0.0.1',
      },
    });

    revalidatePath(`/portal/submissions/${submissionId}`);
    return {
      success: true,
      message: 'Feedback received by your talent team. It will not be sent to the candidate.',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit feedback' };
  }
}

export async function downloadClientCvAction(submissionId: string): Promise<{
  success: boolean;
  data?: {
    fileName: string;
    watermarkText: string;
    remainingToday: number;
    downloadTimestamp: string;
  };
  error?: string;
}> {
  try {
    const scope = await getClientScope();
    const todayBounds = getISTDayBoundaries(new Date());

    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { application: { include: { job: true, candidate: true } } },
    });

    if (!sub || sub.isArchived || sub.application.job.clientId !== scope.clientId) {
      throw new Error('Submission not found or unauthorized.');
    }

    const policy = await prisma.downloadPolicy.findUnique({
      where: {
        organizationId_role: {
          organizationId: scope.organizationId,
          role: scope.user.role,
        },
      },
    });

    const usedToday = await prisma.downloadLog.count({
      where: {
        userId: scope.user.id,
        resourceType: 'CV',
        result: 'SUCCESS',
        createdAt: {
          gte: todayBounds.startUtc,
          lte: todayBounds.endUtc,
        },
      },
    });

    const quota = calculateDownloadUsage({
      role: scope.user.role,
      configuredLimit: policy?.dailyCvLimit,
      downloadsUsedToday: usedToday,
    });

    if (quota.isExceeded) {
      await prisma.downloadLog.create({
        data: {
          userId: scope.user.id,
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
          ipAddress: '127.0.0.1',
        },
      });

      throw new Error(
        `You have reached your daily limit of ${quota.dailyLimit} CV downloads. Quota resets at midnight Asia/Kolkata.`
      );
    }

    const watermarkText = generateCVWatermarkText(scope.clientLegalName);

    await prisma.downloadLog.create({
      data: {
        userId: scope.user.id,
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
        ipAddress: '127.0.0.1',
      },
    });

    return {
      success: true,
      data: {
        fileName: `${sub.application.candidate.code}_Resume_Watermarked.pdf`,
        watermarkText,
        remainingToday: quota.remaining - 1,
        downloadTimestamp: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to download CV' };
  }
}

export async function getClientInterviewsAction(): Promise<{
  success: boolean;
  data?: ClientInterviewDTO[];
  error?: string;
}> {
  try {
    const scope = await getClientScope();

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

    const data: ClientInterviewDTO[] = interviews.map((int) => {
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
        participants: int.panelMembers.map((p) => p.user.name),
      };
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch interviews' };
  }
}

export async function getClientReportsAction(): Promise<{
  success: boolean;
  data?: ClientProgressReportDTO;
  error?: string;
}> {
  try {
    const scope = await getClientScope();

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

    const data: ClientProgressReportDTO = {
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

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch progress reports' };
  }
}
