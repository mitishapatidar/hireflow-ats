'use server';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  JobStatus,
  InterviewOutcome,
  InterviewMode,
  VideoProvider,
  PanelRecommendation,
  DEFAULT_TIMEZONE,
  getISTWeekBoundaries,
  formatToISTTime,
  formatToISTDate,
  getISTDayIndex,
  isTimeOverlapping,
  MockCalendarAvailabilityProvider,
  MockVideoMeetingProvider,
  buildReminderConfig,
  validateInterviewTransition,
  ScheduleInterviewInputSchema,
  RescheduleInterviewInputSchema,
  CancelInterviewInputSchema,
  CompleteInterviewInputSchema,
  NoShowInterviewInputSchema,
  PanelFeedbackInputSchema,
  CreateFollowUpTaskInputSchema,
} from '@hireflow/shared';

// Helper: Check authorization
function canAccessInterviews(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.RECRUITER;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Get Calendar Data (Events + Stats)
// ─────────────────────────────────────────────────────────────────────────────
export async function getCalendarDataAction(
  referenceDateStr?: string,
  recruiterId?: string,
  jobId?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized or forbidden' };
    }

    const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
    const week = getISTWeekBoundaries(refDate);

    const whereClause: Prisma.InterviewWhereInput = {
      isArchived: false,
      scheduledAt: {
        gte: week.startOfWeekUtc,
        lte: week.endOfWeekUtc,
      },
    };

    if (jobId) {
      whereClause.application = { jobId };
    }

    if (recruiterId) {
      whereClause.panelMembers = { some: { userId: recruiterId } };
    } else if (user.role === UserRole.RECRUITER) {
      whereClause.OR = [
        { panelMembers: { some: { userId: user.id } } },
        { createdById: user.id },
        { application: { candidate: { ownerId: user.id } } },
        { application: { job: { assignments: { some: { recruiterId: user.id, status: 'ACTIVE' } } } } },
      ];
    }

    const [interviews, thisWeekCount, pendingFeedbackCount, noShowsThisWeekCount] = await Promise.all([
      prisma.interview.findMany({
        where: whereClause,
        include: {
          application: {
            include: {
              candidate: {
                select: { id: true, name: true, email: true, currentTitle: true },
              },
              job: {
                select: { id: true, title: true, code: true, status: true, client: { select: { legalName: true } } },
              },
            },
          },
          round: {
            select: { id: true, name: true, roundOrder: true, interviewType: true },
          },
          panelMembers: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          feedbacks: {
            select: { id: true, rating: true, recommendation: true, reviewerId: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.interview.count({
        where: {
          scheduledAt: { gte: week.startOfWeekUtc, lte: week.endOfWeekUtc },
          outcome: { not: InterviewOutcome.CANCELLED },
          isArchived: false,
        },
      }),
      prisma.interview.count({
        where: {
          outcome: InterviewOutcome.COMPLETED,
          feedbacks: { none: {} },
          isArchived: false,
        },
      }),
      prisma.interview.count({
        where: {
          scheduledAt: { gte: week.startOfWeekUtc, lte: week.endOfWeekUtc },
          outcome: InterviewOutcome.NO_SHOW,
          isArchived: false,
        },
      }),
    ]);

    const events = interviews.map((inv) => {
      const dayIndex = getISTDayIndex(inv.scheduledAt);
      const endTimeUtc = new Date(inv.scheduledAt.getTime() + inv.duration * 60 * 1000);

      return {
        id: inv.id,
        candidateId: inv.application.candidate.id,
        candidateName: inv.application.candidate.name,
        candidateRole: inv.application.candidate.currentTitle || 'Candidate',
        jobId: inv.application.job.id,
        jobTitle: inv.application.job.title,
        jobCode: inv.application.job.code,
        clientName: inv.application.job.client?.legalName || 'Client',
        roundId: inv.roundId,
        roundName: inv.round?.name || 'Interview Round',
        roundType: inv.round?.interviewType || 'VIDEO',
        scheduledAt: inv.scheduledAt.toISOString(),
        duration: inv.duration,
        timezone: inv.timezone || DEFAULT_TIMEZONE,
        startTimeIST: formatToISTTime(inv.scheduledAt),
        endTimeIST: formatToISTTime(endTimeUtc),
        dateIST: formatToISTDate(inv.scheduledAt),
        dayIndex,
        mode: inv.mode,
        provider: inv.provider,
        meetingLink: inv.meetingLink,
        outcome: inv.outcome,
        panelMembers: inv.panelMembers.map((pm) => ({
          userId: pm.user.id,
          name: pm.user.name,
          email: pm.user.email,
        })),
        feedbacksCount: inv.feedbacks.length,
        hasPendingFeedback: inv.outcome === InterviewOutcome.COMPLETED && inv.feedbacks.length === 0,
      };
    });

    return {
      success: true,
      data: {
        week: {
          weekLabel: week.weekLabel,
          startOfWeekUtc: week.startOfWeekUtc.toISOString(),
          endOfWeekUtc: week.endOfWeekUtc.toISOString(),
          startOfWeekIST: week.startOfWeekIST,
          endOfWeekIST: week.endOfWeekIST,
          days: week.days,
        },
        events,
        stats: {
          thisWeek: thisWeekCount,
          pendingFeedback: pendingFeedbackCount,
          noShowsThisWeek: noShowsThisWeekCount,
          calendarSync: {
            status: 'SETUP_REQUIRED',
            label: 'Setup required',
            badge: 'Not connected',
            description: 'Google Workspace & Outlook integrations will be connected in Prompt 25.',
          },
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch calendar data' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Check Availability Action
// ─────────────────────────────────────────────────────────────────────────────
export async function checkAvailabilityAction(params: {
  scheduledAt: string;
  duration?: number;
  panelMemberIds: string[];
  excludeInterviewId?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const proposedStart = new Date(params.scheduledAt);
    const duration = params.duration || 45;

    const panelUsers = await prisma.user.findMany({
      where: { id: { in: params.panelMemberIds }, status: 'ACTIVE', isArchived: false },
      select: { id: true, name: true },
    });

    const windowStart = new Date(proposedStart.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(proposedStart.getTime() + 24 * 60 * 60 * 1000);

    const existing = await prisma.interview.findMany({
      where: {
        scheduledAt: { gte: windowStart, lte: windowEnd },
        isArchived: false,
        panelMembers: { some: { userId: { in: params.panelMemberIds } } },
      },
      include: { panelMembers: true },
    });

    const mapped = existing.map((inv) => ({
      id: inv.id,
      scheduledAt: inv.scheduledAt,
      duration: inv.duration,
      outcome: inv.outcome as InterviewOutcome,
      panelUserIds: inv.panelMembers.map((pm) => pm.userId),
    }));

    const result = MockCalendarAvailabilityProvider.checkAvailability(
      proposedStart,
      duration,
      panelUsers,
      mapped,
      params.excludeInterviewId
    );

    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to check availability' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Schedule Interview Action
// ─────────────────────────────────────────────────────────────────────────────
export async function scheduleInterviewAction(payload: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = ScheduleInterviewInputSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const input = parsed.data;
    const scheduledAtUtc = new Date(input.scheduledAt);

    // Validate Application
    const application = await prisma.application.findUnique({
      where: { id: input.applicationId },
      include: {
        candidate: true,
        job: {
          include: {
            rounds: { where: { isArchived: false }, orderBy: { roundOrder: 'asc' } },
          },
        },
      },
    });

    if (!application) {
      return { success: false, error: 'Application not found' };
    }

    if (application.job.status !== JobStatus.ACTIVE) {
      return {
        success: false,
        error: `Cannot schedule interview for job in status ${application.job.status}. Job must be ACTIVE.`,
      };
    }

    let roundId = input.roundId;
    if (roundId) {
      const match = application.job.rounds.find((r) => r.id === roundId);
      if (!match) return { success: false, error: 'Round does not belong to this job' };
    } else if (application.job.rounds.length > 0) {
      roundId = application.job.rounds[0].id;
    }

    // Reminders config
    const reminderConfig = buildReminderConfig(
      scheduledAtUtc,
      input.reminder24h,
      input.reminder30m,
      input.recipients
    );

    const interview = await prisma.$transaction(async (tx) => {
      // Race-safe conflict check
      const conflicts = await tx.interview.findMany({
        where: {
          outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
          isArchived: false,
          panelMembers: { some: { userId: { in: input.panelMemberIds } } },
        },
        include: { panelMembers: { include: { user: true } } },
      });

      const conflicting = conflicts.find((conf) =>
        isTimeOverlapping(scheduledAtUtc, input.duration, conf.scheduledAt, conf.duration)
      );

      if (conflicting) {
        const mem = conflicting.panelMembers.find((pm) => input.panelMemberIds.includes(pm.userId));
        const name = mem?.user.name || 'A panel member';
        throw new Error(`Double booking conflict: ${name} is already booked for another interview at this time.`);
      }

      const created = await tx.interview.create({
        data: {
          applicationId: input.applicationId,
          roundId: roundId || null,
          scheduledAt: scheduledAtUtc,
          duration: input.duration,
          timezone: input.timezone || DEFAULT_TIMEZONE,
          mode: input.mode,
          provider: input.provider,
          outcome: InterviewOutcome.SCHEDULED,
          reminderConfig: reminderConfig as any,
          createdById: user.id,
          panelMembers: {
            createMany: {
              data: input.panelMemberIds.map((userId) => ({
                userId,
                role: 'INTERVIEWER',
                createdById: user.id,
              })),
            },
          },
        },
      });

      const meetingInfo = MockVideoMeetingProvider.generateMeetingLink(input.provider, created.id);

      const updated = await tx.interview.update({
        where: { id: created.id },
        data: { meetingLink: meetingInfo.meetingUrl },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: created.id,
          action: 'CREATED',
          toTime: scheduledAtUtc,
          reason: 'Initial schedule',
          actorId: user.id,
          metadata: {
            provider: input.provider,
            meetingUrl: meetingInfo.meetingUrl,
          },
        },
      });

      return updated;
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'interview.scheduled',
        entity: 'interview',
        entityId: interview.id,
        after: {
          scheduledAt: scheduledAtUtc.toISOString(),
          duration: input.duration,
          candidateName: application.candidate.name,
          jobCode: application.job.code,
        },
      },
    });

    revalidatePath('/interviews');
    revalidatePath(`/jobs/${application.jobId}/pipeline`);
    return { success: true, data: { id: interview.id } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to schedule interview' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Reschedule Interview Action
// ─────────────────────────────────────────────────────────────────────────────
export async function rescheduleInterviewAction(interviewId: string, payload: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { panelMembers: true },
    });
    if (!interview || interview.isArchived) {
      return { success: false, error: 'Interview not found' };
    }

    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.RESCHEDULED
    );
    if (!transition.valid) {
      return { success: false, error: transition.error };
    }

    const parsed = RescheduleInterviewInputSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const input = parsed.data;
    const newScheduledAtUtc = new Date(input.newScheduledAt);
    const duration = input.duration || interview.duration;
    const panelUserIds = interview.panelMembers.map((pm) => pm.userId);

    await prisma.$transaction(async (tx) => {
      const conflicts = await tx.interview.findMany({
        where: {
          id: { not: interview.id },
          outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
          isArchived: false,
          panelMembers: { some: { userId: { in: panelUserIds } } },
        },
        include: { panelMembers: { include: { user: true } } },
      });

      const conflicting = conflicts.find((conf) =>
        isTimeOverlapping(newScheduledAtUtc, duration, conf.scheduledAt, conf.duration)
      );

      if (conflicting) {
        const mem = conflicting.panelMembers.find((pm) => panelUserIds.includes(pm.userId));
        const name = mem?.user.name || 'A panel member';
        throw new Error(`Double booking conflict: ${name} is busy at the proposed time.`);
      }

      const newMeeting = MockVideoMeetingProvider.generateMeetingLink(
        (interview.provider as VideoProvider) || VideoProvider.GOOGLE_MEET,
        interview.id
      );

      await tx.interview.update({
        where: { id: interview.id },
        data: {
          previousScheduledAt: interview.scheduledAt,
          scheduledAt: newScheduledAtUtc,
          duration,
          outcome: InterviewOutcome.RESCHEDULED,
          rescheduleReason: input.rescheduleReason,
          meetingLink: newMeeting.meetingUrl,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'RESCHEDULED',
          fromTime: interview.scheduledAt,
          toTime: newScheduledAtUtc,
          reason: input.rescheduleReason,
          actorId: user.id,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'interview.rescheduled',
        entity: 'interview',
        entityId: interview.id,
        after: {
          newScheduledAt: newScheduledAtUtc.toISOString(),
          reason: input.rescheduleReason,
        },
      },
    });

    revalidatePath('/interviews');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reschedule interview' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cancel Interview Action
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelInterviewAction(interviewId: string, payload: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview || interview.isArchived) return { success: false, error: 'Interview not found' };

    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.CANCELLED
    );
    if (!transition.valid) return { success: false, error: transition.error };

    const parsed = CancelInterviewInputSchema.safeParse(payload);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Reason required' };

    await prisma.$transaction(async (tx) => {
      await tx.interview.update({
        where: { id: interview.id },
        data: {
          outcome: InterviewOutcome.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: parsed.data.cancellationReason,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'CANCELLED',
          fromTime: interview.scheduledAt,
          reason: parsed.data.cancellationReason,
          actorId: user.id,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'interview.cancelled',
        entity: 'interview',
        entityId: interview.id,
        after: { reason: parsed.data.cancellationReason },
      },
    });

    revalidatePath('/interviews');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel interview' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Complete Interview Action
// ─────────────────────────────────────────────────────────────────────────────
export async function completeInterviewAction(interviewId: string, payload: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview || interview.isArchived) return { success: false, error: 'Interview not found' };

    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.COMPLETED
    );
    if (!transition.valid) return { success: false, error: transition.error };

    const parsed = CompleteInterviewInputSchema.safeParse(payload);
    const notes = parsed.success ? parsed.data.outcomeNotes : null;

    await prisma.$transaction(async (tx) => {
      await tx.interview.update({
        where: { id: interview.id },
        data: {
          outcome: InterviewOutcome.COMPLETED,
          completedAt: new Date(),
          outcomeNotes: notes || null,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'COMPLETED',
          fromTime: interview.scheduledAt,
          reason: notes || 'Interview completed',
          actorId: user.id,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'interview.completed',
        entity: 'interview',
        entityId: interview.id,
        after: { notes },
      },
    });

    revalidatePath('/interviews');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to complete interview' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. No-Show Interview Action (NEVER Auto-Reject)
// ─────────────────────────────────────────────────────────────────────────────
export async function noShowInterviewAction(interviewId: string, payload: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview || interview.isArchived) return { success: false, error: 'Interview not found' };

    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.NO_SHOW
    );
    if (!transition.valid) return { success: false, error: transition.error };

    const parsed = NoShowInterviewInputSchema.safeParse(payload);
    const reason = parsed.success ? parsed.data.noShowReason : null;

    await prisma.$transaction(async (tx) => {
      await tx.interview.update({
        where: { id: interview.id },
        data: {
          outcome: InterviewOutcome.NO_SHOW,
          noShowAt: new Date(),
          outcomeNotes: reason || 'Candidate no-show',
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'NO_SHOW',
          fromTime: interview.scheduledAt,
          reason: reason || 'Candidate no-show',
          actorId: user.id,
        },
      });

      // CRITICAL ATS RULE: Application stage is NOT altered!
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'interview.no_show',
        entity: 'interview',
        entityId: interview.id,
        after: { reason },
      },
    });

    revalidatePath('/interviews');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record no-show' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Submit Panel Feedback Action (Internal Only)
// ─────────────────────────────────────────────────────────────────────────────
export async function submitPanelFeedbackAction(interviewId: string, payload: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { panelMembers: true },
    });
    if (!interview || interview.isArchived) return { success: false, error: 'Interview not found' };

    const parsed = PanelFeedbackInputSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid feedback' };
    }

    const input = parsed.data;

    await prisma.interviewFeedback.upsert({
      where: {
        interviewId_reviewerId: {
          interviewId: interview.id,
          reviewerId: user.id,
        },
      },
      update: {
        rating: input.rating,
        recommendation: input.recommendation,
        feedback: input.feedback,
        strengths: input.strengths || null,
        concerns: input.concerns || null,
        technicalScore: input.technicalScore || null,
        updatedById: user.id,
      },
      create: {
        interviewId: interview.id,
        reviewerId: user.id,
        rating: input.rating,
        recommendation: input.recommendation,
        feedback: input.feedback,
        strengths: input.strengths || null,
        concerns: input.concerns || null,
        technicalScore: input.technicalScore || null,
        createdById: user.id,
      },
    });

    await prisma.interviewHistory.create({
      data: {
        interviewId: interview.id,
        action: 'FEEDBACK_SUBMITTED',
        reason: `Feedback submitted: ${input.recommendation} (${input.rating}/5 stars)`,
        actorId: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'interview.feedback_submitted',
        entity: 'interview',
        entityId: interview.id,
        after: { rating: input.rating, recommendation: input.recommendation },
      },
    });

    revalidatePath('/interviews');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit feedback' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Create Follow-up Task Action
// ─────────────────────────────────────────────────────────────────────────────
export async function createFollowUpTaskAction(interviewId: string, payload: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview || interview.isArchived) return { success: false, error: 'Interview not found' };

    const parsed = CreateFollowUpTaskInputSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid task input' };
    }

    const input = parsed.data;

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description || null,
        assignedToId: input.assignedToId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority,
        relatedInterviewId: interview.id,
        relatedApplicationId: interview.applicationId,
        createdById: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'interview.task_created',
        entity: 'interview',
        entityId: interview.id,
        after: { taskId: task.id, title: task.title },
      },
    });

    revalidatePath('/interviews');
    return { success: true, data: { id: task.id } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create task' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Get Interview Detail Action
// ─────────────────────────────────────────────────────────────────────────────
export async function getInterviewDetailAction(interviewId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                currentTitle: true,
                currentCompany: true,
                location: true,
                experienceYears: true,
              },
            },
            job: {
              select: {
                id: true,
                title: true,
                code: true,
                status: true,
                client: { select: { id: true, legalName: true } },
              },
            },
          },
        },
        round: {
          select: { id: true, name: true, roundOrder: true, interviewType: true, durationMinutes: true },
        },
        panelMembers: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        feedbacks: {
          include: {
            reviewer: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { submittedAt: 'desc' },
        },
        histories: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!interview || interview.isArchived) {
      return { success: false, error: 'Interview not found' };
    }

    // Serializable formatting
    return {
      success: true,
      data: {
        id: interview.id,
        applicationId: interview.applicationId,
        candidate: {
          id: interview.application.candidate.id,
          name: interview.application.candidate.name,
          email: interview.application.candidate.email,
          phone: interview.application.candidate.phone,
          title: interview.application.candidate.currentTitle,
          company: interview.application.candidate.currentCompany,
          location: interview.application.candidate.location,
          experience: interview.application.candidate.experienceYears
            ? Number(interview.application.candidate.experienceYears)
            : null,
        },
        job: {
          id: interview.application.job.id,
          title: interview.application.job.title,
          code: interview.application.job.code,
          status: interview.application.job.status,
          clientName: interview.application.job.client?.legalName || 'Client',
        },
        round: interview.round
          ? {
              id: interview.round.id,
              name: interview.round.name,
              order: interview.round.roundOrder,
              type: interview.round.interviewType,
              defaultDuration: interview.round.durationMinutes,
            }
          : null,
        scheduledAt: interview.scheduledAt.toISOString(),
        previousScheduledAt: interview.previousScheduledAt ? interview.previousScheduledAt.toISOString() : null,
        duration: interview.duration,
        timezone: interview.timezone,
        mode: interview.mode,
        provider: interview.provider,
        meetingLink: interview.meetingLink,
        outcome: interview.outcome,
        outcomeNotes: interview.outcomeNotes,
        rescheduleReason: interview.rescheduleReason,
        cancellationReason: interview.cancellationReason,
        completedAt: interview.completedAt ? interview.completedAt.toISOString() : null,
        noShowAt: interview.noShowAt ? interview.noShowAt.toISOString() : null,
        cancelledAt: interview.cancelledAt ? interview.cancelledAt.toISOString() : null,
        reminderConfig: interview.reminderConfig,
        panelMembers: interview.panelMembers.map((pm) => ({
          userId: pm.user.id,
          name: pm.user.name,
          email: pm.user.email,
          role: pm.user.role,
        })),
        feedbacks: interview.feedbacks.map((fb) => ({
          id: fb.id,
          reviewerId: fb.reviewerId,
          reviewerName: fb.reviewer.name,
          rating: fb.rating,
          recommendation: fb.recommendation,
          strengths: fb.strengths,
          concerns: fb.concerns,
          technicalScore: fb.technicalScore,
          feedback: fb.feedback,
          submittedAt: fb.submittedAt.toISOString(),
        })),
        histories: interview.histories.map((h) => ({
          id: h.id,
          action: h.action,
          fromTime: h.fromTime ? h.fromTime.toISOString() : null,
          toTime: h.toTime ? h.toTime.toISOString() : null,
          reason: h.reason,
          createdAt: h.createdAt.toISOString(),
        })),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch interview details' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Get Scheduling Prerequisites (Jobs, Candidates/Apps, Users)
// ─────────────────────────────────────────────────────────────────────────────
export async function getInterviewPrerequisitesAction() {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessInterviews(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const [activeJobs, activeUsers] = await Promise.all([
      prisma.job.findMany({
        where: { status: JobStatus.ACTIVE },
        include: {
          client: { select: { id: true, legalName: true } },
          rounds: { where: { isArchived: false }, orderBy: { roundOrder: 'asc' } },
          applications: {
            include: {
              candidate: {
                select: { id: true, name: true, email: true, currentTitle: true },
              },
            },
          },
        },
        orderBy: { title: 'asc' },
      }),
      prisma.user.findMany({
        where: { status: 'ACTIVE', isArchived: false },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const formattedJobs = activeJobs.map((j) => ({
      id: j.id,
      title: j.title,
      code: j.code,
      clientName: j.client?.legalName || 'Client',
      rounds: j.rounds.map((r) => ({
        id: r.id,
        name: r.name,
        roundOrder: r.roundOrder,
        durationMinutes: r.durationMinutes,
        interviewType: r.interviewType,
      })),
      applications: j.applications.map((app) => ({
        applicationId: app.id,
        candidateId: app.candidate.id,
        candidateName: app.candidate.name,
        candidateEmail: app.candidate.email,
        candidateRole: app.candidate.currentTitle || 'Candidate',
      })),
    }));

    return {
      success: true,
      data: {
        jobs: formattedJobs,
        users: activeUsers,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch prerequisites' };
  }
}
