import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
  UserRole,
} from '@hireflow/shared';

describe('Candidate API Endpoints (Fastify Routes)', () => {
  let server: FastifyInstance;
  let adminCookie: string;
  let recruiter1Cookie: string;
  let recruiter2Cookie: string;
  let testCandidateId: string;
  let recruiter1Id: string;
  let recruiter2Id: string;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // Fetch existing seeded users for testing
    const adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });
    const recruiters = await prisma.user.findMany({
      where: { role: UserRole.RECRUITER },
      take: 2,
    });

    recruiter1Id = recruiters[0].id;
    recruiter2Id = recruiters[1].id;

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
    recruiter1Cookie = await createSessionCookie(recruiter1Id);
    recruiter2Cookie = await createSessionCookie(recruiter2Id);

    // Pick or create a candidate owned by recruiter1
    let candidate = await prisma.candidate.findFirst({
      where: { ownerId: recruiter1Id, isArchived: false },
    });

    if (!candidate) {
      // Reassign first candidate to recruiter1 for test stability
      const first = await prisma.candidate.findFirstOrThrow();
      candidate = await prisma.candidate.update({
        where: { id: first.id },
        data: { ownerId: recruiter1Id },
      });
    }

    testCandidateId = candidate.id;
  });

  afterAll(async () => {
    await server.close();
  });

  // 1. Authentication requirement
  it('GET /api/candidates returns 401 when unauthenticated', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/candidates',
    });
    expect(res.statusCode).toBe(401);
  });

  // 2. Admin candidate listing
  it('GET /api/candidates as ADMIN returns paginated candidates', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/candidates?page=1&limit=5',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.candidates.length).toBeLessThanOrEqual(5);
    expect(body.data.total).toBeGreaterThan(0);
  });

  // 3. Recruiter role scoping (only see own candidates)
  it('GET /api/candidates as RECRUITER returns only owned candidates', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/candidates',
      headers: { cookie: recruiter1Cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    body.data.candidates.forEach((cand: any) => {
      expect(cand.ownerId).toBe(recruiter1Id);
    });
  });

  // 4. Free-text search
  it('GET /api/candidates filters by search term', async () => {
    const candidate = await prisma.candidate.findUniqueOrThrow({
      where: { id: testCandidateId },
    });

    const res = await server.inject({
      method: 'GET',
      url: `/api/candidates?search=${encodeURIComponent(candidate.name)}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.candidates.some((c: any) => c.id === testCandidateId)).toBe(true);
  });

  // 5. Single candidate profile fetch
  it('GET /api/candidates/:id returns candidate details for owner', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/candidates/${testCandidateId}`,
      headers: { cookie: recruiter1Cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.candidate.id).toBe(testCandidateId);
  });

  // 6. Cross-recruiter forbidden access
  it('GET /api/candidates/:id returns 403 when accessed by another recruiter', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/candidates/${testCandidateId}`,
      headers: { cookie: recruiter2Cookie },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  // 7. Update candidate profile
  it('PATCH /api/candidates/:id updates candidate and logs audit trail', async () => {
    const newTitle = 'Senior Full Stack Specialist';
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/candidates/${testCandidateId}`,
      headers: { cookie: recruiter1Cookie },
      payload: {
        name: 'Aarav Shah',
        currentTitle: newTitle,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.candidate.currentTitle).toBe(newTitle);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: testCandidateId, action: 'candidate.updated' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeDefined();
  });

  // 8. Add internal note
  it('POST /api/candidates/:id/notes adds an internal note', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/candidates/${testCandidateId}/notes`,
      headers: { cookie: recruiter1Cookie },
      payload: {
        content: 'Candidate impressed during initial phone screening.',
        isInternalOnly: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.note.content).toContain('impressed');
  });

  // 9. Soft Archive & Restore
  it('POST /api/candidates/:id/archive and /restore soft archives without deleting', async () => {
    // Archive
    const archiveRes = await server.inject({
      method: 'POST',
      url: `/api/candidates/${testCandidateId}/archive`,
      headers: { cookie: adminCookie },
      payload: {
        reason: 'Client mandate put on hold by client leadership.',
      },
    });
    expect(archiveRes.statusCode).toBe(200);
    const archiveBody = JSON.parse(archiveRes.body);
    expect(archiveBody.data.candidate.isArchived).toBe(true);
    expect(archiveBody.data.candidate.archiveReason).toContain('mandate put on hold');

    // Restore
    const restoreRes = await server.inject({
      method: 'POST',
      url: `/api/candidates/${testCandidateId}/restore`,
      headers: { cookie: adminCookie },
      payload: {
        reason: 'Mandate reopened by client.',
      },
    });
    expect(restoreRes.statusCode).toBe(200);
    const restoreBody = JSON.parse(restoreRes.body);
    expect(restoreBody.data.candidate.isArchived).toBe(false);
  });
});
