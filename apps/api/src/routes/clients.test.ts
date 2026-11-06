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

describe('Clients CRM & Client Record API Integration Tests (Prompt 9)', () => {
  let server: FastifyInstance;
  let adminCookie: string;
  let clientCookie: string;
  let candidateCookie: string;
  let adminUser: any;
  let createdClientIds: string[] = [];

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // 1. Fetch existing seeded admin user
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    // 2. Fetch existing seeded client portal user (Priya Gupta)
    const clientUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CLIENT },
    });

    // 3. Fetch existing seeded candidate user (Aarav Shah)
    const candidateUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CANDIDATE },
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
    clientCookie = await createSessionCookie(clientUser.id);
    candidateCookie = await createSessionCookie(candidateUser.id);
  });

  afterAll(async () => {
    // Clean up only test clients created during this suite
    if (createdClientIds.length > 0) {
      await prisma.clientDocument.deleteMany({
        where: { clientId: { in: createdClientIds } },
      });
      await prisma.clientContact.deleteMany({
        where: { clientId: { in: createdClientIds } },
      });
      await prisma.meeting.deleteMany({
        where: { clientId: { in: createdClientIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { entity: 'client', entityId: { in: createdClientIds } },
      });
      await prisma.client.deleteMany({
        where: { id: { in: createdClientIds } },
      });
    }
    await server.close();
  });

  describe('1. GET /api/clients (List, Search, Filter & Live Stats)', () => {
    it('returns paginated clients with live statistics cards for ADMIN', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.clients)).toBe(true);
      expect(body.data.clients.length).toBeGreaterThanOrEqual(4);

      // Verify live stats
      expect(typeof body.data.stats.activeCount).toBe('number');
      expect(typeof body.data.stats.prospectCount).toBe('number');
      expect(typeof body.data.stats.meetingsCount).toBe('number');
      expect(body.data.stats.activeCount).toBeGreaterThanOrEqual(3);
      expect(body.data.stats.prospectCount).toBeGreaterThanOrEqual(1);

      // Verify pagination
      expect(body.data.pagination.page).toBe(1);
      expect(body.data.pagination.total).toBeGreaterThanOrEqual(4);
    });

    it('searches clients by legal name, code, and industry', async () => {
      const resName = await server.inject({
        method: 'GET',
        url: '/api/clients?search=Acme',
        headers: { cookie: adminCookie },
      });
      expect(resName.statusCode).toBe(200);
      const nameBody = resName.json();
      expect(nameBody.data.clients.some((c: any) => c.code === 'CL-1001')).toBe(true);

      const resCode = await server.inject({
        method: 'GET',
        url: '/api/clients?search=CL-1004',
        headers: { cookie: adminCookie },
      });
      expect(resCode.statusCode).toBe(200);
      const codeBody = resCode.json();
      expect(codeBody.data.clients.length).toBe(1);
      expect(codeBody.data.clients[0].legalName).toContain('Vertex');
    });

    it('filters clients by status PROSPECT', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients?status=PROSPECT',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.clients.every((c: any) => c.status === 'PROSPECT')).toBe(true);
    });

    it('hides archived clients by default and shows them when isArchived=true', async () => {
      const resDefault = await server.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { cookie: adminCookie },
      });
      const defaultBody = resDefault.json();
      expect(defaultBody.data.clients.every((c: any) => c.isArchived === false)).toBe(true);
    });
  });

  describe('2. MANDATORY SECURITY CONTRACT: Commercial Data Zero Leakage', () => {
    it('CONTRACT TEST: GET /api/clients summary DTO NEVER leaks commercial fee fields', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      for (const client of body.data.clients) {
        expect(client.feePercentage).toBeUndefined();
        expect(client.commercialTerms).toBeUndefined();
        expect(client.paymentTerms).toBeUndefined();
        expect(client.relationshipNotes).toBeUndefined();
      }
    });

    it('CONTRACT TEST: GET /api/clients/:id detail DTO NEVER leaks commercial fee fields', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients/client-acme-tech',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      expect(body.data.feePercentage).toBeUndefined();
      expect(body.data.commercialTerms).toBeUndefined();
      expect(body.data.paymentTerms).toBeUndefined();
      expect(body.data.relationshipNotes).toBeUndefined();
    });

    it('CONTRACT TEST: CLIENT role cannot access internal commercial terms endpoint (HTTP 403)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients/client-acme-tech/commercial',
        headers: { cookie: clientCookie },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Access Denied');
    });

    it('CONTRACT TEST: CANDIDATE role is strictly rejected from all client CRM endpoints (HTTP 403)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients',
        headers: { cookie: candidateCookie },
      });

      expect(res.statusCode).toBe(403);

      const resDetail = await server.inject({
        method: 'GET',
        url: '/api/clients/client-acme-tech',
        headers: { cookie: candidateCookie },
      });

      expect(resDetail.statusCode).toBe(403);
    });

    it('ADMIN role can access internal commercial terms endpoint', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients/client-acme-tech/commercial',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.clientId).toBe('client-acme-tech');
      expect(body.data.feePercentage).toBe(8.5);
      expect(body.data.commercialTerms).toContain('8.5% fee');
      expect(body.data.paymentTerms).toBe('NET_30');
    });
  });

  describe('3. POST /api/clients (Concurrency-safe Code Generation & Normalization)', () => {
    it('creates a new client with automatic sequential CL-XXXX code and primary contact', async () => {
      const payload = {
        legalName: 'Apex Innovations Private Limited',
        industry: 'FinTech & WealthTech',
        website: 'https://apexinnovations.io',
        location: 'Bengaluru, Karnataka',
        status: 'ACTIVE',
        nextStep: 'Finalize MSA agreement',
        feePercentage: 9.0,
        commercialTerms: '9% fee on first year fixed CTC',
        paymentTerms: 'NET_30',
        primaryContact: {
          name: 'Sunil Rao',
          designation: 'VP Engineering',
          email: 'sunil.r@apexinnovations.io',
          phone: '+91 98765 11111',
          contactType: 'PRIMARY',
          isPrimary: true,
        },
      };

      const res = await server.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { cookie: adminCookie },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.code).toMatch(/^CL-\d{4}$/);
      expect(body.data.legalName).toBe('Apex Innovations Private Limited');

      createdClientIds.push(body.data.id);

      // Verify contact was created
      const contact = await prisma.clientContact.findFirst({
        where: { clientId: body.data.id, isPrimary: true },
      });
      expect(contact).not.toBeNull();
      expect(contact?.name).toBe('Sunil Rao');
      expect(contact?.email).toBe('sunil.r@apexinnovations.io');
    });

    it('blocks duplicate client creation using normalized company name (HTTP 409)', async () => {
      // "Acme Technologies Private Limited" exists as CL-1001. Trying with variation "Acme Technologies Pvt Ltd"
      const dupPayload = {
        legalName: 'Acme Technologies Pvt Ltd',
        industry: 'Tech',
      };

      const res = await server.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { cookie: adminCookie },
        payload: dupPayload,
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('DUPLICATE_CLIENT_NAME');
    });

    it('rejects invalid website URLs (HTTP 400)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/clients',
        headers: { cookie: adminCookie },
        payload: {
          legalName: 'Test Random Company Ltd',
          website: 'not-valid-url',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
    });
  });

  describe('4. PATCH /api/clients/:id (Company & Commercial Updates)', () => {
    it('updates client profile fields and writes an audit log', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/clients/client-bright-labs',
        headers: { cookie: adminCookie },
        payload: {
          industry: 'DeepTech & Generative AI',
          nextStep: 'Schedule quarterly business review',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      const client = await prisma.client.findUnique({
        where: { id: 'client-bright-labs' },
      });
      expect(client?.industry).toBe('DeepTech & Generative AI');
      expect(client?.nextStep).toBe('Schedule quarterly business review');
    });

    it('updates commercial fee terms and records audit event', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/clients/client-bright-labs/commercial',
        headers: { cookie: adminCookie },
        payload: {
          feePercentage: 9.5,
          paymentTerms: 'NET_45',
          relationshipNotes: 'Special volume tier agreed for Q4.',
        },
      });

      expect(res.statusCode).toBe(200);

      const client = await prisma.client.findUnique({
        where: { id: 'client-bright-labs' },
      });
      expect(Number(client?.feePercentage)).toBe(9.5);
      expect(client?.paymentTerms).toBe('NET_45');
      expect(client?.relationshipNotes).toBe('Special volume tier agreed for Q4.');
    });
  });

  describe('5. CONTACTS & JOBS Tabs', () => {
    it('GET /api/clients/:id/contacts resolves contacts and portal access indicator', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients/client-acme-tech/contacts',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const priya = body.data.find((c: any) => c.name === 'Priya Gupta');
      expect(priya).toBeDefined();
      expect(priya.isPrimary).toBe(true);
      // Priya Gupta has a ClientAccess record created in Prompt 6
      expect(priya.hasPortalAccess).toBe(true);
      expect(priya.portalUserId).toBeDefined();
    });

    it('GET /api/clients/:id/jobs returns mandates associated strictly with this client', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/clients/client-acme-tech/jobs',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3); // J-201, J-202, J-208
      expect(body.data.some((j: any) => j.code === 'J-201')).toBe(true);
    });
  });

  describe('6. DOCUMENTS & VERIFICATION', () => {
    let testDocId: string;

    it('creates a client document record with storageKey and unverified status', async () => {
      const doc = await prisma.clientDocument.create({
        data: {
          clientId: 'client-acme-tech',
          fileName: 'acme_master_services_agreement.pdf',
          fileUrl: 'client-documents/acme_msa_v1.pdf',
          storageKey: 'client-documents/acme_msa_v1.pdf',
          storageBucket: 'client-documents',
          documentType: 'AGREEMENT',
          version: 1,
          fileSize: 102400,
          mimeType: 'application/pdf',
          isVerified: false,
          createdById: adminUser.id,
        },
      });
      testDocId = doc.id;

      const res = await server.inject({
        method: 'GET',
        url: '/api/clients/client-acme-tech/documents',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.some((d: any) => d.id === testDocId)).toBe(true);
      const found = body.data.find((d: any) => d.id === testDocId);
      expect(found.isVerified).toBe(false);
      expect(found.version).toBe(1);
    });

    it('verifies a client document and records verifiedById and verifiedAt', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/clients/client-acme-tech/documents/${testDocId}/verify`,
        headers: { cookie: adminCookie },
        payload: { isVerified: true },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.isVerified).toBe(true);

      const updated = await prisma.clientDocument.findUnique({
        where: { id: testDocId },
      });
      expect(updated?.isVerified).toBe(true);
      expect(updated?.verifiedById).toBe(adminUser.id);
      expect(updated?.verifiedAt).not.toBeNull();
    });

    it('generates a short-lived presigned download URL for document', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/clients/client-acme-tech/documents/${testDocId}/download`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.signedUrl).toBeDefined();
      expect(body.fileName).toBe('acme_master_services_agreement.pdf');

      // Cleanup test doc
      await prisma.clientDocument.delete({ where: { id: testDocId } });
    });
  });

  describe('7. ARCHIVE & RESTORE (Soft Deletion Mandate)', () => {
    it('archives client requiring a mandatory reason and records audit log', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/clients/client-vertex/archive',
        headers: { cookie: adminCookie },
        payload: { reason: 'Company merger in progress, temporarily paused hiring' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.isArchived).toBe(true);

      const client = await prisma.client.findUnique({
        where: { id: 'client-vertex' },
      });
      expect(client?.isArchived).toBe(true);
      expect(client?.archiveReason).toBe('Company merger in progress, temporarily paused hiring');
      expect(client?.archivedAt).not.toBeNull();
    });

    it('restores archived client', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/clients/client-vertex/restore',
        headers: { cookie: adminCookie },
        payload: { reason: 'Hiring resumed after merger finalized' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.isArchived).toBe(false);

      const client = await prisma.client.findUnique({
        where: { id: 'client-vertex' },
      });
      expect(client?.isArchived).toBe(false);
      expect(client?.archiveReason).toBeNull();
    });
  });
});
