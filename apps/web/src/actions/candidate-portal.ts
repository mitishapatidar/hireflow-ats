'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  CandidatePortalPayload,
  serializeCandidateProfile,
  serializeCandidateApplication,
  serializeCandidateInterview,
  assertCandidateSafe,
  UpdateCandidateProfileSchema,
  UpdateCandidateProfileInput,
} from '@hireflow/shared';

async function resolveCandidateForUser(user: any) {
  // First match on userId
  let candidate = await prisma.candidate.findFirst({
    where: { userId: user.id, isArchived: false },
  });

  // Second fallback match on email
  if (!candidate && user.email) {
    candidate = await prisma.candidate.findFirst({
      where: { email: user.email, isArchived: false },
    });
  }

  // Admin fallback for testing / previewing candidate portal
  if (!candidate && user.role === UserRole.ADMIN) {
    candidate = await prisma.candidate.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  return candidate;
}

/**
 * Fetch candidate dashboard data with strict anti-leak protection (Frame 14 & 48)
 */
export async function getCandidatePortalDataAction(): Promise<{
  success: boolean;
  data?: CandidatePortalPayload;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: Please sign in to access candidate portal.' };
    }

    if (user.role !== UserRole.CANDIDATE && user.role !== UserRole.ADMIN) {
      return { success: false, error: 'Forbidden: Portal is strictly for candidate accounts.' };
    }

    const candidate = await resolveCandidateForUser(user);
    if (!candidate) {
      return { success: false, error: 'No candidate profile found associated with your account.' };
    }

    // Load applications
    const applications = await prisma.application.findMany({
      where: { candidateId: candidate.id },
      include: {
        job: {
          include: { client: true },
        },
        slotInvitations: {
          where: { isArchived: false },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    // Load interviews
    const interviews = await prisma.interview.findMany({
      where: {
        application: { candidateId: candidate.id },
        isArchived: false,
      },
      include: {
        application: {
          include: { job: true },
        },
        round: true,
        videoMeeting: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Anti-leak Serialization
    const profile = serializeCandidateProfile(candidate);
    const applicationsDto = applications.map(serializeCandidateApplication);
    const interviewsDto = interviews.map(serializeCandidateInterview);

    const payload: CandidatePortalPayload = {
      profile,
      applications: applicationsDto,
      upcomingInterviews: interviewsDto,
    };

    // Assert strict zero-leak constraint
    assertCandidateSafe(payload);

    return {
      success: true,
      data: payload,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load candidate portal data' };
  }
}

/**
 * Candidate updates their profile (permitted fields only)
 */
export async function updateCandidateProfileAction(input: UpdateCandidateProfileInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    if (user.role !== UserRole.CANDIDATE && user.role !== UserRole.ADMIN) {
      return { success: false, error: 'Forbidden' };
    }

    const candidate = await resolveCandidateForUser(user);
    if (!candidate) {
      return { success: false, error: 'Candidate profile not found' };
    }

    const validation = UpdateCandidateProfileSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: 'Invalid profile data' };
    }

    const data = validation.data;
    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.currentTitle !== undefined ? { currentTitle: data.currentTitle } : {}),
        ...(data.currentCompany !== undefined ? { currentCompany: data.currentCompany } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.skills !== undefined ? { skills: data.skills } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CANDIDATE_PROFILE_UPDATED',
        entity: 'Candidate',
        entityId: candidate.id,
        after: {
          updatedFields: Object.keys(data),
        },
      },
    });

    const serialized = serializeCandidateProfile(updated);
    assertCandidateSafe(serialized);

    revalidatePath('/my-dashboard');

    return {
      success: true,
      data: serialized,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update candidate profile' };
  }
}
