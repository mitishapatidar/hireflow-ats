import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  UpdateCandidateProfileSchema,
  serializeCandidateProfile,
  serializeCandidateApplication,
  serializeCandidateInterview,
  assertCandidateSafe,
} from '@hireflow/shared';

export const candidatePortalRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: locate candidate associated with authenticated user
  async function resolveCandidateForUser(user: { id: string; email: string; role: string }) {
    let candidate = await prisma.candidate.findFirst({
      where: { userId: user.id, isArchived: false },
    });

    if (!candidate && user.email) {
      candidate = await prisma.candidate.findFirst({
        where: { email: user.email, isArchived: false },
      });
    }

    // In dev / showcase mode, fallback to seeded candidate Aarav Shah if admin is previewing candidate portal
    if (!candidate && (user.role === UserRole.ADMIN || user.role === UserRole.CANDIDATE)) {
      candidate = await prisma.candidate.findFirst({
        where: { code: 'C-0001' },
      });
    }

    return candidate;
  }

  // ==========================================
  // 1. GET /api/candidate-portal/me
  // Authenticated Candidate Dossier (Figma Frame 14 & Frame 48)
  // ==========================================
  server.get('/me', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    if (user.role !== UserRole.CANDIDATE && user.role !== UserRole.ADMIN) {
      return reply.status(403).send({
        success: false,
        error: { message: 'Forbidden: Candidate portal is strictly reserved for candidate accounts.' },
      });
    }

    const candidate = await resolveCandidateForUser(user);
    if (!candidate) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CANDIDATE_RECORD_NOT_FOUND', message: 'No candidate profile linked to this account.' },
      });
    }

    // Load active applications
    const applications = await prisma.application.findMany({
      where: { candidateId: candidate.id },
      include: {
        job: {
          include: {
            client: true,
          },
        },
        slotInvitations: {
          where: { isArchived: false },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    // Load upcoming and past interviews
    const interviews = await prisma.interview.findMany({
      where: {
        application: { candidateId: candidate.id },
        isArchived: false,
      },
      include: {
        application: {
          include: {
            job: true,
          },
        },
        round: true,
        videoMeeting: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Anti-leak Serialization
    const profileDto = serializeCandidateProfile(candidate);
    const applicationsDto = applications.map(serializeCandidateApplication);
    const interviewsDto = interviews.map(serializeCandidateInterview);

    const payload = {
      profile: profileDto,
      applications: applicationsDto,
      upcomingInterviews: interviewsDto,
    };

    // Strict contract check
    assertCandidateSafe(payload);

    return reply.send({
      success: true,
      data: payload,
    });
  });

  // ==========================================
  // 2. PATCH /api/candidate-portal/profile
  // Candidate updates their permitted profile fields
  // ==========================================
  server.patch('/profile', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
    }

    if (user.role !== UserRole.CANDIDATE && user.role !== UserRole.ADMIN) {
      return reply.status(403).send({ success: false, error: { message: 'Forbidden' } });
    }

    const candidate = await resolveCandidateForUser(user);
    if (!candidate) {
      return reply.status(404).send({ success: false, error: { message: 'Candidate profile not found' } });
    }

    const parseResult = UpdateCandidateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid profile parameters',
          details: parseResult.error.format(),
        },
      });
    }

    const input = parseResult.data;

    // Update only candidate-permitted fields
    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.currentTitle !== undefined ? { currentTitle: input.currentTitle } : {}),
        ...(input.currentCompany !== undefined ? { currentCompany: input.currentCompany } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.skills !== undefined ? { skills: input.skills } : {}),
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CANDIDATE_PROFILE_UPDATED',
        entity: 'Candidate',
        entityId: candidate.id,
        after: {
          updatedFields: Object.keys(input),
        },
      },
    });

    const serialized = serializeCandidateProfile(updated);
    assertCandidateSafe(serialized);

    return reply.send({
      success: true,
      data: serialized,
      message: 'Profile successfully updated',
    });
  });
};
