import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  HandoverStatus,
  HandoverEntityType,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Prompt 27: Recruiter Handover & Ownership History Integration Tests', () => {
  let app: any;
  let adminCookie: string;
  let managerCookie: string;
  let recruiter1Cookie: string;
  let recruiter2Cookie: string;
  let createdSessionTokens: string[] = [];

  let recruiter1: any;
  let recruiter2: any;
  let testCandidate: any;
  let testJob: any;
  let testTask: any;
  let createdHandoverId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    const managerUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.MANAGER } });

    // Ensure we have two distinct active recruiters
    const recruiters = await prisma.user.findMany({
      where: { role: UserRole.RECRUITER, status: 'ACTIVE' },
      take: 2,
    });

    recruiter1 = recruiters[0];
    recruiter2 = recruiters[1] || (await prisma.user.create({
      data: {
        email: `recruiter-target-${Date.now()}@aurevacapital.com`,
        name: 'Target Recruiter Sunita',
        role: UserRole.RECRUITER,
        status: 'ACTIVE',
        organizationId: 'org-aureva-1',
      },
    }));

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
    recruiter1Cookie = await createSessionCookie(recruiter1.id);
    recruiter2Cookie = await createSessionCookie(recruiter2.id);

    // Create test candidate owned by recruiter1
    testCandidate = await prisma.candidate.create({
      data: {
        organizationId: 'org-aureva-1',
        code: `CAND-${Date.now().toString().slice(-6)}`,
        name: 'Suresh Raina',
        email: `suresh-${Date.now()}@example.com`,
        ownerId: recruiter1.id,
      },
    });

    // Create test job owned by recruiter1
    const client = await prisma.client.findFirstOrThrow();
    testJob = await prisma.job.create({
      data: {
        organizationId: 'org-aureva-1',
        clientId: client.id,
        title: 'Senior Portfolio Manager',
        code: `PORT-${Date.now().toString().slice(-4)}`,
        status: 'ACTIVE',
        ownerId: recruiter1.id,
      },
    });

    // Create initial job assignment
    await prisma.jobAssignment.create({
      data: {
        jobId: testJob.id,
        recruiterId: recruiter1.id,
        assignedById: adminUser.id,
        status: 'ACTIVE',
      },
    });

    // Create test open task assigned to recruiter1
    testTask = await prisma.task.create({
      data: {
        title: 'Follow up with Suresh regarding offer discussion',
        assignedToId: recruiter1.id,
        status: 'PENDING',
        priority: 'HIGH',
      },
    });
  });

  afterAll(async () => {
    if (createdHandoverId) {
      await prisma.ownershipHistory.deleteMany({ where: { handoverRequestId: createdHandoverId } });
      await prisma.handoverRequest.deleteMany({ where: { id: createdHandoverId } });
    }
    if (testTask?.id) {
      await prisma.task.deleteMany({ where: { id: testTask.id } });
    }
    if (testJob?.id) {
      await prisma.jobAssignment.deleteMany({ where: { jobId: testJob.id } });
      await prisma.job.deleteMany({ where: { id: testJob.id } });
    }
    if (testCandidate?.id) {
      await prisma.candidate.deleteMany({ where: { id: testCandidate.id } });
    }
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({ where: { tokenHash: { in: createdSessionTokens } } });
    }
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/handover/recruiter-resources/:recruiterId lists owned resources for Frame 41 wizard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/handover/recruiter-resources/${recruiter1.id}`,
      headers: { cookie: recruiter1Cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.candidates.some((c: any) => c.id === testCandidate.id)).toBe(true);
    expect(body.data.jobs.some((j: any) => j.id === testJob.id)).toBe(true);
    expect(body.data.tasks.some((t: any) => t.id === testTask.id)).toBe(true);
  });

  it('2. POST /api/handover/requests creates pending handover with independent entity selections', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/handover/requests',
      headers: { cookie: recruiter1Cookie },
      payload: {
        fromUserId: recruiter1.id,
        toUserId: recruiter2.id,
        candidateIds: [testCandidate.id],
        jobIds: [testJob.id],
        taskIds: [testTask.id],
        reason: 'Recruiter taking emergency personal leave',
        notes: 'Handover candidates and active job pipeline',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(HandoverStatus.PENDING);
    expect(body.data.candidateIds).toContain(testCandidate.id);
    expect(body.data.jobIds).toContain(testJob.id);
    expect(body.data.taskIds).toContain(testTask.id);

    createdHandoverId = body.data.id;
  });

  it('3. POST /api/handover/requests rejects recruiter initiating handover for another recruiter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/handover/requests',
      headers: { cookie: recruiter2Cookie }, // recruiter2 trying to hand over recruiter1's work
      payload: {
        fromUserId: recruiter1.id,
        toUserId: recruiter2.id,
        candidateIds: [testCandidate.id],
        jobIds: [],
        taskIds: [],
        reason: 'Unauthorized takeover attempt',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
  });

  it('4. GET /api/handover/requests/:id returns details with hydrated entities', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/handover/requests/${createdHandoverId}`,
      headers: { cookie: managerCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdHandoverId);
    expect(body.data.entities.candidates.length).toBe(1);
    expect(body.data.entities.candidates[0].name).toBe('Suresh Raina');
    expect(body.data.entities.jobs.length).toBe(1);
    expect(body.data.entities.tasks.length).toBe(1);
  });

  it('5. POST /api/handover/requests/:id/approve transfers candidates, jobs & tasks in atomic transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/handover/requests/${createdHandoverId}/approve`,
      headers: { cookie: managerCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(HandoverStatus.APPROVED);

    // Verify Candidate owner updated
    const updatedCandidate = await prisma.candidate.findUniqueOrThrow({ where: { id: testCandidate.id } });
    expect(updatedCandidate.ownerId).toBe(recruiter2.id);

    // Verify Job owner updated & new job assignment created
    const updatedJob = await prisma.job.findUniqueOrThrow({ where: { id: testJob.id } });
    expect(updatedJob.ownerId).toBe(recruiter2.id);

    const activeAssignment = await prisma.jobAssignment.findFirst({
      where: { jobId: testJob.id, recruiterId: recruiter2.id, status: 'ACTIVE' },
    });
    expect(activeAssignment).toBeDefined();

    // Verify Task reassigned
    const updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: testTask.id } });
    expect(updatedTask.assignedToId).toBe(recruiter2.id);
  });

  it('5b. POST /api/handover/requests/:id/approve rejects duplicate / concurrent approval', async () => {
    // Attempting to re-approve the already approved handover request
    const res = await app.inject({
      method: 'POST',
      url: `/api/handover/requests/${createdHandoverId}/approve`,
      headers: { cookie: managerCookie },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
  });

  it('5c. POST /api/handover/requests/:id/approve rejects candidate ownership mismatch inside transaction', async () => {
    // Create candidate owned by a different recruiter
    const otherCandidate = await prisma.candidate.create({
      data: {
        organizationId: 'org-aureva-1',
        code: `CAND-OTH-${Date.now().toString().slice(-4)}`,
        name: 'Other Recruiter Candidate',
        email: `other-cand-${Date.now()}@example.com`,
        ownerId: recruiter2.id, // owned by recruiter2, not recruiter1
      },
    });

    const forgedRequest = await prisma.handoverRequest.create({
      data: {
        organizationId: 'org-aureva-1',
        fromUserId: recruiter1.id,
        toUserId: recruiter2.id,
        requestedById: recruiter1.id,
        candidateIds: [otherCandidate.id],
        jobIds: [],
        taskIds: [],
        reason: 'Attempting to transfer candidate not owned by fromUser',
        status: HandoverStatus.PENDING,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/handover/requests/${forgedRequest.id}/approve`,
      headers: { cookie: managerCookie },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error).toContain('CANDIDATE_OWNERSHIP_MISMATCH');

    // Verify candidate was NOT transferred
    const unchanged = await prisma.candidate.findUniqueOrThrow({ where: { id: otherCandidate.id } });
    expect(unchanged.ownerId).toBe(recruiter2.id);

    // Cleanup
    await prisma.handoverRequest.delete({ where: { id: forgedRequest.id } });
    await prisma.candidate.delete({ where: { id: otherCandidate.id } });
  });

  it('6. GET /api/handover/ownership-history returns permanent audit trail of transfers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/handover/ownership-history?recruiterId=${recruiter2.id}`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBeGreaterThanOrEqual(3);

    const entityTypes = body.data.items.map((h: any) => h.entityType);
    expect(entityTypes).toContain(HandoverEntityType.CANDIDATE);
    expect(entityTypes).toContain(HandoverEntityType.JOB);
    expect(entityTypes).toContain(HandoverEntityType.TASK);
  });
});
