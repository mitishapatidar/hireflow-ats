import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  JobStatus,
  InterviewOutcome,
  CreateSlotInvitationSchema,
  ConfirmSlotBookingSchema,
  generateSlotInvitationToken,
  hashSlotToken,
  PublicSlotInvitationDTO,
  isTimeOverlapping,
  NotificationCategoryEnum,
  NotificationChannelEnum,
} from '@hireflow/shared';
import { createVideoMeetingForInterview, sendInterviewConfirmation } from '../services/video-meetings.js';
import { notificationQueue } from '../queue/notification-queue.js';

export const slotInvitationRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ==========================================
  // 1. POST /api/slot-invitations
  // Recruiter creates and dispatches slot invitation
  // ==========================================
  server.post('/', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return reply.status(403).send({
        success: false,
        error: { message: 'Forbidden: Only recruiters, managers and admins can create slot invitations.' },
      });
    }

    const parseResult = CreateSlotInvitationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid slot invitation parameters',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;

    // Validate application and active job
    const application = await prisma.application.findUnique({
      where: { id: input.applicationId },
      include: {
        candidate: true,
        job: { include: { client: true } },
      },
    });

    if (!application) {
      return reply.status(404).send({ success: false, error: { message: 'Application record not found' } });
    }

    if (application.job.status !== JobStatus.ACTIVE) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'JOB_NOT_ACTIVE',
          message: `Cannot send interview invites for job in status ${application.job.status}. Job must be ACTIVE.`,
        },
      });
    }

    // Generate cryptographic token & hash
    const { token, tokenHash } = generateSlotInvitationToken();
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

    // Persist invitation & options in a transaction
    const invitation = await prisma.$transaction(async (tx) => {
      const inv = await tx.slotInvitation.create({
        data: {
          applicationId: input.applicationId,
          roundId: input.roundId || null,
          token,
          tokenHash,
          status: 'PENDING',
          expiresAt,
          duration: input.duration,
          timezone: input.timezone,
          panelMemberIds: input.panelMemberIds,
          notes: input.notes || null,
          createdById: user.id,
        },
      });

      await tx.slotOption.createMany({
        data: input.slots.map((s) => ({
          invitationId: inv.id,
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
          isAvailable: true,
          isSelected: false,
        })),
      });

      const options = await tx.slotOption.findMany({
        where: { invitationId: inv.id },
        orderBy: { startTime: 'asc' },
      });

      return {
        ...inv,
        slotOptions: options,
      };
    });

    // Send invitation email to candidate
    const scheduleUrl = `/schedule/${token}`;
    await notificationQueue.dispatch({
      userId: application.candidate.userId || 'candidate-placeholder',
      recipientEmail: application.candidate.email,
      category: NotificationCategoryEnum.INTERVIEW,
      priority: 'HIGH',
      title: 'Action Required: Choose your interview time slot',
      message: `You have been invited to schedule your interview for ${application.job.title}. Please choose an available time slot within ${input.expiresInHours} hours.`,
      linkUrl: scheduleUrl,
      channels: [NotificationChannelEnum.EMAIL, NotificationChannelEnum.IN_APP],
      metadata: {
        applicationId: application.id,
        invitationId: invitation.id,
        scheduleUrl,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'SLOT_INVITATION_CREATED',
        entity: 'SlotInvitation',
        entityId: invitation.id,
        after: {
          applicationId: application.id,
          slotsCount: input.slots.length,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return reply.status(201).send({
      success: true,
      data: invitation,
      message: 'Slot invitation successfully created and dispatched',
    });
  });

  // ==========================================
  // 2. GET /api/slot-invitations/:id
  // Recruiter inspects slot invitation
  // ==========================================
  server.get('/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = request.params as { id: string };
    const invitation = await prisma.slotInvitation.findUnique({
      where: { id },
      include: {
        slotOptions: true,
        application: {
          include: {
            candidate: true,
            job: true,
          },
        },
        interview: {
          include: {
            videoMeeting: true,
            panelMembers: { include: { user: true } },
          },
        },
      },
    });

    if (!invitation) {
      return reply.status(404).send({ success: false, error: { message: 'Invitation not found' } });
    }

    return reply.send({ success: true, data: invitation });
  });

  // ==========================================
  // 3. DELETE /api/slot-invitations/:id
  // Revoke slot invitation
  // ==========================================
  server.delete('/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      return reply.status(403).send({ success: false, error: { message: 'Forbidden' } });
    }

    const { id } = request.params as { id: string };
    const updated = await prisma.slotInvitation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return reply.send({ success: true, data: updated, message: 'Slot invitation revoked' });
  });

  // ==========================================
  // 4. GET /api/public/slots/:token
  // Public candidate slot viewing (Figma Frame 44)
  // ==========================================
  server.get('/public/slots/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const tokenHash = hashSlotToken(token);

    const invitation = await prisma.slotInvitation.findFirst({
      where: {
        OR: [{ tokenHash }, { token }],
        isArchived: false,
      },
      include: {
        slotOptions: { orderBy: { startTime: 'asc' } },
        application: {
          include: {
            candidate: true,
            job: {
              include: {
                client: true,
                rounds: true,
              },
            },
          },
        },
        interview: {
          include: {
            videoMeeting: true,
          },
        },
      },
    });

    if (!invitation) {
      return reply.status(404).send({
        success: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'This interview scheduling link is invalid or expired.' },
      });
    }

    // Check expiration
    const now = new Date();
    let currentStatus = invitation.status;
    if (currentStatus === 'PENDING' && new Date(invitation.expiresAt) < now) {
      currentStatus = 'EXPIRED';
      await prisma.slotInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
    }

    const round = invitation.application.job.rounds.find((r) => r.id === invitation.roundId);
    const roundName = round?.name || 'Technical Round';

    // Query active interviews for panel members to evaluate real-time slot conflicts
    const panelInterviews = await prisma.interview.findMany({
      where: {
        outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
        isArchived: false,
        panelMembers: { some: { userId: { in: invitation.panelMemberIds } } },
      },
    });

    const evaluatedOptions = invitation.slotOptions.map((opt) => {
      // Re-verify if panel member is currently free during this slot
      const isConflicted = panelInterviews.some((pi) =>
        isTimeOverlapping(opt.startTime, invitation.duration, pi.scheduledAt, pi.duration)
      );

      return {
        id: opt.id,
        startTime: opt.startTime.toISOString(),
        endTime: opt.endTime.toISOString(),
        isAvailable: opt.isAvailable && !isConflicted,
      };
    });

    const dto: PublicSlotInvitationDTO = {
      token,
      status: currentStatus as any,
      expiresAt: invitation.expiresAt.toISOString(),
      candidateName: invitation.application.candidate.name,
      jobTitle: invitation.application.job.title,
      roundName,
      duration: invitation.duration,
      timezone: invitation.timezone,
      slotOptions: evaluatedOptions,
      bookedInterview: invitation.interview
        ? {
            scheduledAt: invitation.interview.scheduledAt.toISOString(),
            duration: invitation.interview.duration,
            timezone: invitation.interview.timezone,
            meetingLink: invitation.interview.videoMeeting?.joinUrl || invitation.interview.meetingLink,
          }
        : null,
    };

    return reply.send({ success: true, data: dto });
  });

  // ==========================================
  // 5. POST /api/public/slots/:token/confirm
  // Public candidate booking with atomic double-booking lock (Prompt 25 Section 9)
  // ==========================================
  server.post('/public/slots/:token/confirm', async (request, reply) => {
    const { token } = request.params as { token: string };
    const tokenHash = hashSlotToken(token);

    const parseResult = ConfirmSlotBookingSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid booking parameters',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;

    // RACE-SAFE ATOMIC BOOKING TRANSACTION
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Fetch invitation with lock
        const invitation = await tx.slotInvitation.findFirst({
          where: {
            OR: [{ tokenHash }, { token }],
            isArchived: false,
          },
          include: {
            slotOptions: true,
            application: {
              include: {
                candidate: true,
                job: true,
              },
            },
          },
        });

        if (!invitation) {
          throw new Error('INVITATION_NOT_FOUND');
        }

        if (invitation.status !== 'PENDING') {
          throw new Error(`INVITATION_STATUS_${invitation.status}`);
        }

        if (new Date(invitation.expiresAt) < new Date()) {
          throw new Error('INVITATION_EXPIRED');
        }

        // 2. Locate requested slot option
        const selectedSlot = invitation.slotOptions.find((opt) => opt.id === input.slotOptionId);
        if (!selectedSlot) {
          throw new Error('SLOT_NOT_FOUND');
        }

        if (!selectedSlot.isAvailable) {
          throw new Error('SLOT_UNAVAILABLE');
        }

        // 3. Re-verify panel member availability (conflict check)
        const panelConflicts = await tx.interview.findMany({
          where: {
            outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
            isArchived: false,
            panelMembers: { some: { userId: { in: invitation.panelMemberIds } } },
          },
        });

        const hasConflict = panelConflicts.some((pi) =>
          isTimeOverlapping(selectedSlot.startTime, invitation.duration, pi.scheduledAt, pi.duration)
        );

        if (hasConflict) {
          throw new Error('DOUBLE_BOOKING_CONFLICT');
        }

        // 4. Create Interview in DB
        const newInterview = await tx.interview.create({
          data: {
            applicationId: invitation.applicationId,
            roundId: invitation.roundId || null,
            scheduledAt: selectedSlot.startTime,
            duration: invitation.duration,
            timezone: input.timezone || invitation.timezone,
            mode: 'VIDEO',
            provider: 'GOOGLE_MEET',
            outcome: InterviewOutcome.SCHEDULED,
            createdById: invitation.createdById,
            panelMembers: {
              createMany: {
                data: invitation.panelMemberIds.map((userId) => ({
                  userId,
                  role: 'INTERVIEWER',
                  createdById: invitation.createdById,
                })),
              },
            },
          },
        });

        // 5. Update SlotInvitation & Option
        await tx.slotInvitation.update({
          where: { id: invitation.id },
          data: {
            status: 'BOOKED',
            interviewId: newInterview.id,
          },
        });

        await tx.slotOption.update({
          where: { id: selectedSlot.id },
          data: {
            isSelected: true,
            isAvailable: false,
          },
        });

        // 6. Record InterviewHistory
        await tx.interviewHistory.create({
          data: {
            interviewId: newInterview.id,
            action: 'BOOKED_VIA_SELF_SCHEDULING',
            toTime: selectedSlot.startTime,
            reason: input.candidateNotes || 'Booked via self-scheduling link',
            metadata: {
              invitationId: invitation.id,
              slotOptionId: selectedSlot.id,
              candidateNotes: input.candidateNotes,
            },
          },
        });

        return { newInterview, invitation };
      });

      // POST-TRANSACTION: Trigger video meeting creation and notifications
      const meetingResult = await createVideoMeetingForInterview(result.newInterview.id);
      await sendInterviewConfirmation(result.newInterview.id);

      return reply.send({
        success: true,
        message: 'Interview slot successfully confirmed and scheduled',
        data: {
          interviewId: result.newInterview.id,
          scheduledAt: result.newInterview.scheduledAt.toISOString(),
          duration: result.newInterview.duration,
          meetingLink: meetingResult.meetingLink,
          meetingUrl: meetingResult.meetingLink,
          status: 'CONFIRMED',
        },
      });
    } catch (err: any) {
      if (err.message === 'DOUBLE_BOOKING_CONFLICT' || err.message === 'SLOT_UNAVAILABLE') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'SLOT_NO_LONGER_AVAILABLE',
            message: 'This interview time slot was just selected by another applicant or panelist. Please select another slot.',
          },
        });
      }

      if (err.message && err.message.startsWith('INVITATION_STATUS_')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVITATION_ALREADY_USED',
            message: 'This self-scheduling invitation has already been booked or cancelled.',
          },
        });
      }

      if (err.message === 'INVITATION_EXPIRED') {
        return reply.status(410).send({
          success: false,
          error: {
            code: 'INVITATION_EXPIRED',
            message: 'This self-scheduling invitation has expired. Please contact your recruiter for a new link.',
          },
        });
      }

      server.log.error(err, 'Failed to confirm slot booking');
      return reply.status(500).send({
        success: false,
        error: { message: 'An unexpected error occurred while confirming the slot booking.' },
      });
    }
  });
};
