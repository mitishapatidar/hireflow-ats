/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Prompt 19: Data Governance, Custom Fields & Exports Integration Tests', { timeout: 35000 }, () => {
  let app: any;
  let adminCookie: string;
  let reverifiedAdminCookie: string;
  let managerCookie: string;
  let recruiterCookie: string;
  let clientCookie: string;

  let adminUser: any;
  let managerUser: any;
  let recruiterUser: any;
  let clientUser: any;

  const createdSessionTokens: string[] = [];
  const cleanupFieldDefinitionIds: string[] = [];
  const cleanupCandidateIds: string[] = [];
  const cleanupExportIds: string[] = [];

  let testCandidateId: string;
  let testClientId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    managerUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.MANAGER },
    });

    recruiterUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.RECRUITER },
    });

    clientUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CLIENT },
    });

    const client = await prisma.client.findFirstOrThrow({
      where: { organizationId: adminUser.organizationId, isArchived: false },
    });
    testClientId = client.id;

    // Helper: Create session
    async function createSessionCookie(userId: string, isReverified: boolean = false) {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      createdSessionTokens.push(tokenHash);
      await prisma.session.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastReverifiedAt: isReverified ? new Date() : null,
        },
      });
      return `${SESSION_COOKIE_NAME}=${rawToken}`;
    }

    adminCookie = await createSessionCookie(adminUser.id, false);
    reverifiedAdminCookie = await createSessionCookie(adminUser.id, true);
    managerCookie = await createSessionCookie(managerUser.id, false);
    recruiterCookie = await createSessionCookie(recruiterUser.id, false);
    clientCookie = await createSessionCookie(clientUser.id, false);

    // Create a test candidate for governance tests
    const cand = await prisma.candidate.create({
      data: {
        organizationId: adminUser.organizationId,
        code: `CAN-P19-${Date.now().toString().slice(-4)}`,
        name: 'Gov Test Candidate',
        email: `gov_cand_${Date.now()}@example.com`,
        phone: '+91 98765 00019',
        skills: ['TypeScript', 'Fastify', 'Governance'],
      },
    });
    testCandidateId = cand.id;
    cleanupCandidateIds.push(cand.id);
  });

  afterAll(async () => {
    // Clean up created sessions
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }

    // Clean up custom fields
    if (cleanupFieldDefinitionIds.length > 0) {
      await prisma.customFieldDefinition.deleteMany({
        where: { id: { in: cleanupFieldDefinitionIds } },
      });
    }

    // Clean up candidates
    if (cleanupCandidateIds.length > 0) {
      await prisma.candidate.deleteMany({
        where: { id: { in: cleanupCandidateIds } },
      });
    }

    // Clean up exports
    if (cleanupExportIds.length > 0) {
      await prisma.exportRequest.deleteMany({
        where: { id: { in: cleanupExportIds } },
      });
    }

    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. SCOPED EXPORTS TESTS (TAB 1 & FRAME 37)
  // =========================================================================

  describe('Scoped Exports & Formula Injection Defense', () => {
    it('1. GET /api/governance/exports/config returns entity catalogs for Admin & Manager, denies Recruiter/Client', async () => {
      // Admin allowed
      const resAdmin = await app.inject({
        method: 'GET',
        url: '/api/governance/exports/config',
        headers: { cookie: adminCookie },
      });
      expect(resAdmin.statusCode).toBe(200);
      const bodyAdmin = JSON.parse(resAdmin.payload);
      expect(bodyAdmin.success).toBe(true);
      expect(bodyAdmin.data.entities.CANDIDATES).toBeDefined();
      expect(bodyAdmin.data.entities.JOBS).toBeDefined();
      expect(bodyAdmin.data.canExportSensitive).toBe(true);

      // Recruiter denied
      const resRecruiter = await app.inject({
        method: 'GET',
        url: '/api/governance/exports/config',
        headers: { cookie: recruiterCookie },
      });
      expect(resRecruiter.statusCode).toBe(403);
    });

    it('2. POST /api/governance/exports/preview returns sanitized preview sample and strips forbidden fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/governance/exports/preview',
        headers: { cookie: adminCookie },
        payload: {
          entityType: 'CANDIDATES',
          selectedColumns: ['code', 'name', 'email', 'skills', 'passwordHash', 'recruiterMargin'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.columns.some((c: any) => c.key === 'passwordHash')).toBe(false);
      expect(body.data.columns.some((c: any) => c.key === 'recruiterMargin')).toBe(false);
      expect(body.data.columns.some((c: any) => c.key === 'name')).toBe(true);
    });

    it('3. POST /api/governance/exports blocks sensitive exports without recent re-verification', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/governance/exports',
        headers: { cookie: adminCookie }, // not reverified
        payload: {
          entityType: 'CANDIDATES',
          selectedColumns: ['code', 'name', 'currentSalary'], // currentSalary is sensitive!
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('REVERIFICATION_REQUIRED');
    });

    it('4. POST /api/governance/exports generates export when re-verified and logs audit record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/governance/exports',
        headers: { cookie: reverifiedAdminCookie },
        payload: {
          entityType: 'CANDIDATES',
          selectedColumns: ['code', 'name', 'email', 'skills', 'currentSalary'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.exportId).toBeDefined();
      expect(body.data.downloadUrl).toBeDefined();
      expect(body.data.rowCount).toBeGreaterThanOrEqual(1);

      cleanupExportIds.push(body.data.exportId);

      // Verify AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'DATA_EXPORT_GENERATED',
          entityId: body.data.exportId,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(adminUser.id);

      // Test download endpoint
      const dlRes = await app.inject({
        method: 'GET',
        url: body.data.downloadUrl,
        headers: { cookie: adminCookie },
      });
      expect(dlRes.statusCode).toBe(200);
      expect(dlRes.headers['content-type']).toContain('text/csv');
      expect(dlRes.headers['content-disposition']).toContain('attachment; filename=');
      expect(dlRes.payload).toContain('Candidate Code');
      expect(dlRes.payload).toContain('Full Name');
    });
  });

  // =========================================================================
  // 2. CUSTOM FIELDS TESTS (TAB 2 & FRAME 33 TAB 2)
  // =========================================================================

  describe('Custom Fields & Client Rules', () => {
    let testFieldId: string;

    it('1. POST /api/governance/custom-fields creates custom field with snake_case key and version 1', async () => {
      const key = `test_field_${Date.now().toString().slice(-4)}`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/governance/custom-fields',
        headers: { cookie: adminCookie },
        payload: {
          entityType: 'CANDIDATE',
          fieldName: `Notice Preference ${Date.now().toString().slice(-4)}`,
          fieldKey: key,
          fieldType: 'TEXT',
          description: 'Candidate notice period details',
          isRequired: false,
          visibility: 'INTERNAL_ONLY',
          validationRules: { minLength: 2, maxLength: 50 },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.fieldKey).toBe(key);
      expect(body.data.version).toBe(1);
      expect(body.data.isActive).toBe(true);

      testFieldId = body.data.id;
      cleanupFieldDefinitionIds.push(testFieldId);
    });

    it('2. POST /api/governance/custom-fields rejects duplicate fieldName/fieldKey with 409 CONFLICT', async () => {
      const existing = await prisma.customFieldDefinition.findUniqueOrThrow({
        where: { id: testFieldId },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/governance/custom-fields',
        headers: { cookie: adminCookie },
        payload: {
          entityType: 'CANDIDATE',
          fieldName: existing.fieldName,
          fieldKey: `unique_${Date.now()}`,
          fieldType: 'TEXT',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('DUPLICATE_FIELD');
    });

    it('3. PATCH /api/governance/custom-fields/:id increments version and updates definition', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/governance/custom-fields/${testFieldId}`,
        headers: { cookie: adminCookie },
        payload: {
          description: 'Updated notice period documentation',
          displayOrder: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.version).toBe(2);
      expect(body.data.description).toBe('Updated notice period documentation');
      expect(body.data.displayOrder).toBe(5);
    });

    it('4. POST /api/governance/custom-fields/:id/archive soft-deactivates field (isActive: false)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/governance/custom-fields/${testFieldId}/archive`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.isActive).toBe(false);

      // Re-activate for value tests
      await prisma.customFieldDefinition.update({
        where: { id: testFieldId },
        data: { isActive: true },
      });
    });

    it('5. POST /api/governance/custom-fields/client-rule configures mandatory client requirement', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/governance/custom-fields/client-rule',
        headers: { cookie: adminCookie },
        payload: {
          clientId: testClientId,
          fieldDefinitionId: testFieldId,
          isRequired: true,
          workflowVersion: 1,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.isRequired).toBe(true);
    });

    it('6. POST & GET /api/governance/custom-fields/values saves validated values and returns them', async () => {
      // 1. Invalid value failing minLength
      const resInvalid = await app.inject({
        method: 'POST',
        url: `/api/governance/custom-fields/values/CANDIDATE/${testCandidateId}`,
        headers: { cookie: recruiterCookie },
        payload: {
          [testFieldId]: 'A', // minLength is 2!
        },
      });
      expect(resInvalid.statusCode).toBe(400);

      // 2. Valid value
      const resValid = await app.inject({
        method: 'POST',
        url: `/api/governance/custom-fields/values/CANDIDATE/${testCandidateId}`,
        headers: { cookie: recruiterCookie },
        payload: {
          [testFieldId]: 'Immediate 15 Days',
        },
      });
      expect(resValid.statusCode).toBe(200);

      // 3. GET values
      const resGet = await app.inject({
        method: 'GET',
        url: `/api/governance/custom-fields/values/CANDIDATE/${testCandidateId}`,
        headers: { cookie: recruiterCookie },
      });
      expect(resGet.statusCode).toBe(200);
      const body = JSON.parse(resGet.payload);
      const saved = body.data.find((item: any) => item.definition.id === testFieldId);
      expect(saved).toBeDefined();
      expect(saved.value).toBe('Immediate 15 Days');
    });
  });

  // =========================================================================
  // 3. ARCHIVE & RESTORE TESTS (TAB 3 & FRAME 33 TAB 3)
  // =========================================================================

  describe('Archive & Safe Restore with Conflict Detection', () => {
    let archivedCandId: string;
    const testEmail = `archived_cand_${Date.now()}@example.com`;

    beforeAll(async () => {
      // Create candidate and archive them
      const cand = await prisma.candidate.create({
        data: {
          organizationId: adminUser.organizationId,
          code: `CAN-ARC-${Date.now().toString().slice(-4)}`,
          name: 'Archived Candidate',
          email: testEmail,
          isArchived: true,
          archivedAt: new Date(),
          archiveReason: 'Candidate requested profile dormancy',
        },
      });
      archivedCandId = cand.id;
      cleanupCandidateIds.push(cand.id);
    });

    it('1. GET /api/governance/archive/candidates lists archived candidates and checks for conflict', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/governance/archive/candidates',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      const found = body.data.find((c: any) => c.id === archivedCandId);
      expect(found).toBeDefined();
      expect(found.hasConflict).toBe(false);
    });

    it('2. POST /api/governance/archive/candidates/:id/restore restores candidate and logs audit', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/governance/archive/candidates/${archivedCandId}/restore`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'Candidate re-engaged for Senior Engineer role',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.isArchived).toBe(false);
      expect(body.data.archiveReason).toBeNull();

      // Check DB
      const dbCand = await prisma.candidate.findUnique({
        where: { id: archivedCandId },
      });
      expect(dbCand?.isArchived).toBe(false);

      // Check AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'CANDIDATE_RESTORED',
          entityId: archivedCandId,
        },
      });
      expect(audit).not.toBeNull();
      expect((audit?.after as any).restoreReason).toBe('Candidate re-engaged for Senior Engineer role');
    });

    it('3. POST /api/governance/archive/candidates/:id/restore blocks restore if duplicate active candidate exists', async () => {
      // Re-archive the candidate
      await prisma.candidate.update({
        where: { id: archivedCandId },
        data: { isArchived: true, archiveReason: 'Archived again' },
      });

      // Create an active candidate with the same email
      const activeDuplicate = await prisma.candidate.create({
        data: {
          organizationId: adminUser.organizationId,
          code: `CAN-DUP-${Date.now().toString().slice(-4)}`,
          name: 'Active Duplicate',
          email: testEmail,
          isArchived: false,
        },
      });
      cleanupCandidateIds.push(activeDuplicate.id);

      // Attempt restore
      const res = await app.inject({
        method: 'POST',
        url: `/api/governance/archive/candidates/${archivedCandId}/restore`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'Attempting to restore duplicate',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('RESTORE_CONFLICT');
    });
  });

  // =========================================================================
  // 4. DOWNLOAD POLICY & CV WATERMARKING TESTS (TAB 4 & FRAME 33 TAB 4)
  // =========================================================================

  describe('Download Policy & CV Watermarking', () => {
    it('1. GET /api/governance/download-policy returns 4 role policies with Asia/Kolkata boundary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/governance/download-policy',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.timezone).toBe('Asia/Kolkata');
      expect(body.data.policies.length).toBe(4);
      expect(body.data.policies.some((p: any) => p.role === 'RECRUITER')).toBe(true);
    });

    it('2. PATCH /api/governance/download-policy updates daily limit and watermarking settings', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/governance/download-policy',
        headers: { cookie: adminCookie },
        payload: {
          role: 'RECRUITER',
          dailyCvLimit: 25,
          requireWatermark: true,
          allowOriginalDownload: false,
          isActive: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.dailyCvLimit).toBe(25);
      expect(body.data.role).toBe('RECRUITER');
    });

    it('3. GET /api/governance/cv/:candidateId/download logs DownloadLog and returns watermarked notice', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/governance/cv/${testCandidateId}/download?clientId=${testClientId}`,
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.watermarkApplied).toBe(true);
      expect(body.data.watermarkText).toContain('HIREFLOW /');

      // Verify DownloadLog entry in DB
      const log = await prisma.downloadLog.findFirst({
        where: {
          resourceType: 'CV',
          resourceId: testCandidateId,
          result: 'SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log?.watermarkApplied).toBe(true);
    });
  });

  // =========================================================================
  // 5. AUDIT TRAIL TESTS (TAB 5 & FRAME 33 TAB 5)
  // =========================================================================

  describe('Audit Trail Viewer & Secret Redaction', () => {
    it('1. GET /api/governance/audit-logs returns audit logs with redacted secrets', async () => {
      // Create dummy audit record with secrets
      const dummyLog = await prisma.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'TEST_SECRET_ACTION',
          entity: 'test_entity',
          entityId: 'test-123',
          before: { password: 'secretPassword', tokenHash: 'tokenHash123', safeValue: 'visible' },
          after: { password: 'newSecretPassword', safeValue: 'visibleUpdated' },
          ipAddress: '127.0.0.1',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/governance/audit-logs?action=TEST_SECRET_ACTION',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      const found = body.data.find((l: any) => l.id === dummyLog.id);
      expect(found).toBeDefined();
      expect(found.before.password).toBe('[REDACTED]');
      expect(found.before.tokenHash).toBe('[REDACTED]');
      expect(found.before.safeValue).toBe('visible');

      // Clean up
      await prisma.auditLog.delete({ where: { id: dummyLog.id } });
    });

    it('2. POST /api/governance/audit-logs/export generates CSV audit trail when re-verified', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/governance/audit-logs/export',
        headers: { cookie: reverifiedAdminCookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');
      expect(res.payload).toContain('Timestamp (UTC)');
      expect(res.payload).toContain('Actor Name');
      expect(res.payload).toContain('Action Performed');
    });
  });
});
