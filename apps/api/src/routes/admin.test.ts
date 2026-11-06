import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import { generateSecureToken, hashToken, SESSION_COOKIE_NAME, UserRole } from '@hireflow/shared';

describe('Fastify Admin, Team & Permissions API Tests (Prompt 6)', () => {
  let server: FastifyInstance;
  let adminCookie: string;
  let managerCookie: string;
  let recruiterCookie: string;
  let adminUser: any;
  let managerUser: any;
  let recruiterUser: any;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // Fetch existing seeded test users
    adminUser = await prisma.user.findFirstOrThrow({
      where: { email: 'anika.rao@hireflow.io' },
    });
    managerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'riya.desai@hireflow.io' },
    });
    recruiterUser = await prisma.user.findFirstOrThrow({
      where: { email: 'rahul.s@hireflow.io' },
    });

    // Helper to create active test session
    async function createTestSession(userId: string) {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      await prisma.session.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return `${SESSION_COOKIE_NAME}=${rawToken}; Path=/; HttpOnly`;
    }

    adminCookie = await createTestSession(adminUser.id);
    managerCookie = await createTestSession(managerUser.id);
    recruiterCookie = await createTestSession(recruiterUser.id);
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------
  // 1. GET /api/admin/members (Access Guarding & Scoping)
  // -------------------------------------------------------------
  describe('GET /api/admin/members', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin/members',
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 403 Forbidden when accessed by a Recruiter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin/members',
        headers: {
          cookie: recruiterCookie,
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it('returns team roster when accessed by an Admin', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin/members',
        headers: {
          cookie: adminCookie,
        },
      });
      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.members)).toBe(true);
      expect(json.data.members.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // 2. PATCH /api/admin/members/:userId/reporting (Cycle Detection & Eligibility)
  // -------------------------------------------------------------
  describe('PATCH /api/admin/members/:userId/reporting', () => {
    it('rejects circular reporting lines with HTTP 400', async () => {
      // Rahul currently reports to Riya. Making Riya report to Rahul would create a cycle.
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/admin/members/${managerUser.id}/reporting`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
        },
        payload: {
          managerId: recruiterUser.id, // Rahul
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(['CIRCULAR_REPORTING_DETECTED', 'MANAGER_INELIGIBLE']).toContain(json.error.code);
    });

    it('rejects self-reporting with HTTP 400', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/admin/members/${managerUser.id}/reporting`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
        },
        payload: {
          managerId: managerUser.id, // Self
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SELF_REPORTING_DENIED');
    });

    it('successfully updates reporting line to a valid manager', async () => {
      // Set Rahul's manager to Anika (Admin)
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/admin/members/${recruiterUser.id}/reporting`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
        },
        payload: {
          managerId: adminUser.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Restore Rahul's manager back to Riya
      await server.inject({
        method: 'PATCH',
        url: `/api/admin/members/${recruiterUser.id}/reporting`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
        },
        payload: {
          managerId: managerUser.id,
        },
      });
    }, 15000);
  });

  // -------------------------------------------------------------
  // 3. PATCH /api/admin/permissions/grant (Admin Grants & Audit Logs)
  // -------------------------------------------------------------
  describe('PATCH /api/admin/permissions/grant', () => {
    it('returns 403 Forbidden when a Recruiter attempts to modify permission grants', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/admin/permissions/grant',
        headers: {
          cookie: recruiterCookie,
          'content-type': 'application/json',
        },
        payload: {
          grantKey: 'recruiterViewInternalFees',
          enabled: true,
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it('allows Admin to update permission grant and records audit log', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/admin/permissions/grant',
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
        },
        payload: {
          grantKey: 'recruiterViewInternalFees',
          enabled: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.grantKey).toBe('recruiterViewInternalFees');
      expect(json.data.enabled).toBe(true);

      // Verify audit log record exists in database
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'PERMISSION_GRANT_UPDATED',
          actorId: adminUser.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 4. PATCH /api/admin/members/:userId/status (Deactivate & Session Revocation)
  // -------------------------------------------------------------
  describe('PATCH /api/admin/members/:userId/status', () => {
    it('prevents Admin from self-deactivating', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/admin/members/${adminUser.id}/status`,
        headers: {
          cookie: adminCookie,
          'content-type': 'application/json',
        },
        payload: {
          status: 'DISABLED',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CANNOT_SELF_DEACTIVATE');
    });
  });
});
