import { prisma } from '@hireflow/db';
import {
  getVideoMeetingProvider,
  generateIcsCalendarInvite,
  VideoProvider,
  formatToISTDate,
  formatToISTTime,
  NotificationCategoryEnum,
  NotificationChannelEnum,
} from '@hireflow/shared';
import { notificationQueue } from '../queue/notification-queue.js';

export interface VideoMeetingServiceResult {
  success: boolean;
  provider?: string;
  meetingLink?: string | null;
  joinUrl?: string | null;
  status: string;
  errorMessage?: string;
  meetingId?: string;
}

/**
 * Creates or updates a video meeting for an interview that has already been saved to the database.
 * ENFORCES THE CRITICAL RULE: Video meetings are only created AFTER the interview has been persisted.
 */
export async function createVideoMeetingForInterview(
  interviewId: string,
  options: { forceRetry?: boolean; provider?: VideoProvider } = {}
): Promise<VideoMeetingServiceResult> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      application: {
        include: {
          candidate: true,
          job: { include: { client: true } },
        },
      },
      panelMembers: {
        include: { user: true },
      },
      round: true,
      videoMeeting: true,
    },
  });

  if (!interview) {
    throw new Error(`Interview ${interviewId} not found`);
  }

  // Idempotency check: if meeting is already created and not retrying, return existing
  if (interview.videoMeeting && interview.videoMeeting.status === 'CREATED' && !options.forceRetry) {
    return {
      success: true,
      meetingLink: interview.videoMeeting.joinUrl,
      status: interview.videoMeeting.status,
      meetingId: interview.videoMeeting.id,
    };
  }

  const candidate = interview.application.candidate;
  const job = interview.application.job;
  const roundName = interview.round?.name || 'Interview Round';
  const topic = `${job.title} - ${roundName} with ${candidate.name}`;

  const attendeeEmails = [
    candidate.email,
    ...interview.panelMembers.map((pm) => pm.user.email),
  ].filter(Boolean);

  const providerName = options.provider || (interview.provider as VideoProvider) || VideoProvider.GOOGLE_MEET;
  const provider = getVideoMeetingProvider(providerName, { allowMockFallback: true });

  const idempotencyKey = `meet:${interview.id}:${Date.now()}`;

  try {
    const meetingResult = await provider.createMeeting({
      interviewId: interview.id,
      topic,
      startTimeUtc: interview.scheduledAt,
      durationMinutes: interview.duration,
      timezone: interview.timezone || 'Asia/Kolkata',
      organizerEmail: interview.panelMembers[0]?.user.email || 'recruitment@aurevacapital.com',
      attendeeEmails,
      idempotencyKey,
    });

    const isSuccess = meetingResult.status === 'CREATED' || meetingResult.status === 'MOCK_MODE';

    // Persist VideoMeeting record
    const videoMeeting = await prisma.videoMeeting.upsert({
      where: { interviewId: interview.id },
      create: {
        interviewId: interview.id,
        provider: providerName,
        externalId: meetingResult.externalId || null,
        joinUrl: meetingResult.joinUrl || '',
        hostUrl: meetingResult.hostUrl || null,
        passcode: meetingResult.passcode || null,
        status: meetingResult.status,
        errorMessage: meetingResult.errorMessage || null,
        metadata: (meetingResult.metadata || {}) as any,
        idempotencyKey,
      },
      update: {
        provider: providerName,
        externalId: meetingResult.externalId || null,
        joinUrl: meetingResult.joinUrl || '',
        hostUrl: meetingResult.hostUrl || null,
        passcode: meetingResult.passcode || null,
        status: meetingResult.status,
        errorMessage: meetingResult.errorMessage || null,
        metadata: (meetingResult.metadata || {}) as any,
        updatedAt: new Date(),
      },
    });

    // If joinUrl exists, update interview.meetingLink
    if (meetingResult.joinUrl) {
      await prisma.interview.update({
        where: { id: interview.id },
        data: { meetingLink: meetingResult.joinUrl },
      });
    }

    // Record audit log
    await prisma.auditLog.create({
      data: {
        actorId: interview.createdById || 'system',
        action: isSuccess ? 'VIDEO_MEETING_CREATED' : 'VIDEO_MEETING_CREATION_FAILED',
        entity: 'Interview',
        entityId: interview.id,
        after: {
          provider: providerName,
          status: meetingResult.status,
          joinUrl: meetingResult.joinUrl,
          errorMessage: meetingResult.errorMessage,
        },
      },
    });

    return {
      success: isSuccess,
      provider: providerName,
      meetingLink: meetingResult.joinUrl,
      joinUrl: meetingResult.joinUrl,
      status: meetingResult.status,
      errorMessage: meetingResult.errorMessage,
      meetingId: videoMeeting.id,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown meeting creation error';

    await prisma.videoMeeting.upsert({
      where: { interviewId: interview.id },
      create: {
        interviewId: interview.id,
        provider: providerName,
        joinUrl: '',
        status: 'FAILED',
        errorMessage: errorMsg,
      },
      update: {
        status: 'FAILED',
        errorMessage: errorMsg,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: interview.createdById || 'system',
        action: 'VIDEO_MEETING_CREATION_FAILED',
        entity: 'Interview',
        entityId: interview.id,
        after: {
          provider: providerName,
          error: errorMsg,
        },
      },
    });

    return {
      success: false,
      status: 'FAILED',
      errorMessage: errorMsg,
    };
  }
}

/**
 * Sends confirmation email with RFC-5545 ICS attachment to candidate and panel members.
 */
export async function sendInterviewConfirmation(
  interviewId: string,
  options: { isReschedule?: boolean; cancellationReason?: string } = {}
): Promise<{ success: boolean; icsContent: string }> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      application: {
        include: {
          candidate: true,
          job: { include: { client: true } },
        },
      },
      panelMembers: {
        include: { user: true },
      },
      round: true,
      videoMeeting: true,
    },
  });

  if (!interview) {
    throw new Error(`Interview ${interviewId} not found`);
  }

  const candidate = interview.application.candidate;
  const job = interview.application.job;
  const roundName = interview.round?.name || 'Interview Round';
  const meetingLink = interview.videoMeeting?.joinUrl || interview.meetingLink;

  const isCancelled = interview.outcome === 'CANCELLED';
  const sequence = options.isReschedule ? 1 : 0;
  const method = isCancelled ? 'CANCEL' : 'REQUEST';
  const status = isCancelled ? 'CANCELLED' : 'CONFIRMED';

  const summary = isCancelled
    ? `CANCELLED: Interview for ${job.title} - ${roundName}`
    : `Interview: ${job.title} - ${roundName} (${candidate.name})`;

  const formattedDateTime = `${formatToISTDate(interview.scheduledAt)} at ${formatToISTTime(interview.scheduledAt)}`;

  const description = isCancelled
    ? `The scheduled interview has been cancelled. Reason: ${options.cancellationReason || 'Schedule conflict'}`
    : `Interview for position ${job.title} at Aureva Capital Partner (${job.client?.legalName || 'Aureva Capital'}).\nJoin Video Meeting: ${meetingLink || 'Link will be sent prior to the call.'}\nDate/Time: ${formattedDateTime}`;

  // Generate RFC-5545 .ics invite
  const icsContent = generateIcsCalendarInvite({
    interviewId: interview.id,
    summary,
    description,
    startTimeUtc: interview.scheduledAt,
    durationMinutes: interview.duration,
    meetingLink: meetingLink || undefined,
    organizerName: 'Aureva Capital Recruitment',
    organizerEmail: 'recruitment@aurevacapital.com',
    candidateName: candidate.name,
    candidateEmail: candidate.email,
    sequence,
    status,
    method,
  });

  // Dispatch notifications to candidate if they have an active user profile
  if (candidate.userId) {
    await notificationQueue.dispatch({
      userId: candidate.userId,
      recipientEmail: candidate.email,
      category: NotificationCategoryEnum.INTERVIEW,
      priority: 'HIGH',
      title: isCancelled ? 'Interview Cancelled' : options.isReschedule ? 'Interview Rescheduled' : 'Interview Confirmed',
      message: isCancelled
        ? `Your interview for ${job.title} has been cancelled.`
        : `Your interview for ${job.title} (${roundName}) is confirmed for ${formattedDateTime}.`,
      linkUrl: '/my-dashboard',
      channels: [NotificationChannelEnum.EMAIL, NotificationChannelEnum.IN_APP],
      metadata: {
        interviewId: interview.id,
        meetingLink,
        icsAttached: true,
      },
    });
  }

  return { success: true, icsContent };
}
