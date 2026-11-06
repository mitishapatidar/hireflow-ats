import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  JobStatus,
  InterviewOutcome,
  VideoProvider,
  PanelRecommendation,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Interviews Calendar & Scheduling API Integration Tests (Prompt 12)', { timeout: 30000 }, () => {
  let app: any;
  let adminCookie: string;
  let managerCookie: string;
  let recruiterCookie: string;
  let candidateCookie: string;
  let clientCookie: string;
  let createdSessionTokens: string[] = [];

  let testApplicationId: string;
  let testJobId: string;
  let testRoundId: string;
  let adminUserId: string;
  let recruiterUserId: string;
  let createdInterviewId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });
    adminUserId = adminUser.id;

    const managerUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.MANAGER },
    });

    const recruiterUser = await prisma.user.findFirstOrThrow({
      where: { id: 'user-mitisha-patidar' },
    });
    recruiterUserId = recruiterUser.id;

    const candidateUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CANDIDATE },
    });

    const clientUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CLIENT },
    });

    async function createSessionCookie(userId: string) {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      createdSessionTokens.push(tokenHash);
      await prisma.session.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return `${SESSION_COOKIE_NAME}=${rawToken}`;
    }

    adminCookie = await createSessionCookie(adminUser.id);
    managerCookie = await createSessionCookie(managerUser.id);
    recruiterCookie = await createSessionCookie(recruiterUser.id);
    candidateCookie = await createSessionCookie(candidateUser.id);
    clientCookie = await createSessionCookie(clientUser.id);

    // Find an active application for testing
    const application = await prisma.application.findFirstOrThrow({
      where: {
        job: { status: JobStatus.ACTIVE },
      },
      include: {
        job: {
          include: {
            rounds: { where: { isArchived: false } },
          },
        },
      },
    });

    testApplicationId = application.id;
    testJobId = application.job.id;

    let roundId = application.job.rounds[0]?.id;
    if (!roundId) {
      const createdRound = await prisma.jobRound.create({
        data: {
          jobId: application.job.id,
          name: 'Technical Round 1',
          interviewType: 'VIDEO',
          roundOrder: 1,
          durationMinutes: 45,
        },
      });
      roundId = createdRound.id;
    }
    testRoundId = roundId;
  });

  afterAll(async () => {
    if (createdInterviewId) {
      await prisma.interviewHistory.deleteMany({ where: { interviewId: createdInterviewId } });
      await prisma.interviewFeedback.deleteMany({ where: { interviewId: createdInterviewId } });
      await prisma.interviewPanelMember.deleteMany({ where: { interviewId: createdInterviewId } });
      await prisma.task.deleteMany({ where: { relatedInterviewId: createdInterviewId } });
      await prisma.interview.deleteMany({ where: { id: createdInterviewId } });
    }

    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }

    if (app) {
      await app.close();
    }
  });

  // 1. GET /api/interviews/calendar
  it('GET /api/interviews/calendar returns 7 IST week days and 4 live database-backed statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/interviews/calendar',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.week.days).toHaveLength(7);
    expect(body.data.stats).toHaveProperty('thisWeek');
    expect(body.data.stats).toHaveProperty('pendingFeedback');
    expect(body.data.stats).toHaveProperty('noShowsThisWeek');
    expect(body.data.stats.calendarSync.status).toBe('SETUP_REQUIRED');
  });

  // 2. POST /api/interviews/availability
  it('POST /api/interviews/availability returns free/busy status with strict privacy masking', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/interviews/availability',
      headers: { cookie: adminCookie },
      payload: {
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        duration: 45,
        panelMemberIds: [adminUserId, recruiterUserId],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.panelMembers).toHaveLength(2);
    expect(body.data.panelMembers[0]).toHaveProperty('status');
    // Ensure no private meeting titles or personal notes are exposed
    expect(res.payload).not.toContain('confidential');
  });

  // 3. POST /api/interviews (Schedule Interview)
  it('POST /api/interviews successfully schedules an interview and generates a mock meeting link', async () => {
    const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: '/api/interviews',
      headers: { cookie: adminCookie },
      payload: {
        applicationId: testApplicationId,
        roundId: testRoundId,
        scheduledAt,
        duration: 45,
        timezone: 'Asia/Kolkata',
        mode: 'VIDEO',
        provider: VideoProvider.GOOGLE_MEET,
        panelMemberIds: [adminUserId],
        reminder24h: true,
        reminder30m: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.outcome).toBe(InterviewOutcome.SCHEDULED);
    expect(body.data.meetingLink).toContain('meet.google.com/demo-hf-');

    createdInterviewId = body.data.id;
  });

  // 4. Double-Booking Conflict Prevention
  it('POST /api/interviews blocks overlapping interview for same panel member with HTTP 409', async () => {
    // Attempt to schedule an overlapping interview with adminUserId
    const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: '/api/interviews',
      headers: { cookie: adminCookie },
      payload: {
        applicationId: testApplicationId,
        roundId: testRoundId,
        scheduledAt, // Same time as previous
        duration: 45,
        panelMemberIds: [adminUserId], // Conflicting panel member
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DOUBLE_BOOKING_CONFLICT');
  });

  // 5. GET /api/interviews/:id
  it('GET /api/interviews/:id returns full interview dossier', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/interviews/${createdInterviewId}`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdInterviewId);
    expect(body.data.panelMembers).toHaveLength(1);
    expect(body.data.histories).toHaveLength(1);
    expect(body.data.histories[0].action).toBe('CREATED');
  });

  // 6. POST /api/interviews/:id/reschedule
  it('POST /api/interviews/:id/reschedule reschedules interview, preserves previous time in history', async () => {
    const newScheduledAt = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/interviews/${createdInterviewId}/reschedule`,
      headers: { cookie: adminCookie },
      payload: {
        newScheduledAt,
        duration: 60,
        rescheduleReason: 'Candidate requested time change due to client meeting',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.outcome).toBe(InterviewOutcome.RESCHEDULED);
    expect(body.data.duration).toBe(60);
    expect(body.data.previousScheduledAt).toBeDefined();
  });

  // 7. POST /api/interviews/:id/no-show (CRITICAL ATS RULE: NEVER Auto-Reject)
  it('POST /api/interviews/:id/no-show records no-show and DOES NOT alter application stage', async () => {
    // Check initial application stage
    const appBefore = await prisma.application.findUniqueOrThrow({
      where: { id: testApplicationId },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/interviews/${createdInterviewId}/no-show`,
      headers: { cookie: adminCookie },
      payload: {
        noShowReason: 'Candidate did not connect to meeting room after 15 minutes',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.outcome).toBe(InterviewOutcome.NO_SHOW);

    // Verify application stage remains UNTOUCHED
    const appAfter = await prisma.application.findUniqueOrThrow({
      where: { id: testApplicationId },
    });
    expect(appAfter.stageId).toBe(appBefore.stageId);
    expect(appAfter.status).toBe(appBefore.status);
  });

  // 8. Reschedule from NO_SHOW then Complete
  it('allows rescheduling from NO_SHOW, then completing interview', async () => {
    // 1. Reschedule from NO_SHOW
    const newTime = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();
    const resResched = await app.inject({
      method: 'POST',
      url: `/api/interviews/${createdInterviewId}/reschedule`,
      headers: { cookie: adminCookie },
      payload: {
        newScheduledAt: newTime,
        rescheduleReason: 'Rescheduling after no-show follow-up call',
      },
    });
    expect(resResched.statusCode).toBe(200);

    // 2. Mark completed
    const resComplete = await app.inject({
      method: 'POST',
      url: `/api/interviews/${createdInterviewId}/complete`,
      headers: { cookie: adminCookie },
      payload: {
        outcomeNotes: 'Comprehensive technical interview completed with stellar performance',
      },
    });
    expect(resComplete.statusCode).toBe(200);
    const bodyComplete = JSON.parse(resComplete.payload);
    expect(bodyComplete.data.outcome).toBe(InterviewOutcome.COMPLETED);
    expect(bodyComplete.data.completedAt).toBeDefined();
  });

  // 9. POST /api/interviews/:id/feedback
  it('POST /api/interviews/:id/feedback submits internal panel feedback', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/interviews/${createdInterviewId}/feedback`,
      headers: { cookie: adminCookie },
      payload: {
        rating: 5,
        recommendation: PanelRecommendation.STRONG_YES,
        strengths: 'Deep React expertise, clean architecture principles, and great communication',
        concerns: 'Expected compensation is at upper limit of budget',
        technicalScore: 9,
        feedback: 'Highly recommended for immediate hire into the senior engineering team.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.rating).toBe(5);
    expect(body.data.recommendation).toBe(PanelRecommendation.STRONG_YES);
  });

  // 10. POST /api/interviews/:id/task (Follow-up Task)
  it('POST /api/interviews/:id/task creates a follow-up task linked to interview', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/interviews/${createdInterviewId}/task`,
      headers: { cookie: adminCookie },
      payload: {
        title: 'Send technical test results to client hiring manager',
        description: 'Candidate cleared technical round with 5/5 stars from panel.',
        assignedToId: recruiterUserId,
        priority: 'HIGH',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.relatedInterviewId).toBe(createdInterviewId);
    expect(body.data.priority).toBe('HIGH');
  });

  // 11. Security & Role Permissions
  it('blocks Candidate and Client users from accessing internal interviews with HTTP 403', async () => {
    const resCandidate = await app.inject({
      method: 'GET',
      url: '/api/interviews/calendar',
      headers: { cookie: candidateCookie },
    });
    expect(resCandidate.statusCode).toBe(403);

    const resClient = await app.inject({
      method: 'GET',
      url: `/api/interviews/${createdInterviewId}`,
      headers: { cookie: clientCookie },
    });
    expect(resClient.statusCode).toBe(403);
  });
});
