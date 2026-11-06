import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Job Pipeline (Kanban Board) API Integration Tests (Prompt 11)', { timeout: 25000 }, () => {
  let app: any;
  let adminCookie: string;
  let recruiterCookie: string;
  let candidateCookie: string;
  let clientCookie: string;
  let unassignedRecruiterCookie: string;
  let createdSessionTokens: string[] = [];

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    // Mitisha Patidar owns job-j201
    const recruiterUser = await prisma.user.findFirstOrThrow({
      where: { id: 'user-mitisha-patidar' },
    });

    const unassignedRecruiter = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.RECRUITER, id: { not: 'user-mitisha-patidar' } },
    });

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
    recruiterCookie = await createSessionCookie(recruiterUser.id);
    unassignedRecruiterCookie = await createSessionCookie(unassignedRecruiter.id);
    candidateCookie = await createSessionCookie(candidateUser.id);
    clientCookie = await createSessionCookie(clientUser.id);
  });

  afterAll(async () => {
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }
  });

  it('1. GET /api/jobs/:jobId/pipeline returns board data, stages, and counts for authorized recruiters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/job-j201/pipeline',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.job.code).toBe('J-201');
    expect(body.data.stages).toHaveLength(8);
    expect(body.data.stages[0].name).toBe('Sourced');
    expect(body.data.columns).toBeDefined();
    expect(body.data.columns['stage-client-review']).toBeDefined();
    expect(body.data.columns['stage-client-review'].cards.length).toBeGreaterThanOrEqual(1);
  });

  it('2. GET /api/jobs/:jobId/pipeline strictly rejects unassigned recruiter with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/job-j201/pipeline',
      headers: { cookie: unassignedRecruiterCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('3. GET /api/jobs/:jobId/pipeline strictly rejects CANDIDATE and CLIENT with 403 Forbidden', async () => {
    const candRes = await app.inject({
      method: 'GET',
      url: '/api/jobs/job-j201/pipeline',
      headers: { cookie: candidateCookie },
    });
    expect(candRes.statusCode).toBe(403);

    const clientRes = await app.inject({
      method: 'GET',
      url: '/api/jobs/job-j201/pipeline',
      headers: { cookie: clientCookie },
    });
    expect(clientRes.statusCode).toBe(403);
  });

  it('4. POST /api/jobs/:jobId/applications adds an existing candidate to job pipeline', async () => {
    const cand = await prisma.candidate.findFirst({
      where: {
        id: { not: 'cand-c-0001' },
        organizationId: 'org-aureva-1',
        isArchived: false,
      },
    });
    expect(cand).toBeDefined();

    // Clean up if previous run left an application
    await prisma.applicationStageHistory.deleteMany({
      where: { application: { candidateId: cand!.id, jobId: 'job-j201' } },
    });
    await prisma.application.deleteMany({
      where: { candidateId: cand!.id, jobId: 'job-j201' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/job-j201/applications',
      headers: { cookie: adminCookie },
      payload: {
        candidateId: cand!.id,
        initialStageId: 'stage-sourced',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(cand!.name);
    expect(body.data.stageId).toBe('stage-sourced');
  });

  it('5. POST /api/jobs/:jobId/applications blocks duplicate application with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/job-j201/applications',
      headers: { cookie: adminCookie },
      payload: {
        candidateId: 'cand-c-0001',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('DUPLICATE_APPLICATION');
  });

  it('6. POST /api/applications/:applicationId/stage advances candidate to Technical stage', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/applications/app-aarav-j201/stage',
      headers: { cookie: recruiterCookie },
      payload: {
        targetStageId: 'stage-technical',
        comments: 'Advancing to technical deep-dive assessment',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.stageId).toBe('stage-technical');

    const history = await prisma.applicationStageHistory.findFirst({
      where: { applicationId: 'app-aarav-j201', toStage: 'Technical' },
      orderBy: { createdAt: 'desc' },
    });
    expect(history).toBeDefined();
    expect(history!.comments).toBe('Advancing to technical deep-dive assessment');

    // Restore to stage-client-review
    await app.inject({
      method: 'POST',
      url: '/api/applications/app-aarav-j201/stage',
      headers: { cookie: recruiterCookie },
      payload: {
        targetStageId: 'stage-client-review',
        comments: 'Restored for testing consistency',
      },
    });
  });

  it('7. POST /api/applications/:applicationId/stage blocks moving to Rejected without reason/feedback', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/applications/app-aarav-j201/stage',
      headers: { cookie: recruiterCookie },
      payload: {
        targetStageId: 'stage-rejected',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('mandatory');
  });

  it('8. POST /api/applications/:applicationId/reject rejects candidate with mandatory feedback', async () => {
    const testCand = await prisma.candidate.findFirst({
      where: { code: 'C-0005' },
    });
    expect(testCand).toBeDefined();

    // Clean up
    await prisma.applicationStageHistory.deleteMany({
      where: { application: { candidateId: testCand!.id, jobId: 'job-j201' } },
    });
    await prisma.application.deleteMany({
      where: { candidateId: testCand!.id, jobId: 'job-j201' },
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/job-j201/applications',
      headers: { cookie: adminCookie },
      payload: { candidateId: testCand!.id },
    });
    expect(createRes.statusCode).toBe(201);
    const appData = createRes.json().data;

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/reject`,
      headers: { cookie: recruiterCookie },
      payload: {
        rejectionReasonId: 'SKILLS_MISMATCH',
        rejectionFeedback: 'Candidate does not have sufficient distributed systems experience.',
      },
    });

    expect(rejectRes.statusCode).toBe(200);
    const rejectBody = rejectRes.json();
    expect(rejectBody.success).toBe(true);
    expect(rejectBody.data.status).toBe('REJECTED');
    expect(rejectBody.data.stageId).toBe('stage-rejected');
  });

  it('9. GET /api/applications/:applicationId/drawer returns detailed candidate and activity timeline', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/applications/app-aarav-j201/drawer',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.candidate.name).toBe('Aarav Shah');
    expect(body.data.activity.length).toBeGreaterThanOrEqual(1);
  });

  it('10. POST /api/applications/:applicationId/notes adds an internal note', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/applications/app-aarav-j201/notes',
      headers: { cookie: recruiterCookie },
      payload: {
        content: 'Candidate impressed during initial screening call regarding Kubernetes scalability.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toContain('Kubernetes');
    expect(body.data.isInternalOnly).toBe(true);
  });

  it('11. GET /api/jobs/:jobId/pipeline/columns/:stageId supports cursor pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/job-j201/pipeline/columns/stage-client-review?limit=10',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.stageId).toBe('stage-client-review');
    expect(Array.isArray(body.data.cards)).toBe(true);
  });

  it('12. GET /api/pipeline/rejection-reasons returns active recruitment rejection reasons', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pipeline/rejection-reasons',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(8);
  });
});
