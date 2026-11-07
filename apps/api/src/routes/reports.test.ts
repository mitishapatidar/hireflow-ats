import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import { UserRole, generateSecureToken, hashToken, SESSION_COOKIE_NAME } from '@hireflow/shared';

describe('Prompt 26: Custom Reports & Scheduled Client Reports API Tests', () => {
  let server: FastifyInstance;
  let adminCookie: string;
  let recruiterCookie: string;
  let clientCookie: string;

  let testOrgId: string;
  let adminUser: any;
  let recruiterUser: any;
  let clientUser: any;
  let testClient: any;
  let testContact: any;
  let testJob: any;
  let testCandidate: any;
  let testApplication: any;

  async function createSessionCookie(userId: string): Promise<string> {
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

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // 1. Setup Test Organization
    const org = await prisma.organization.create({
      data: {
        name: 'Report Builder Test Org',
        slug: `rpt-org-${Date.now()}`,
      },
    });
    testOrgId = org.id;

    // 2. Setup Users
    adminUser = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@hireflow-test.io`,
        name: 'Admin User',
        role: UserRole.ADMIN,
        organizationId: testOrgId,
      },
    });

    recruiterUser = await prisma.user.create({
      data: {
        email: `recruiter-${Date.now()}@hireflow-test.io`,
        name: 'Recruiter User',
        role: UserRole.RECRUITER,
        organizationId: testOrgId,
      },
    });

    clientUser = await prisma.user.create({
      data: {
        email: `client-${Date.now()}@hireflow-test.io`,
        name: 'Client User',
        role: UserRole.CLIENT,
        organizationId: testOrgId,
      },
    });

    // Generate test session cookies
    adminCookie = await createSessionCookie(adminUser.id);
    recruiterCookie = await createSessionCookie(recruiterUser.id);
    clientCookie = await createSessionCookie(clientUser.id);

    // 3. Setup Test Client & Verified Contact
    testClient = await prisma.client.create({
      data: {
        organizationId: testOrgId,
        legalName: 'Aureva Capital Partner Corp',
        code: `AUR-${Date.now()}`,
        status: 'ACTIVE',
      },
    });

    testContact = await prisma.clientContact.create({
      data: {
        clientId: testClient.id,
        name: 'Rajesh Sharma',
        email: 'rajesh.sharma@aureva-test.com',
        designation: 'VP Talent Acquisition',
        isPrimary: true,
      },
    });

    // 4. Setup Test Job
    testJob = await prisma.job.create({
      data: {
        organizationId: testOrgId,
        clientId: testClient.id,
        ownerId: recruiterUser.id,
        code: `JOB-${Date.now()}`,
        title: 'Senior Quantitative Analyst',
        openings: 2,
        status: 'ACTIVE',
      },
    });

    // 5. Setup Test Candidate & Application
    testCandidate = await prisma.candidate.create({
      data: {
        organizationId: testOrgId,
        ownerId: recruiterUser.id,
        code: `CAN-${Date.now()}`,
        name: 'Neha Verma',
        email: `neha-${Date.now()}@example.com`,
        currentTitle: 'Data Analyst',
        experienceYears: 4,
        currentSalary: 1800000,
        expectedSalary: 2400000,
      },
    });

    testApplication = await prisma.application.create({
      data: {
        candidateId: testCandidate.id,
        jobId: testJob.id,
        status: 'INTERVIEW',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.application.deleteMany({ where: { jobId: testJob.id } });
      await prisma.candidate.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.job.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.clientContact.deleteMany({ where: { clientId: testClient.id } });
      await prisma.client.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.user.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.organization.deleteMany({ where: { id: testOrgId } });
    } catch {
      // Safe cleanup
    }
    await server.close();
  });

  describe('Module A: Custom Report Builder (Frame 37)', () => {
    it('GET /api/reports/builder/config — should return column catalog and permissions', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/reports/builder/config',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.catalog.CANDIDATES).toBeDefined();
      expect(json.data.catalog.JOBS).toBeDefined();
      expect(json.data.canAccessSensitive).toBe(true);
    });

    it('POST /api/reports/preview — should return exactly bounded 5 rows preview with as-of timestamp', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/reports/preview',
        headers: { cookie: adminCookie },
        payload: {
          primaryEntity: 'CANDIDATES',
          selectedColumns: ['code', 'name', 'email', 'currentTitle'],
          limit: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.asOf).toBeDefined();
      expect(json.data.rows.length).toBeLessThanOrEqual(5);
      expect(json.data.columns).toEqual(['code', 'name', 'email', 'currentTitle']);
    });

    it('POST /api/reports/preview — should reject forbidden fields like internalNotes or margins', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/reports/preview',
        headers: { cookie: adminCookie },
        payload: {
          primaryEntity: 'CANDIDATES',
          selectedColumns: ['name', 'internalNotes'],
        },
      });

      expect(res.statusCode).toBe(403);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Access Denied');
    });

    it('POST /api/reports/preview — should reject sensitive columns for RECRUITER', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/reports/preview',
        headers: { cookie: recruiterCookie },
        payload: {
          primaryEntity: 'CANDIDATES',
          selectedColumns: ['name', 'currentSalary'],
        },
      });

      expect(res.statusCode).toBe(403);
      const json = res.json();
      expect(json.error.message).toContain('restricted to Administrator');
    });

    it('POST /api/reports/saved & GET /api/reports/saved — should save private report view and list it', async () => {
      const saveRes = await server.inject({
        method: 'POST',
        url: '/api/reports/saved',
        headers: { cookie: recruiterCookie },
        payload: {
          name: 'My Talent Pipeline Report',
          primaryEntity: 'CANDIDATES',
          selectedColumns: ['code', 'name', 'currentTitle', 'status'],
          sortDirection: 'desc',
          isShared: false,
        },
      });

      expect(saveRes.statusCode).toBe(201);
      const saved = saveRes.json().data;
      expect(saved.name).toBe('My Talent Pipeline Report');

      const listRes = await server.inject({
        method: 'GET',
        url: '/api/reports/saved',
        headers: { cookie: recruiterCookie },
      });

      expect(listRes.statusCode).toBe(200);
      const list = listRes.json().data;
      expect(list.some((r: any) => r.id === saved.id)).toBe(true);
    });

    it('POST /api/reports/export — should export report in CSV with formula injection defense', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          primaryEntity: 'JOBS',
          selectedColumns: ['code', 'title', 'openings', 'status'],
          format: 'CSV',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.body).toContain('Job Code,Job Title,Openings,Status');
      expect(res.body).toContain('Senior Quantitative Analyst');
    });

    it('POST /api/reports/export — should export report in Excel format (XLSX/SpreadsheetML)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          primaryEntity: 'JOBS',
          selectedColumns: ['code', 'title', 'openings', 'status'],
          format: 'XLSX',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.ms-excel');
      expect(res.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.body).toContain('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
    });
  });

  describe('Module B: Scheduled Client Reports (Frame 38)', () => {
    let testScheduleId: string;

    it('POST /api/reports/client-schedules — should create client-locked schedule with verified contacts', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/reports/client-schedules',
        headers: { cookie: adminCookie },
        payload: {
          clientId: testClient.id,
          name: 'Aureva Weekly Recruitment Status',
          frequency: 'WEEKLY',
          deliveryDay: 'MONDAY',
          deliveryTime: '08:30',
          timezone: 'Asia/Kolkata',
          period: 'LAST_7_DAYS',
          recipientIds: [testContact.id],
          includeSections: ['JOB_PROGRESS', 'SUBMITTED_PROFILES', 'NEXT_STEPS'],
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.clientId).toBe(testClient.id);
      expect(json.data.status).toBe('DRAFT');
      testScheduleId = json.data.id;
    });

    it('POST /api/reports/client-schedules — should reject unauthorized/invalid recipient contacts', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/reports/client-schedules',
        headers: { cookie: adminCookie },
        payload: {
          clientId: testClient.id,
          name: 'Invalid Contacts Schedule',
          frequency: 'DAILY',
          deliveryTime: '09:00',
          recipientIds: ['00000000-0000-0000-0000-000000000000'],
          includeSections: ['JOB_PROGRESS'],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('INVALID_RECIPIENTS');
    });

    it('POST /api/reports/client-schedules/:id/preview — should render safe HTML email preview', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/reports/client-schedules/${testScheduleId}/preview`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.html).toContain('Aureva Weekly Recruitment Status');
      expect(json.data.html).toContain('Aureva Capital Partner Corp');
      expect(json.data.html).not.toContain('internalNotes');
      expect(json.data.html).not.toContain('feePercentage');
    });

    it('POST /api/reports/client-schedules/:id/test — should execute test delivery to verified contact', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/reports/client-schedules/${testScheduleId}/test`,
        headers: { cookie: adminCookie },
        payload: {
          recipientId: testContact.id,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('SENT');
    });

    it('POST /api/reports/client-schedules/:id/activate & pause — should toggle active schedule state', async () => {
      const actRes = await server.inject({
        method: 'POST',
        url: `/api/reports/client-schedules/${testScheduleId}/activate`,
        headers: { cookie: adminCookie },
      });

      expect(actRes.statusCode).toBe(200);
      expect(actRes.json().data.status).toBe('ACTIVE');

      const pauseRes = await server.inject({
        method: 'POST',
        url: `/api/reports/client-schedules/${testScheduleId}/pause`,
        headers: { cookie: adminCookie },
      });

      expect(pauseRes.statusCode).toBe(200);
      expect(pauseRes.json().data.status).toBe('PAUSED');
    });

    it('GET /api/reports/client-schedules/:id/history — should list delivery execution history', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/reports/client-schedules/${testScheduleId}/history`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });

    it('Security: Client role cannot access internal report builder', async () => {
      const previewRes = await server.inject({
        method: 'POST',
        url: '/api/reports/preview',
        headers: { cookie: clientCookie },
        payload: {
          primaryEntity: 'CANDIDATES',
          selectedColumns: ['code', 'name'],
        },
      });

      expect(previewRes.statusCode).toBe(403);
    });
  });
});
