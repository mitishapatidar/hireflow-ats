import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
  UserRole,
  JobStatus,
} from '@hireflow/shared';

describe('Jobs & Job Lifecycle API Integration Tests (Prompt 10)', () => {
  let server: FastifyInstance;
  let adminCookie: string;
  let recruiterCookie: string;
  let candidateCookie: string;
  let adminUser: any;
  let recruiterUser: any;
  let candidateUser: any;
  let clientCompany: any;
  let createdJobIds: string[] = [];

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // 1. Fetch existing users
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    recruiterUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.RECRUITER },
    });

    candidateUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CANDIDATE },
    });

    // Fetch an active client
    clientCompany = await prisma.client.findFirstOrThrow({
      where: { isArchived: false },
    });

    // Helper to generate a valid test session cookie
    async function createSessionCookie(userId: string) {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
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
    candidateCookie = await createSessionCookie(candidateUser.id);
  });

  afterAll(async () => {
    // Clean up created jobs and relations
    if (createdJobIds.length > 0) {
      await prisma.application.deleteMany({
        where: { jobId: { in: createdJobIds } },
      });
      await prisma.jobReassignmentRequest.deleteMany({
        where: { jobId: { in: createdJobIds } },
      });
      await prisma.jobAssignment.deleteMany({
        where: { jobId: { in: createdJobIds } },
      });
      await prisma.jobRound.deleteMany({
        where: { jobId: { in: createdJobIds } },
      });
      await prisma.jobStatusHistory.deleteMany({
        where: { jobId: { in: createdJobIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { entity: 'job', entityId: { in: createdJobIds } },
      });
      await prisma.job.deleteMany({
        where: { id: { in: createdJobIds } },
      });
    }
  });

  describe('1. GET /api/jobs (List & Live Stats Cards)', () => {
    it('returns jobs list and live metric cards for authenticated internal users', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/jobs',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.jobs)).toBe(true);
      expect(json.data.jobs.length).toBeGreaterThanOrEqual(1);

      // Verify live stats cards matching Figma Frame 04
      expect(json.data.stats).toBeDefined();
      expect(typeof json.data.stats.openJobs).toBe('number');
      expect(typeof json.data.stats.onHoldJobs).toBe('number');
      expect(typeof json.data.stats.filledThisMonth).toBe('number');
      expect(typeof json.data.stats.totalJobs).toBe('number');
    });

    it('filters jobs by search query and status', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/jobs?search=J-201',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      if (json.data.jobs.length > 0) {
        expect(json.data.jobs[0].code).toContain('J-201');
      }
    });
  });

  describe('2. POST /api/jobs (Creation & Sequential Code)', () => {
    it('creates a new job in DRAFT status with auto-generated J-XXX code', async () => {
      const payload = {
        title: 'Senior Distributed Systems Architect',
        clientId: clientCompany.id,
        openings: 2,
        employmentType: 'FULL_TIME',
        salaryMin: 3500000,
        salaryMax: 4500000,
        location: 'Bangalore, India (Hybrid)',
        description: 'Lead the next generation high-throughput architecture',
        requirements: '10+ years experience in Go/Rust/Distributed SQL',
        assignedRecruiterIds: [recruiterUser.id],
      };

      const res = await server.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { cookie: adminCookie },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe(payload.title);
      expect(json.data.status).toBe(JobStatus.DRAFT);
      expect(json.data.code).toMatch(/^J-\d+$/);

      createdJobIds.push(json.data.id);

      // Verify default rounds created
      expect(json.data.rounds).toBeDefined();
      expect(json.data.rounds.length).toBeGreaterThanOrEqual(3);
    });

    it('rejects candidate user from creating jobs with 403 Forbidden', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { cookie: candidateCookie },
        payload: {
          title: 'Hacked Job Title',
          clientId: clientCompany.id,
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('3. Job Lifecycle State Machine & Convenience Endpoints', () => {
    let testJobId: string;

    beforeAll(async () => {
      // Create a dedicated job for state transitions
      const res = await server.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { cookie: adminCookie },
        payload: {
          title: 'Lifecycle State Machine QA Job',
          clientId: clientCompany.id,
          openings: 1,
        },
      });
      testJobId = res.json().data.id;
      createdJobIds.push(testJobId);
    });

    it('activates job from DRAFT to ACTIVE', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/activate`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe(JobStatus.ACTIVE);
    });

    it('pauses an active job with reason', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/pause`,
        headers: { cookie: adminCookie },
        payload: { reason: 'CLIENT_HOLD', note: 'Client requested two-week hiring freeze' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe(JobStatus.PAUSED);
      expect(json.data.pauseReason).toBe('CLIENT_HOLD');
    });

    it('strictly blocks candidate applications while job is PAUSED (HTTP 409 Conflict)', async () => {
      // Fetch an existing candidate
      const cand = await prisma.candidate.findFirstOrThrow({
        where: { isArchived: false },
      });

      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/applications`,
        headers: { cookie: adminCookie },
        payload: { candidateId: cand.id },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('cannot accept new candidate submissions');
    });

    it('resumes a paused job back to ACTIVE', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/resume`,
        headers: { cookie: adminCookie },
        payload: { note: 'Client resumed hiring' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe(JobStatus.ACTIVE);
    });

    it('closes an active job with POSITION_FILLED reason and closing note', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/close`,
        headers: { cookie: adminCookie },
        payload: {
          closingReason: 'POSITION_FILLED',
          closingNote: 'Offer accepted by top candidate',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.status).toBe(JobStatus.CLOSED);
      expect(json.data.closingReason).toBe('POSITION_FILLED');
    });

    it('strictly blocks candidate applications while job is CLOSED (HTTP 409 Conflict)', async () => {
      const cand = await prisma.candidate.findFirstOrThrow({
        where: { isArchived: false },
      });

      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/applications`,
        headers: { cookie: adminCookie },
        payload: { candidateId: cand.id },
      });

      expect(res.statusCode).toBe(409);
    });

    it('reopens a closed job back to ACTIVE', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/reopen`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Client added headcount' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe(JobStatus.ACTIVE);
    });

    it('rejects invalid state transition with 409 Conflict', async () => {
      // From ACTIVE, directly jumping to DRAFT is invalid
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/transition`,
        headers: { cookie: adminCookie },
        payload: { targetStatus: JobStatus.DRAFT },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('Invalid status transition');
    });
  });

  describe('4. Interview Rounds Management', () => {
    let testJobId: string;
    let createdRoundId: string;

    beforeAll(async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { cookie: adminCookie },
        payload: {
          title: 'Interview Rounds QA Job',
          clientId: clientCompany.id,
        },
      });
      testJobId = res.json().data.id;
      createdJobIds.push(testJobId);
    });

    it('adds a new custom interview round', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/rounds`,
        headers: { cookie: adminCookie },
        payload: {
          name: 'Take-home System Design Review',
          roundOrder: 5,
          interviewType: 'TECHNICAL',
          durationMinutes: 60,
          panelMembers: ['Principal Architect', 'Staff SRE'],
          description: 'In-depth architecture whiteboarding',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Take-home System Design Review');
      createdRoundId = json.data.id;
    });

    it('safely deactivates round without hard deleting (preserves historical linkage)', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/jobs/${testJobId}/rounds/${createdRoundId}`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // Verify in DB it still exists with isArchived = true
      const round = await prisma.jobRound.findUnique({
        where: { id: createdRoundId },
      });
      expect(round).not.toBeNull();
      expect(round?.isArchived).toBe(true);
    });
  });

  describe('5. Recruiter Assignments & Reassignment Requests', () => {
    let testJobId: string;

    beforeAll(async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { cookie: adminCookie },
        payload: {
          title: 'Reassignment QA Job',
          clientId: clientCompany.id,
        },
      });
      testJobId = res.json().data.id;
      createdJobIds.push(testJobId);
    });

    it('creates a reassignment request from recruiter', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/jobs/${testJobId}/reassignment-requests`,
        headers: { cookie: recruiterCookie },
        payload: {
          targetRecruiterId: adminUser.id,
          reason: 'Excess capacity on healthcare vertical, requesting handover',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('PENDING');

      const requestId = json.data.id;

      // Admin approves the reassignment request
      const reviewRes = await server.inject({
        method: 'PATCH',
        url: `/api/jobs/${testJobId}/reassignment-requests/${requestId}`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'APPROVED',
          reviewNotes: 'Approved and reassigned to Lead Admin',
        },
      });

      expect(reviewRes.statusCode).toBe(200);
      expect(reviewRes.json().data.status).toBe('APPROVED');
    });
  });
});
