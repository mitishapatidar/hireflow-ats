'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  JobStatus,
  InterviewOutcome,
  CreateSlotInvitationSchema,
  CreateSlotInvitationInput,
  ConfirmSlotBookingSchema,
  ConfirmSlotBookingInput,
  generateSlotInvitationToken,
  hashSlotToken,
  PublicSlotInvitationDTO,
  isTimeOverlapping,
} from '@hireflow/shared';

function canManageSlots(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.RECRUITER;
}

/**
 * Recruiter creates a slot invitation for a candidate
 */
export async function createSlotInvitationAction(input: CreateSlotInvitationInput) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageSlots(user.role)) {
      return { success: false, error: 'Unauthorized or forbidden' };
    }

    const validation = CreateSlotInvitationSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: 'Invalid input parameters' };
    }

    const { applicationId, roundId, duration, timezone, panelMemberIds, notes, expiresInHours, slots } = validation.data;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: true,
      },
    });

    if (!application) {
      return { success: false, error: 'Application record not found' };
    }

    if (application.job.status !== JobStatus.ACTIVE) {
      return { success: false, error: `Job must be ACTIVE to send slot invitations (current status: ${application.job.status})` };
    }

    const { token, tokenHash } = generateSlotInvitationToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const invitation = await prisma.$transaction(async (tx) => {
      const inv = await tx.slotInvitation.create({
        data: {
          applicationId,
          roundId: roundId || null,
          token,
          tokenHash,
          status: 'PENDING',
          expiresAt,
          duration,
          timezone,
          panelMemberIds,
          notes: notes || null,
          createdById: user.id,
        },
      });

      await tx.slotOption.createMany({
        data: slots.map((s) => ({
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

      return { ...inv, slotOptions: options };
    });

    revalidatePath(`/pipeline`);
    revalidatePath(`/jobs/${application.jobId}`);

    return {
      success: true,
      data: {
        id: invitation.id,
        token: invitation.token,
        bookingUrl: `/schedule/${invitation.token}`,
        expiresAt: invitation.expiresAt.toISOString(),
        slotsCount: invitation.slotOptions.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create slot invitation' };
  }
}

/**
 * Public action to retrieve slot invitation for candidate booking UI (Frame 44)
 */
export async function getPublicSlotInvitationAction(rawToken: string) {
  try {
    if (!rawToken || typeof rawToken !== 'string') {
      return { success: false, error: 'Valid invitation token is required' };
    }

    const tokenHash = hashSlotToken(rawToken);

    const invitation = await prisma.slotInvitation.findFirst({
      where: {
        OR: [{ tokenHash }, { token: rawToken }],
        isArchived: false,
      },
      include: {
        application: {
          include: {
            candidate: true,
            job: {
              include: { client: true },
            },
          },
        },
        slotOptions: {
          orderBy: { startTime: 'asc' },
        },
        interview: true,
      },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation link is invalid or has been revoked.' };
    }

    const isExpired = new Date() > invitation.expiresAt;
    const effectiveStatus = isExpired && invitation.status === 'PENDING' ? 'EXPIRED' : invitation.status;

    // Evaluate live panel member availability to prevent offering already-booked slots
    const panelInterviews = await prisma.interview.findMany({
      where: {
        isArchived: false,
        outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
        panelMembers: { some: { userId: { in: invitation.panelMemberIds } } },
      },
      select: {
        scheduledAt: true,
        duration: true,
      },
    });

    const evaluatedSlots = invitation.slotOptions.map((opt) => {
      if (!opt.isAvailable || opt.isSelected || effectiveStatus !== 'PENDING') {
        return {
          id: opt.id,
          startTime: opt.startTime.toISOString(),
          endTime: opt.endTime.toISOString(),
          isAvailable: false,
        };
      }

      const hasConflict = panelInterviews.some((pi) =>
        isTimeOverlapping(opt.startTime, invitation.duration, pi.scheduledAt, pi.duration)
      );

      return {
        id: opt.id,
        startTime: opt.startTime.toISOString(),
        endTime: opt.endTime.toISOString(),
        isAvailable: !hasConflict,
      };
    });

    // Resolve round name
    let roundName = 'Interview Round';
    if (invitation.roundId) {
      const round = await prisma.jobRound.findUnique({
        where: { id: invitation.roundId },
      });
      if (round) roundName = round.name;
    }

    const dto: PublicSlotInvitationDTO = {
      token: rawToken,
      status: effectiveStatus as any,
      expiresAt: invitation.expiresAt.toISOString(),
      candidateName: invitation.application.candidate.name,
      jobTitle: invitation.application.job.title,
      roundName,
      duration: invitation.duration,
      timezone: invitation.timezone,
      slotOptions: evaluatedSlots,
      bookedInterview: invitation.interview
        ? {
            scheduledAt: invitation.interview.scheduledAt.toISOString(),
            duration: invitation.interview.duration,
            timezone: invitation.interview.timezone,
            meetingLink: invitation.interview.meetingLink,
          }
        : null,
    };

    return { success: true, data: dto };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load slot invitation' };
  }
}

/**
 * Public action for candidate to book slot atomically (Frame 44)
 */
export async function confirmSlotBookingAction(rawToken: string, input: ConfirmSlotBookingInput) {
  try {
    const validation = ConfirmSlotBookingSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: 'Invalid booking data' };
    }

    const { slotOptionId, timezone, candidateNotes } = validation.data;
    const tokenHash = hashSlotToken(rawToken);

    const invitation = await prisma.slotInvitation.findFirst({
      where: {
        OR: [{ tokenHash }, { token: rawToken }],
        isArchived: false,
      },
      include: {
        application: {
          include: {
            candidate: true,
            job: true,
          },
        },
        slotOptions: true,
      },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    if (invitation.status !== 'PENDING' || new Date() > invitation.expiresAt) {
      return { success: false, error: 'This invitation has already been booked or has expired.' };
    }

    const selectedSlot = invitation.slotOptions.find((s) => s.id === slotOptionId);
    if (!selectedSlot || !selectedSlot.isAvailable) {
      return { success: false, error: 'Selected slot is no longer available. Please select another slot.' };
    }

    // Atomic transaction
    const bookingResult = await prisma.$transaction(async (tx) => {
      // Re-verify slot availability inside transaction
      const slotFresh = await tx.slotOption.findUnique({
        where: { id: selectedSlot.id },
      });

      if (!slotFresh || !slotFresh.isAvailable || slotFresh.isSelected) {
        throw new Error('SLOT_NOT_AVAILABLE');
      }

      // Check panel member conflicts
      const conflicts = await tx.interview.findMany({
        where: {
          isArchived: false,
          outcome: { in: [InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED] },
          panelMembers: { some: { userId: { in: invitation.panelMemberIds } } },
        },
        select: { scheduledAt: true, duration: true },
      });

      const hasConflict = conflicts.some((c) =>
        isTimeOverlapping(selectedSlot.startTime, invitation.duration, c.scheduledAt, c.duration)
      );

      if (hasConflict) {
        throw new Error('SLOT_NOT_AVAILABLE');
      }

      // Create Interview
      const newInterview = await tx.interview.create({
        data: {
          applicationId: invitation.applicationId,
          roundId: invitation.roundId || null,
          scheduledAt: selectedSlot.startTime,
          duration: invitation.duration,
          timezone: timezone || invitation.timezone,
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

      // Update Invitation & Option
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

      await tx.interviewHistory.create({
        data: {
          interviewId: newInterview.id,
          action: 'BOOKED_VIA_SELF_SCHEDULING',
          toTime: selectedSlot.startTime,
          reason: candidateNotes || 'Booked via public self-scheduling link',
          metadata: {
            invitationId: invitation.id,
            slotOptionId: selectedSlot.id,
            candidateNotes,
          },
        },
      });

      return newInterview;
    });

    return {
      success: true,
      data: {
        interviewId: bookingResult.id,
        scheduledAt: bookingResult.scheduledAt.toISOString(),
        duration: bookingResult.duration,
        status: 'CONFIRMED',
      },
    };
  } catch (err: any) {
    if (err.message === 'SLOT_NOT_AVAILABLE') {
      return { success: false, error: 'The selected slot is no longer available. Please choose a different time.' };
    }
    return { success: false, error: err.message || 'Failed to book slot' };
  }
}

/**
 * Recruiter revokes slot invitation
 */
export async function revokeSlotInvitationAction(invitationId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageSlots(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.slotInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'CANCELLED',
        isArchived: true,
      },
    });

    revalidatePath('/pipeline');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to revoke invitation' };
  }
}
