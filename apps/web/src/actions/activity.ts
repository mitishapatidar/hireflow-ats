'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  InterviewOutcome,
  getISTDayBoundaries,
  calculateTargetProgress,
  formatAsOfTimestamp,
  LogRecruiterActivitySchema,
  UpdateRecruiterTargetSchema,
} from '@hireflow/shared';

function canAccessActivity(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.RECRUITER;
}

export async function getRecruiterDailyActivityAction(dateStr?: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessActivity(user.role)) {
      return { success: false, error: 'Unauthorized: Internal team activity tracking only' };
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const today = getISTDayBoundaries(targetDate);
    const userId = user.id;

    // 1. Fetch or create targets
    let target = await prisma.recruiterTarget.findFirst({
      where: { userId, period: 'DAILY' },
    });

    if (!target) {
      target = {
        id: 'default-target',
        userId,
        organizationId: user.organizationId,
        period: 'DAILY',
        targetCandidatesSourced: 10,
        targetCalls: 20,
        targetEmails: 15,
        targetSubmissions: 3,
        targetInterviews: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // 2. Real counts for today
    const [
      candidatesSourcedCount,
      callsMadeCount,
      emailsSentCount,
      submissionsSentCount,
      interviewsCompletedCount,
      recentActivities,
    ] = await Promise.all([
      prisma.candidate.count({
        where: {
          createdById: userId,
          createdAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      prisma.recruiterActivity.count({
        where: {
          actorId: userId,
          type: 'CALL',
          createdAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      prisma.message.count({
        where: {
          createdById: userId,
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          deliveryStatus: { notIn: ['DRAFT', 'FAILED'] },
          sentAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      prisma.submission.count({
        where: {
          createdById: userId,
          createdAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      prisma.interview.count({
        where: {
          outcome: InterviewOutcome.COMPLETED,
          OR: [
            { createdById: userId },
            { panelMembers: { some: { userId } } },
          ],
          updatedAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      prisma.recruiterActivity.findMany({
        where: { actorId: userId },
        include: {
          relatedCandidate: { select: { id: true, name: true } },
          relatedClient: { select: { id: true, legalName: true } },
          relatedOpportunity: { select: { id: true, title: true, companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    const sourcedProgress = calculateTargetProgress(candidatesSourcedCount, target.targetCandidatesSourced);
    const callsProgress = calculateTargetProgress(callsMadeCount, target.targetCalls);
    const emailsProgress = calculateTargetProgress(emailsSentCount, target.targetEmails);
    const submissionsProgress = calculateTargetProgress(submissionsSentCount, target.targetSubmissions);
    const interviewsProgress = calculateTargetProgress(interviewsCompletedCount, target.targetInterviews);

    const overallScore = Math.round(
      (sourcedProgress.progressPercentage +
        callsProgress.progressPercentage +
        emailsProgress.progressPercentage +
        submissionsProgress.progressPercentage +
        interviewsProgress.progressPercentage) /
        5
    );

    return {
      success: true,
      data: {
        asOfTimestamp: formatAsOfTimestamp(new Date()),
        summary: {
          candidatesSourced: sourcedProgress,
          callsMade: callsProgress,
          emailsSent: emailsProgress,
          submissionsSent: submissionsProgress,
          interviewsCompleted: interviewsProgress,
          overallScorePercentage: overallScore,
        },
        target,
        recentActivities: recentActivities.map((act) => {
          const istHours = new Date(act.createdAt.getTime() + 5.5 * 60 * 60 * 1000);
          const timeStr = `${istHours.getUTCHours().toString().padStart(2, '0')}:${istHours
            .getUTCMinutes()
            .toString()
            .padStart(2, '0')} IST`;

          return {
            id: act.id,
            type: act.type,
            notes: act.notes,
            durationMinutes: act.durationMinutes,
            outcome: act.outcome,
            timeIST: timeStr,
            createdAt: act.createdAt.toISOString(),
            candidateName: act.relatedCandidate?.name,
            clientName: act.relatedClient?.legalName,
            opportunityName: act.relatedOpportunity?.companyName || act.relatedOpportunity?.title,
          };
        }),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load daily activity metrics' };
  }
}

export async function logRecruiterActivityAction(input: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessActivity(user.role)) {
      return { success: false, error: 'Unauthorized: Internal team activity tracking only' };
    }

    const parsed = LogRecruiterActivitySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid activity input' };
    }

    const data = parsed.data;
    const createdAt = data.date ? new Date(data.date) : new Date();

    const activity = await prisma.recruiterActivity.create({
      data: {
        actorId: user.id,
        organizationId: user.organizationId,
        type: data.type,
        relatedCandidateId: data.relatedCandidateId || null,
        relatedClientId: data.relatedClientId || null,
        relatedOpportunityId: data.relatedOpportunityId || null,
        durationMinutes: data.durationMinutes ?? null,
        outcome: data.outcome || null,
        notes: data.notes,
        createdAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'LOG_RECRUITER_ACTIVITY',
        entity: 'RecruiterActivity',
        entityId: activity.id,
        after: { type: data.type, outcome: data.outcome, notes: data.notes },
      },
    });

    revalidatePath('/activity');
    revalidatePath('/dashboard');
    return { success: true, data: activity };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to log activity' };
  }
}

export async function updateRecruiterTargetAction(input: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessActivity(user.role)) {
      return { success: false, error: 'Unauthorized: Internal team activity tracking only' };
    }

    const parsed = UpdateRecruiterTargetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid target values' };
    }

    const data = parsed.data;

    const target = await prisma.recruiterTarget.upsert({
      where: {
        userId_period: {
          userId: user.id,
          period: data.period,
        },
      },
      update: {
        targetCandidatesSourced: data.targetCandidatesSourced,
        targetCalls: data.targetCalls,
        targetEmails: data.targetEmails,
        targetSubmissions: data.targetSubmissions,
        targetInterviews: data.targetInterviews,
      },
      create: {
        userId: user.id,
        organizationId: user.organizationId,
        period: data.period,
        targetCandidatesSourced: data.targetCandidatesSourced,
        targetCalls: data.targetCalls,
        targetEmails: data.targetEmails,
        targetSubmissions: data.targetSubmissions,
        targetInterviews: data.targetInterviews,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'UPDATE_RECRUITER_TARGETS',
        entity: 'RecruiterTarget',
        entityId: target.id,
        after: target,
      },
    });

    revalidatePath('/activity');
    return { success: true, data: target };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update targets' };
  }
}
