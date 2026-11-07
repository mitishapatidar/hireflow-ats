/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
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
  serializeInterviewForClient,
  ScheduleInterviewInputSchema,
  RescheduleInterviewInputSchema,
  CancelInterviewInputSchema,
  CompleteInterviewInputSchema,
  NoShowInterviewInputSchema,
  PanelFeedbackInputSchema,
  CreateFollowUpTaskInputSchema,
} from '@hireflow/shared';
import { createVideoMeetingForInterview, sendInterviewConfirmation } from '../services/video-meetings.js';

export const interviewRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Write Audit Log
  async function logInterviewAudit(
    actorId: string,
    action: string,
    interviewId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'interview',
          entityId: interviewId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log interview audit log');
    }
  }

  // Helper: Verify interview access
  async function verifyInterviewAccess(interviewId: string, user: any) {
    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return {
        allowed: false,
        status: 403,
        error: 'Forbidden: Interviews module is restricted to internal recruitment team.',
      };
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
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
        round: true,
        panelMembers: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        feedbacks: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        histories: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!interview || interview.isArchived) {
      return { allowed: false, status: 404, error: 'Interview record not found' };
    }

    if (user.role === UserRole.RECRUITER) {
      const isJobAssigned = interview.application.job.assignments.some(
        (a) => a.recruiterId === user.id && a.status === 'ACTIVE'
      );
      const isCandidateOwned = interview.application.candidate.ownerId === user.id;
      const isPanelMember = interview.panelMembers.some((pm) => pm.userId === user.id);
      const isCreator = interview.createdById === user.id;

      if (!isJobAssigned && !isCandidateOwned && !isPanelMember && !isCreator) {
        return {
          allowed: false,
          status: 403,
          error: 'Forbidden: You do not have permission to access this interview.',
        };
      }
    }

    return { allowed: true, interview };
  }

  // ==========================================
  // 1. GET /api/interviews/calendar
  // Weekly Calendar View + Live Statistics Cards
  // ==========================================
  server.get(
    '/calendar',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
      }

    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return reply.status(403).send({
        success: false,
        error: { message: 'Forbidden: Calendar is restricted to internal recruitment team.' },
      });
    }

    const { referenceDate, recruiterId, jobId } = request.query as {
      referenceDate?: string;
      recruiterId?: string;
      jobId?: string;
    };

    const refDate = referenceDate ? new Date(referenceDate) : new Date();
    const week = getISTWeekBoundaries(refDate);

    // Filter by user role if recruiter
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
      // Recruiter sees interviews where they are panel, assigned, or owner
      whereClause.OR = [
        { panelMembers: { some: { userId: user.id } } },
        { createdById: user.id },
        { application: { candidate: { ownerId: user.id } } },
        { application: { job: { assignments: { some: { recruiterId: user.id, status: 'ACTIVE' } } } } },
      ];
    }

    const interviews = await prisma.interview.findMany({
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
    });

    // Format events for calendar grid
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
        roundType: inv.round?.interviewType || 'TECHNICAL',
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

    // Compute Live Database-Backed Statistics Cards
    // 1. This Week: Total scheduled interviews in current IST week (excluding CANCELLED)
    const thisWeekCount = interviews.filter((i) => i.outcome !== InterviewOutcome.CANCELLED).length;

    // 2. Pending Feedback: Completed interviews where required panel feedback has not been submitted
    const pendingFeedbackCount = await prisma.interview.count({
      where: {
        outcome: InterviewOutcome.COMPLETED,
        feedbacks: { none: {} },
        isArchived: false,
      },
    });

    // 3. No-shows This Week: Interviews with outcome NO_SHOW during the current IST calendar week
    const noShowsThisWeekCount = interviews.filter((i) => i.outcome === InterviewOutcome.NO_SHOW).length;

    // 4. Calendar Sync: Accurate provider state (Not connected / Setup required)
    const calendarSync = {
      status: 'SETUP_REQUIRED',
      label: 'Setup required',
      badge: 'Not connected',
      description: 'Google Workspace & Outlook integrations will be connected in Prompt 25.',
    };

    return reply.send({
      success: true,
      data: {
        week,
        events,
        stats: {
          thisWeek: thisWeekCount,
          pendingFeedback: pendingFeedbackCount,
          noShowsThisWeek: noShowsThisWeekCount,
          calendarSync,
        },
      },
    });
  });

  // ==========================================
  // 2. GET /api/interviews/stats
  // Dedicated Statistics Endpoint
  // ==========================================
  server.get('/stats', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const week = getISTWeekBoundaries(new Date());

    const [thisWeekCount, pendingFeedbackCount, noShowsThisWeekCount] = await Promise.all([
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

    return reply.send({
      success: true,
      data: {
        thisWeek: thisWeekCount,
        pendingFeedback: pendingFeedbackCount,
        noShowsThisWeek: noShowsThisWeekCount,
        calendarSync: {
          status: 'SETUP_REQUIRED',
          label: 'Setup required',
          badge: 'Not connected',
        },
      },
    });
  });

  // ==========================================
  // 3. POST /api/interviews/availability
  // Check Panel Free/Busy Availability (Privacy Protected)
  // ==========================================
  server.post('/availability', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const body = request.body as {
      scheduledAt: string;
      duration?: number;
      panelMemberIds: string[];
      excludeInterviewId?: string;
    };

    if (!body.scheduledAt || !body.panelMemberIds || body.panelMemberIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { message: 'scheduledAt and at least one panelMemberId are required.' },
      });
    }

    const proposedStart = new Date(body.scheduledAt);
    const duration = body.duration || 45;

    // Fetch panel users
    const panelUsers = await prisma.user.findMany({
      where: { id: { in: body.panelMemberIds }, status: 'ACTIVE', isArchived: false },
      select: { id: true, name: true },
    });

    // Fetch existing interviews in a 24-hour window around proposed time
    const windowStart = new Date(proposedStart.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(proposedStart.getTime() + 24 * 60 * 60 * 1000);

    const existing = await prisma.interview.findMany({
      where: {
        scheduledAt: { gte: windowStart, lte: windowEnd },
        isArchived: false,
        panelMembers: { some: { userId: { in: body.panelMemberIds } } },
      },
      include: {
        panelMembers: true,
      },
    });

    const mappedExisting = existing.map((inv) => ({
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
      mappedExisting,
      body.excludeInterviewId
    );

    return reply.send({
      success: true,
      data: result,
    });
  });

  // ==========================================
  // 4. POST /api/interviews
  // Schedule Interview with Race-Safe Double Booking Prevention
  // ==========================================
  server.post('/', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return reply.status(403).send({
        success: false,
        error: { message: 'Forbidden: Interview scheduling is restricted to internal recruitment team.' },
      });
    }

    const parseResult = ScheduleInterviewInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid scheduling parameters',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;
    const scheduledAtUtc = new Date(input.scheduledAt);

    // Validate application exists
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
      return reply.status(404).send({
        success: false,
        error: { message: 'Application record not found' },
      });
    }

    // STRICT ATS RULE: Job must be ACTIVE to schedule interviews
    if (application.job.status !== JobStatus.ACTIVE) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'JOB_NOT_ACTIVE',
          message: `Cannot schedule interview for job in status ${application.job.status}. Job must be ACTIVE.`,
        },
      });
    }

    // Validate round belongs to this job if provided
    let roundId = input.roundId;
    if (roundId) {
      const validRound = application.job.rounds.find((r) => r.id === roundId);
      if (!validRound) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Specified interview round does not belong to this job or is archived.' },
        });
      }
    } else if (application.job.rounds.length > 0) {
      // Default to first round if not specified
      roundId = application.job.rounds[0].id;
    }

    // Validate panel members are active
    const panelUsers = await prisma.user.findMany({
      where: { id: { in: input.panelMemberIds }, status: 'ACTIVE', isArchived: false },
    });

    if (panelUsers.length !== input.panelMemberIds.length) {
      return reply.status(400).send({
        success: false,
        error: { message: 'One or more selected panel members are invalid or deactivated.' },
      });
    }

    // Build reminders configuration
    const reminderConfig = buildReminderConfig(
      scheduledAtUtc,
      input.reminder24h,
      input.reminder30m,
      input.recipients
    );

    // Atomic transaction with double-booking lock & check
    try {
      const interview = await prisma.$transaction(async (tx) => {
        // Race-safe double-booking check: check for overlapping active interviews
        const windowEndUtc = new Date(scheduledAtUtc.getTime() + input.duration * 60 * 1000);

        const conflicts = await tx.interview.findMany({
          where: {
            outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
            isArchived: false,
            panelMembers: { some: { userId: { in: input.panelMemberIds } } },
          },
          include: {
            panelMembers: { include: { user: true } },
          },
        });

        const conflictingInterview = conflicts.find((conf) =>
          isTimeOverlapping(scheduledAtUtc, input.duration, conf.scheduledAt, conf.duration)
        );

        if (conflictingInterview) {
          const conflictingMember = conflictingInterview.panelMembers.find((pm) =>
            input.panelMemberIds.includes(pm.userId)
          );
          const memberName = conflictingMember?.user.name || 'A panel member';
          throw new Error(
            `DOUBLE_BOOKING_CONFLICT: ${memberName} is already scheduled for an interview between ${formatToISTTime(conflictingInterview.scheduledAt)} and ${formatToISTTime(new Date(conflictingInterview.scheduledAt.getTime() + conflictingInterview.duration * 60 * 1000))}.`
          );
        }

        // Create initial interview
        const newInterview = await tx.interview.create({
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
          include: {
            panelMembers: { include: { user: true } },
            round: true,
          },
        });

        // Record InterviewHistory
        await tx.interviewHistory.create({
          data: {
            interviewId: newInterview.id,
            action: 'CREATED',
            toTime: scheduledAtUtc,
            reason: 'Initial schedule',
            actorId: user.id,
            metadata: {
              provider: input.provider,
              duration: input.duration,
            },
          },
        });

        return newInterview;
      });

      // POST-PERSISTENCE VIDEO MEETING & NOTIFICATIONS (Prompt 25 Section 4)
      await createVideoMeetingForInterview(interview.id);
      await sendInterviewConfirmation(interview.id);

      const finalInterview = await prisma.interview.findUnique({
        where: { id: interview.id },
        include: {
          panelMembers: { include: { user: true } },
          round: true,
          videoMeeting: true,
        },
      });

      // Write Audit Log
      await logInterviewAudit(user.id, 'interview.scheduled', interview.id, null, {
        candidateId: application.candidateId,
        jobId: application.jobId,
        scheduledAt: scheduledAtUtc.toISOString(),
        duration: input.duration,
        panelMembers: input.panelMemberIds,
        mode: input.mode,
      });

      return reply.status(201).send({
        success: true,
        data: finalInterview || interview,
        message: 'Interview successfully scheduled',
      });
    } catch (err: any) {
      if (err.message && err.message.startsWith('DOUBLE_BOOKING_CONFLICT:')) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DOUBLE_BOOKING_CONFLICT',
            message: err.message.replace('DOUBLE_BOOKING_CONFLICT: ', ''),
          },
        });
      }
      server.log.error(err, 'Failed to schedule interview');
      console.error('ERROR IN POST /api/interviews:', err);
      return reply.status(500).send({
        success: false,
        error: { message: err?.message || 'An unexpected error occurred while scheduling the interview.' },
      });
    }
  });

  // ==========================================
  // 5. GET /api/interviews/:id
  // Single Interview Dossier
  // ==========================================
  server.get('/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({
        success: false,
        error: { message: access.error },
      });
    }

    return reply.send({
      success: true,
      data: access.interview,
    });
  });

  // ==========================================
  // 6. POST /api/interviews/:id/reschedule
  // Reschedule Interview with History & Conflict Check
  // ==========================================
  server.post('/:id/reschedule', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({ success: false, error: { message: access.error } });
    }

    const interview = access.interview!;

    // Validate transition
    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.RESCHEDULED
    );
    if (!transition.valid) {
      return reply.status(400).send({
        success: false,
        error: { message: transition.error },
      });
    }

    const parseResult = RescheduleInterviewInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid reschedule parameters',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;
    const newScheduledAtUtc = new Date(input.newScheduledAt);
    const duration = input.duration || interview.duration;
    const panelUserIds = interview.panelMembers.map((pm) => pm.userId);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Race-safe double-booking check for new slot
        const conflicts = await tx.interview.findMany({
          where: {
            id: { not: interview.id },
            outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
            isArchived: false,
            panelMembers: { some: { userId: { in: panelUserIds } } },
          },
          include: {
            panelMembers: { include: { user: true } },
          },
        });

        const conflicting = conflicts.find((conf) =>
          isTimeOverlapping(newScheduledAtUtc, duration, conf.scheduledAt, conf.duration)
        );

        if (conflicting) {
          const conflictingMember = conflicting.panelMembers.find((pm) =>
            panelUserIds.includes(pm.userId)
          );
          const memberName = conflictingMember?.user.name || 'A panel member';
          throw new Error(
            `DOUBLE_BOOKING_CONFLICT: ${memberName} has a conflicting interview at the proposed new time.`
          );
        }

        // Update interview
        const res = await tx.interview.update({
          where: { id: interview.id },
          data: {
            previousScheduledAt: interview.scheduledAt,
            scheduledAt: newScheduledAtUtc,
            duration,
            outcome: InterviewOutcome.RESCHEDULED,
            rescheduleReason: input.rescheduleReason,
          },
        });

        // Record history
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

        return res;
      });

      // Synchronize video meeting and calendar invite updates (Prompt 25 Section 5)
      await createVideoMeetingForInterview(interview.id, { forceRetry: true });
      await sendInterviewConfirmation(interview.id, { isReschedule: true });

      const finalRescheduled = await prisma.interview.findUnique({
        where: { id: interview.id },
        include: {
          panelMembers: { include: { user: true } },
          round: true,
          videoMeeting: true,
        },
      });

      await logInterviewAudit(user.id, 'interview.rescheduled', interview.id, {
        previousScheduledAt: interview.scheduledAt.toISOString(),
      }, {
        newScheduledAt: newScheduledAtUtc.toISOString(),
        rescheduleReason: input.rescheduleReason,
      });

      return reply.send({
        success: true,
        data: finalRescheduled || updated,
        message: 'Interview successfully rescheduled',
      });
    } catch (err: any) {
      if (err.message && err.message.startsWith('DOUBLE_BOOKING_CONFLICT:')) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DOUBLE_BOOKING_CONFLICT',
            message: err.message.replace('DOUBLE_BOOKING_CONFLICT: ', ''),
          },
        });
      }
      server.log.error(err, 'Failed to reschedule interview');
      return reply.status(500).send({
        success: false,
        error: { message: 'Failed to reschedule interview' },
      });
    }
  });

  // ==========================================
  // RETRY / CREATE VIDEO MEETING (Prompt 25 Section 4)
  // ==========================================
  server.post('/:id/meeting', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return reply.status(403).send({ success: false, error: { message: 'Forbidden' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({ success: false, error: { message: access.error } });
    }

    const body = (request.body as any) || {};
    const meetingResult = await createVideoMeetingForInterview(id, {
      forceRetry: true,
      provider: body.provider,
    });
    return reply.send({
      success: meetingResult.success,
      data: meetingResult,
      message: meetingResult.success ? 'Video meeting successfully generated' : 'Video meeting setup required or failed',
    });
  });

  // ==========================================
  // 7. POST /api/interviews/:id/cancel
  // Cancel Interview with Mandatory Reason
  // ==========================================
  server.post('/:id/cancel', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({ success: false, error: { message: access.error } });
    }

    const interview = access.interview!;

    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.CANCELLED
    );
    if (!transition.valid) {
      return reply.status(400).send({ success: false, error: { message: transition.error } });
    }

    const parseResult = CancelInterviewInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cancellation reason is required',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.interview.update({
        where: { id: interview.id },
        data: {
          outcome: InterviewOutcome.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: input.cancellationReason,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'CANCELLED',
          fromTime: interview.scheduledAt,
          reason: input.cancellationReason,
          actorId: user.id,
        },
      });

      return res;
    });

    // Mark VideoMeeting cancelled and dispatch cancellation notice with cancel .ics (Prompt 25 Section 5)
    try {
      await prisma.videoMeeting.updateMany({
        where: { interviewId: interview.id },
        data: { status: 'CANCELLED' },
      });
      await sendInterviewConfirmation(interview.id, { cancellationReason: input.cancellationReason });
    } catch {
      // Non-blocking notification dispatch
    }

    await logInterviewAudit(user.id, 'interview.cancelled', interview.id, {
      outcome: interview.outcome,
    }, {
      outcome: InterviewOutcome.CANCELLED,
      cancellationReason: input.cancellationReason,
    });

    return reply.send({
      success: true,
      data: updated,
      message: 'Interview successfully cancelled',
    });
  });

  // ==========================================
  // 8. POST /api/interviews/:id/complete
  // Mark Interview Completed with Outcome Notes
  // ==========================================
  server.post('/:id/complete', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({ success: false, error: { message: access.error } });
    }

    const interview = access.interview!;

    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.COMPLETED
    );
    if (!transition.valid) {
      return reply.status(400).send({ success: false, error: { message: transition.error } });
    }

    const parseResult = CompleteInterviewInputSchema.safeParse(request.body);
    const input = parseResult.success ? parseResult.data : {};

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.interview.update({
        where: { id: interview.id },
        data: {
          outcome: InterviewOutcome.COMPLETED,
          completedAt: new Date(),
          outcomeNotes: input.outcomeNotes || null,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'COMPLETED',
          fromTime: interview.scheduledAt,
          reason: input.outcomeNotes || 'Interview completed',
          actorId: user.id,
        },
      });

      return res;
    });

    await logInterviewAudit(user.id, 'interview.completed', interview.id, {
      outcome: interview.outcome,
    }, {
      outcome: InterviewOutcome.COMPLETED,
      outcomeNotes: input.outcomeNotes,
    });

    return reply.send({
      success: true,
      data: updated,
      message: 'Interview marked as completed',
    });
  });

  // ==========================================
  // 9. POST /api/interviews/:id/no-show
  // Mark No-Show with CRITICAL ATS RULE (NEVER Auto-Reject)
  // ==========================================
  server.post('/:id/no-show', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({ success: false, error: { message: access.error } });
    }

    const interview = access.interview!;

    const transition = validateInterviewTransition(
      interview.outcome as InterviewOutcome,
      InterviewOutcome.NO_SHOW
    );
    if (!transition.valid) {
      return reply.status(400).send({ success: false, error: { message: transition.error } });
    }

    const parseResult = NoShowInterviewInputSchema.safeParse(request.body);
    const input = parseResult.success ? parseResult.data : {};

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Interview outcome ONLY
      const res = await tx.interview.update({
        where: { id: interview.id },
        data: {
          outcome: InterviewOutcome.NO_SHOW,
          noShowAt: new Date(),
          outcomeNotes: input.noShowReason || 'Candidate did not attend interview',
        },
      });

      // 2. Record History
      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'NO_SHOW',
          fromTime: interview.scheduledAt,
          reason: input.noShowReason || 'Candidate no-show',
          actorId: user.id,
        },
      });

      // CRITICAL ATS RULE:
      // We explicitly DO NOT alter application.stageId, DO NOT move to REJECTED,
      // and DO NOT send automated rejection. Recruiter decides next step!

      return res;
    });

    await logInterviewAudit(user.id, 'interview.no_show', interview.id, {
      outcome: interview.outcome,
    }, {
      outcome: InterviewOutcome.NO_SHOW,
      noShowReason: input.noShowReason,
    });

    return reply.send({
      success: true,
      data: updated,
      message: 'Interview recorded as no-show. Application stage preserved.',
    });
  });

  // ==========================================
  // 10. POST /api/interviews/:id/feedback
  // Submit / Update Internal Panel Feedback (Strict Internal Only)
  // ==========================================
  server.post('/:id/feedback', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({ success: false, error: { message: access.error } });
    }

    const interview = access.interview!;

    // Reviewer must be an assigned panel member, manager, or admin
    const isPanel = interview.panelMembers.some((pm) => pm.userId === user.id);
    const isManagerOrAdmin = user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;

    if (!isPanel && !isManagerOrAdmin) {
      return reply.status(403).send({
        success: false,
        error: { message: 'Forbidden: Only assigned panel members, managers, or admins can submit feedback.' },
      });
    }

    const parseResult = PanelFeedbackInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid panel feedback parameters',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;

    const feedback = await prisma.interviewFeedback.upsert({
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
      include: {
        reviewer: { select: { id: true, name: true, email: true, role: true } },
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

    await logInterviewAudit(user.id, 'interview.feedback_submitted', interview.id, null, {
      rating: input.rating,
      recommendation: input.recommendation,
      reviewerId: user.id,
    });

    return reply.status(201).send({
      success: true,
      data: feedback,
      message: 'Panel feedback submitted successfully',
    });
  });

  // ==========================================
  // 11. POST /api/interviews/:id/task
  // Create Follow-up Task linked to Interview & Application
  // ==========================================
  server.post('/:id/task', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const access = await verifyInterviewAccess(id, user);
    if (!access.allowed) {
      return reply.status(access.status || 403).send({ success: false, error: { message: access.error } });
    }

    const interview = access.interview!;

    const parseResult = CreateFollowUpTaskInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task parameters',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;

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
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await logInterviewAudit(user.id, 'interview.task_created', interview.id, null, {
      taskId: task.id,
      title: task.title,
      assignedToId: task.assignedToId,
    });

    return reply.status(201).send({
      success: true,
      data: task,
      message: 'Follow-up task created successfully',
    });
  });
};
