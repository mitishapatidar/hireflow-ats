import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import candidateRoutes from './candidates.js';
import { prisma } from '@hireflow/db';
import { UserRole } from '@hireflow/shared';

describe('Prompt 8: Candidate Upload, Parsing & Creation Fastify Integration Tests', () => {
  let app: FastifyInstance;
  let testOrgId: string;
  let adminUser: { id: string; email: string; role: UserRole; organizationId: string; status: string };
  let recruiterUser: { id: string; email: string; role: UserRole; organizationId: string; status: string };
  let clientUser: { id: string; email: string; role: UserRole; organizationId: string; status: string };
  const createdCandidateIds: string[] = [];

  beforeAll(async () => {
    // 1. Fetch organization
    const org = await prisma.organization.findFirst();
    testOrgId = org?.id || 'org-test';

    // 2. Fetch or mock users
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', organizationId: testOrgId },
    });
    const recruiter = await prisma.user.findFirst({
      where: { role: 'RECRUITER', organizationId: testOrgId },
    });
    const client = await prisma.user.findFirst({
      where: { role: 'CLIENT', organizationId: testOrgId },
    });

    adminUser = {
      id: admin?.id || 'admin-test',
      email: admin?.email || 'admin@example.com',
      role: UserRole.ADMIN,
      organizationId: testOrgId,
      status: 'ACTIVE',
    };

    recruiterUser = {
      id: recruiter?.id || 'recruiter-test',
      email: recruiter?.email || 'recruiter@example.com',
      role: UserRole.RECRUITER,
      organizationId: testOrgId,
      status: 'ACTIVE',
    };

    clientUser = {
      id: client?.id || 'client-test',
      email: client?.email || 'client@example.com',
      role: UserRole.CLIENT,
      organizationId: testOrgId,
      status: 'ACTIVE',
    };

    // 3. Setup Fastify test server
    app = Fastify();
    let currentUser: any = adminUser;

    app.decorate('authenticate', async (req: any) => {
      req.user = currentUser;
    });

    await app.register(candidateRoutes);
    await app.ready();

    // Helper to switch user context in tests
    (app as any).setCurrentUser = (u: any) => {
      currentUser = u;
    };
  });

  afterAll(async () => {
    // Clean up any test candidates created during integration tests to prevent database drift
    if (createdCandidateIds.length > 0) {
      for (const id of createdCandidateIds) {
        await prisma.candidateDocument.deleteMany({ where: { candidateId: id } });
        await prisma.candidateNote.deleteMany({ where: { candidateId: id } });
        await prisma.candidateTag.deleteMany({ where: { candidateId: id } });
        await prisma.auditLog.deleteMany({ where: { entityId: id } });
        await prisma.candidate.delete({ where: { id } }).catch(() => null);
      }
    }
    await app.close();
  });

  it('POST /api/candidates/check-duplicate: detects existing candidate by email', async () => {
    // Find an existing candidate email
    const existing = await prisma.candidate.findFirst({
      where: { organizationId: testOrgId },
    });

    if (!existing) return;

    (app as any).setCurrentUser(recruiterUser);

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates/check-duplicate',
      payload: {
        email: existing.email,
        phone: existing.phone || '9999999999',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.isDuplicate).toBe(true);
    expect(body.data.matches.length).toBeGreaterThan(0);
    expect(body.data.matches[0].email.toLowerCase()).toBe(existing.email.toLowerCase());
  });

  it('POST /api/candidates/check-duplicate: returns false for unique candidate', async () => {
    (app as any).setCurrentUser(recruiterUser);

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates/check-duplicate',
      payload: {
        email: `unique-test-${Date.now()}@example.com`,
        phone: '9870000000',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.isDuplicate).toBe(false);
    expect(body.data.matches).toHaveLength(0);
  });

  it('POST /api/candidates/parse-text: extracts structured fields from raw text', async () => {
    (app as any).setCurrentUser(recruiterUser);

    const sampleText = `Aarav Shah
Staff Frontend Architect
Email: aarav.shah@example.com | Phone: +91 98765 43210
Location: Mumbai, Maharashtra

Summary:
8.5 years of experience building high-scale React, TypeScript, and Next.js applications at TechNova.

Skills: React, TypeScript, Next.js, GraphQL, Node.js
Current CTC: 32 LPA`;

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates/parse-text',
      payload: {
        rawText: sampleText,
        fileName: 'Aarav_Shah_CV.pdf',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.name.value).toContain('Aarav Shah');
    expect(body.data.email.value).toBe('aarav.shah@example.com');
    expect(body.data.experienceYears.value).toBe(8.5);
    expect(body.data.currentSalary.value).toBe(3200000);
    expect(body.data.skills.value).toContain('React');
    expect(body.data.skills.value).toContain('TypeScript');
  });

  it('POST /api/candidates/parse-text: rejects Client Portal users with HTTP 403', async () => {
    (app as any).setCurrentUser(clientUser);

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates/parse-text',
      payload: {
        rawText: 'Sample resume text',
        fileName: 'resume.pdf',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe('FORBIDDEN_RESOURCE');
  });

  it('POST /api/candidates: successfully creates candidate with transaction and audit log', async () => {
    (app as any).setCurrentUser(recruiterUser);

    const uniqueEmail = `test-intake-${Date.now()}@example.com`;

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: {
        name: 'Intake Test Candidate',
        email: uniqueEmail,
        phone: '+91 98765 11223',
        currentTitle: 'Senior Full Stack Engineer',
        currentCompany: 'TechNova Global',
        experienceYears: 6.5,
        currentSalary: 1800000,
        expectedSalary: 2500000,
        noticePeriod: '30 days',
        location: 'Bengaluru',
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        source: 'Resume Upload',
        tags: ['Immediate Joiner', 'Top Tier'],
        notes: 'Confidential recruiter note regarding interview availability.',
        resumeDocument: {
          fileName: 'Intake_Test_CV.pdf',
          storageKey: `resumes/test-${Date.now()}.pdf`,
          fileSize: 248000,
          mimeType: 'application/pdf',
          fileChecksum: 'abc123sha256',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.candidate.code).toMatch(/^cand-c-\d+/);
    expect(body.data.candidate.name).toBe('Intake Test Candidate');
    createdCandidateIds.push(body.data.candidate.id);

    // Verify candidate in DB
    const dbCandidate = await prisma.candidate.findUnique({
      where: { id: body.data.candidate.id },
      include: { tags: true, notes: true, documents: true },
    });
    expect(dbCandidate).not.toBeNull();
    expect(dbCandidate?.email).toBe(uniqueEmail.toLowerCase());
    expect(dbCandidate?.tags.length).toBe(2);
    expect(dbCandidate?.notes.length).toBe(1);
    expect(dbCandidate?.documents.length).toBe(1);
    expect(dbCandidate?.documents[0].fileName).toBe('Intake_Test_CV.pdf');
  });

  it('POST /api/candidates: rejects duplicate candidate email with HTTP 409', async () => {
    (app as any).setCurrentUser(recruiterUser);

    const existing = await prisma.candidate.findFirst({
      where: { organizationId: testOrgId },
    });

    if (!existing) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: {
        name: 'Duplicate Attempt',
        email: existing.email,
        phone: '+91 99999 88888',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error.code).toBe('DUPLICATE_CANDIDATE');
    expect(body.error.message).toContain('already exists');
  });

  it('POST /api/candidates: rejects Client role from creating candidate with HTTP 403', async () => {
    (app as any).setCurrentUser(clientUser);

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: {
        name: 'Client Attempt',
        email: `client-attempt-${Date.now()}@example.com`,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe('FORBIDDEN_RESOURCE');
  });

  it('POST /api/candidates: rejects duplicate candidate phone with HTTP 409', async () => {
    (app as any).setCurrentUser(recruiterUser);

    const existingWithPhone = await prisma.candidate.findFirst({
      where: { organizationId: testOrgId, phone: { not: null } },
    });

    if (!existingWithPhone || !existingWithPhone.phone) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: {
        name: 'Phone Duplicate Attempt',
        email: `unique-email-${Date.now()}@example.com`,
        phone: existingWithPhone.phone,
      },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error.code).toBe('DUPLICATE_CANDIDATE');
    expect(body.error.message).toContain('matching phone already exists');
  });

  it('POST /api/candidates: blocks duplicate even if client passes allowDuplicateOverride: true', async () => {
    (app as any).setCurrentUser(recruiterUser);

    const existing = await prisma.candidate.findFirst({
      where: { organizationId: testOrgId },
    });

    if (!existing) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: {
        name: 'Bypass Override Attempt',
        email: existing.email,
        allowDuplicateOverride: true, // Attempted client-side bypass
      },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error.code).toBe('DUPLICATE_CANDIDATE');
  });

  it('POST /api/candidates: blocks duplicate when matching a soft-archived candidate', async () => {
    (app as any).setCurrentUser(recruiterUser);

    // Find or create an archived candidate
    let archived = await prisma.candidate.findFirst({
      where: { organizationId: testOrgId, isArchived: true },
    });

    if (!archived) {
      // Find any candidate and soft-archive temporarily
      const candidateToArchive = await prisma.candidate.findFirst({
        where: { organizationId: testOrgId },
      });
      if (candidateToArchive) {
        archived = await prisma.candidate.update({
          where: { id: candidateToArchive.id },
          data: { isArchived: true, archiveReason: 'Audit test' },
        });
      }
    }

    if (!archived) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: {
        name: 'Archived Duplicate Attempt',
        email: archived.email,
      },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error.code).toBe('DUPLICATE_CANDIDATE');
    expect(body.error.message).toContain('Archived');
  });

  it('GET /api/candidates/queue/status: reports BullMQ queue and Redis connectivity status', async () => {
    (app as any).setCurrentUser(adminUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/candidates/queue/status',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.queueName).toBe('resume-parsing');
    expect(body.data.redisUrl).toBeDefined();
    expect(typeof body.data.isRedisAvailable).toBe('boolean');
  });

  it('POST /api/candidates/jobs/parse-resume & GET /api/candidates/jobs/:jobId: enqueues parsing job and tracks status', async () => {
    (app as any).setCurrentUser(recruiterUser);

    const { getStorageProvider } = await import('@hireflow/shared');
    const storage = getStorageProvider();
    const uploaded = await storage.uploadFile(
      Buffer.from('%PDF-1.4\nSunita Krishnamurthy\nLead Data Scientist\nsunita@example.com\n%%EOF'),
      {
        fileName: 'queue_test_cv.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        uploadedById: recruiterUser.id,
      }
    );

    const enqueueResponse = await app.inject({
      method: 'POST',
      url: '/api/candidates/jobs/parse-resume',
      payload: {
        storageKey: uploaded.storageKey,
        fileName: 'queue_test_cv.pdf',
        fileChecksum: uploaded.checksum,
      },
    });

    expect(enqueueResponse.statusCode).toBe(202);
    const enqueueBody = enqueueResponse.json();
    expect(enqueueBody.success).toBe(true);
    expect(enqueueBody.data.jobId).toBeDefined();

    // Query job status
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/api/candidates/jobs/${enqueueBody.data.jobId}`,
    });

    expect(statusResponse.statusCode).toBe(200);
    const statusBody = statusResponse.json();
    expect(statusBody.success).toBe(true);
    expect(statusBody.data.status).toBeDefined();

    // Cleanup storage file
    await storage.deleteFile(uploaded.storageKey);
  });
});
