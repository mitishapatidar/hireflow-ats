import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import { UserRole } from '@hireflow/shared';

function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const SESSION_COOKIE_NAME = 'hireflow_session';

describe('Prompt 20: Sourcing, Bulk Import, Duplicate Review & Chrome Extension Tests', () => {
  let app: any;
  let adminUser: any;
  let recruiterUser: any;
  let clientUser: any;
  let adminCookie: string;
  let recruiterCookie: string;
  let clientCookie: string;
  let testCandidate1: any;
  let testCandidate2: any;
  let testJob: any;

  const createdSessionTokens: string[] = [];
  const cleanupCandidateIds: string[] = [];
  const cleanupBatchIds: string[] = [];
  const cleanupSourcingItemIds: string[] = [];
  const cleanupTokenIds: string[] = [];

  async function createSessionCookie(userId: string): Promise<string> {
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

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Fetch existing seeded users
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    recruiterUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.RECRUITER, organizationId: adminUser.organizationId },
    });

    clientUser = await prisma.user.findFirst({
      where: { role: UserRole.CLIENT },
    });

    adminCookie = await createSessionCookie(adminUser.id);
    recruiterCookie = await createSessionCookie(recruiterUser.id);
    if (clientUser) {
      clientCookie = await createSessionCookie(clientUser.id);
    }

    testJob = await prisma.job.findFirst({
      where: { organizationId: adminUser.organizationId, status: 'ACTIVE' },
    });

    // Create 2 distinct test candidates for merge & duplicate testing
    testCandidate1 = await prisma.candidate.create({
      data: {
        code: `cand-test-${Date.now()}-1`,
        organizationId: adminUser.organizationId,
        name: 'Pradeep Sharma',
        email: `pradeep.sharma.${Date.now()}@example.com`,
        phone: '+91 98888 11111',
        currentTitle: 'Senior React Developer',
        currentCompany: 'Infosys Limited',
        skills: ['React', 'TypeScript', 'Redux'],
        ownerId: recruiterUser.id,
        createdById: adminUser.id,
      },
    });
    cleanupCandidateIds.push(testCandidate1.id);

    testCandidate2 = await prisma.candidate.create({
      data: {
        code: `cand-test-${Date.now()}-2`,
        organizationId: adminUser.organizationId,
        name: 'Pradeep Sharma',
        email: `pradeep.sharma.alt.${Date.now()}@example.com`,
        phone: '+91 98888 22222',
        currentTitle: 'Lead Frontend Architect',
        currentCompany: 'Infosys',
        skills: ['React', 'Next.js', 'GraphQL'],
        ownerId: recruiterUser.id,
        createdById: adminUser.id,
      },
    });
    cleanupCandidateIds.push(testCandidate2.id);
  });

  afterAll(async () => {
    // Cleanup sessions
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({ where: { tokenHash: { in: createdSessionTokens } } });
    }

    // Cleanup created test records
    if (cleanupCandidateIds.length > 0) {
      await prisma.application.deleteMany({ where: { candidateId: { in: cleanupCandidateIds } } });
      await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: cleanupCandidateIds } } });
      await prisma.candidateNote.deleteMany({ where: { candidateId: { in: cleanupCandidateIds } } });
      await prisma.candidateTag.deleteMany({ where: { candidateId: { in: cleanupCandidateIds } } });
      await prisma.candidateMerge.deleteMany({
        where: {
          OR: [
            { masterCandidateId: { in: cleanupCandidateIds } },
            { secondaryCandidateId: { in: cleanupCandidateIds } },
          ],
        },
      });
      await prisma.candidate.deleteMany({ where: { id: { in: cleanupCandidateIds } } });
    }

    if (cleanupBatchIds.length > 0) {
      await prisma.importItem.deleteMany({ where: { importBatchId: { in: cleanupBatchIds } } });
      await prisma.importBatch.deleteMany({ where: { id: { in: cleanupBatchIds } } });
    }

    if (cleanupSourcingItemIds.length > 0) {
      await prisma.sourcingItem.deleteMany({ where: { id: { in: cleanupSourcingItemIds } } });
    }

    if (cleanupTokenIds.length > 0) {
      await prisma.extensionCaptureToken.deleteMany({ where: { id: { in: cleanupTokenIds } } });
    }

    await app.close();
  });

  // --------------------------------------------------------------------------
  // A. Bulk Resume Import (Frame 18)
  // --------------------------------------------------------------------------
  describe('Bulk Resume Import Workflow', () => {
    let createdBatchId: string;
    let createdItemId: string;

    it('1. POST /api/sourcing/import/batches: creates a batch and processes items into AWAITING_REVIEW', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/import/batches',
        headers: { cookie: recruiterCookie },
        payload: {
          fileName: 'Frontend_Candidates_Batch_1.zip',
          importType: 'BULK_RESUME',
          totalRecords: 2,
          files: [
            {
              fileName: 'Rohan_Gupta_Resume.pdf',
              fileKey: 'resumes/mock-rohan-gupta.pdf',
              fileSize: 102400,
              mimeType: 'application/pdf',
            },
            {
              fileName: 'Pradeep_Sharma_CV.docx',
              fileKey: 'resumes/mock-pradeep-duplicate.docx',
              fileSize: 85400,
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.batchCode).toMatch(/^B-\d+/);
      expect(body.data.totalRecords).toBe(2);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.status).toBe('COMPLETED');

      createdBatchId = body.data.id;
      createdItemId = body.data.items[0].id;
      cleanupBatchIds.push(createdBatchId);
    });

    it('2. GET /api/sourcing/import/batches: lists import batches for organization', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sourcing/import/batches',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.some((b: any) => b.id === createdBatchId)).toBe(true);
    });

    it('3. GET /api/sourcing/import/batches/:id: returns batch details and individual items', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/sourcing/import/batches/${createdBatchId}`,
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.id).toBe(createdBatchId);
      expect(body.data.items.length).toBeGreaterThan(0);
      expect(body.data.items[0].status).toBe('AWAITING_REVIEW');
    });

    it('4. POST /api/sourcing/import/items/:id/review: updates parsed fields during recruiter review', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sourcing/import/items/${createdItemId}/review`,
        headers: { cookie: recruiterCookie },
        payload: {
          name: 'Rohan Gupta',
          email: `rohan.gupta.${Date.now()}@example.com`,
          phone: '+91 97777 55555',
          currentTitle: 'Lead Software Engineer',
          currentCompany: 'Swiggy',
          experienceYears: 5,
          location: 'Bengaluru',
          skills: ['React', 'Node.js', 'AWS'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.recordData.name).toBe('Rohan Gupta');
    });

    it('5. POST /api/sourcing/import/items/:id/create-candidate: explicit human review creates Candidate', async () => {
      const candEmail = `rohan.gupta.verified.${Date.now()}@example.com`;

      const res = await app.inject({
        method: 'POST',
        url: `/api/sourcing/import/items/${createdItemId}/create-candidate`,
        headers: { cookie: recruiterCookie },
        payload: {
          candidateData: {
            name: 'Rohan Gupta',
            email: candEmail,
            phone: '+91 97777 55555',
            currentTitle: 'Lead Software Engineer',
            currentCompany: 'Swiggy',
            skills: ['React', 'Node.js', 'AWS'],
            jobId: testJob?.id,
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.code).toMatch(/^cand-c-\d+/);
      expect(body.data.email).toBe(candEmail);
      cleanupCandidateIds.push(body.data.id);

      // Verify ImportItem status updated to APPROVED
      const item = await prisma.importItem.findUnique({ where: { id: createdItemId } });
      expect(item?.status).toBe('APPROVED');
      expect(item?.createdCandidateId).toBe(body.data.id);
    });

    it('6. POST /api/sourcing/import/items/:id/create-candidate: rejects duplicate creation if already approved', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sourcing/import/items/${createdItemId}/create-candidate`,
        headers: { cookie: recruiterCookie },
        payload: {
          candidateData: {
            name: 'Rohan Gupta',
            email: `duplicate.attempt@example.com`,
          },
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('ALREADY_APPROVED');
    });

    it('7. Client role is strictly forbidden from accessing bulk import routes', async () => {
      if (clientCookie) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/sourcing/import/batches',
          headers: { cookie: clientCookie },
        });

        expect(res.statusCode).toBe(403);
      }
    });
  });

  // --------------------------------------------------------------------------
  // B. Duplicate Detection & Review Queue (Frame 19)
  // --------------------------------------------------------------------------
  describe('Duplicate Detection & Review', () => {
    it('1. POST /api/sourcing/duplicates/check: detects exact email match against existing candidate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/duplicates/check',
        headers: { cookie: recruiterCookie },
        payload: {
          email: testCandidate1.email,
          name: 'Pradeep',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.isDuplicate).toBe(true);
      expect(body.data.highestCategory).toBe('EXACT_DUPLICATE');
      expect(body.data.matches[0].candidate.id).toBe(testCandidate1.id);
    });

    it('2. POST /api/sourcing/duplicates/check: detects exact phone match', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/duplicates/check',
        headers: { cookie: recruiterCookie },
        payload: {
          phone: testCandidate1.phone,
          email: 'random.unrelated@domain.com',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.isDuplicate).toBe(true);
      expect(body.data.highestCategory).toBe('EXACT_DUPLICATE');
    });
  });

  // --------------------------------------------------------------------------
  // C. Candidate Merge Workflow (Frame 19)
  // --------------------------------------------------------------------------
  describe('Candidate Merge Engine', () => {
    it('1. POST /api/sourcing/merges/preview: returns comparison and checks eligibility', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/merges/preview',
        headers: { cookie: recruiterCookie },
        payload: {
          masterCandidateId: testCandidate1.id,
          secondaryCandidateId: testCandidate2.id,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.master.id).toBe(testCandidate1.id);
      expect(body.data.secondary.id).toBe(testCandidate2.id);
      expect(body.data.relationsPreserved).toBeDefined();
    });

    it('2. POST /api/sourcing/merges: rejects merge without explicit "MERGE" confirmation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/merges',
        headers: { cookie: recruiterCookie },
        payload: {
          masterCandidateId: testCandidate1.id,
          secondaryCandidateId: testCandidate2.id,
          fieldsRetained: { currentTitle: 'SECONDARY' },
          mergeReason: 'Duplicate profile created via job board',
          confirmation: 'yes', // NOT "MERGE"
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3. POST /api/sourcing/merges: executes non-destructive merge and archives secondary record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/merges',
        headers: { cookie: recruiterCookie },
        payload: {
          masterCandidateId: testCandidate1.id,
          secondaryCandidateId: testCandidate2.id,
          fieldsRetained: {
            currentTitle: 'SECONDARY',
          },
          mergeReason: 'Candidate uploaded duplicate resume with new title',
          confirmation: 'MERGE',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.updatedMaster.currentTitle).toBe(testCandidate2.currentTitle);

      // Verify secondary candidate is archived and linked to master
      const secondaryInDb = await prisma.candidate.findUnique({
        where: { id: testCandidate2.id },
      });
      expect(secondaryInDb?.isArchived).toBe(true);
      expect(secondaryInDb?.isMerged).toBe(true);
      expect(secondaryInDb?.mergedIntoCandidateId).toBe(testCandidate1.id);
      expect(secondaryInDb?.archiveReason).toContain('Merged into');
    });
  });

  // --------------------------------------------------------------------------
  // D. Sourcing Workspace Queue (Frame 20)
  // --------------------------------------------------------------------------
  describe('Sourcing Workspace Queue', () => {
    let sourcingItemId: string;

    it('1. GET /api/sourcing/queue: lists incoming sourcing items', async () => {
      // Create a manual sourcing item
      const item = await prisma.sourcingItem.create({
        data: {
          organizationId: adminUser.organizationId,
          source: 'MANUAL_UPLOAD',
          candidateName: 'Tanvi Nair',
          email: `tanvi.nair.${Date.now()}@example.com`,
          phone: '+91 96666 44444',
          currentTitle: 'Data Engineer',
          currentCompany: 'Flipkart',
          skills: ['Python', 'Spark', 'SQL'],
          status: 'PENDING_REVIEW',
        },
      });
      sourcingItemId = item.id;
      cleanupSourcingItemIds.push(item.id);

      const res = await app.inject({
        method: 'GET',
        url: '/api/sourcing/queue',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.some((i: any) => i.id === sourcingItemId)).toBe(true);
    });

    it('2. POST /api/sourcing/queue/:id/approve: explicitly approves sourcing item to Candidate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sourcing/queue/${sourcingItemId}/approve`,
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Tanvi Nair');
      cleanupCandidateIds.push(body.data.id);

      const updatedItem = await prisma.sourcingItem.findUnique({ where: { id: sourcingItemId } });
      expect(updatedItem?.status).toBe('APPROVED');
    });
  });

  // --------------------------------------------------------------------------
  // E. Chrome Extension API (Manifest V3)
  // --------------------------------------------------------------------------
  describe('Chrome Extension Capture & Token Auth', () => {
    let rawToken: string;

    it('1. POST /api/sourcing/extension/token: issues 15-minute capture token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/extension/token',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.captureToken.startsWith('hfe_')).toBe(true);
      expect(body.data.expiresAt).toBeDefined();

      rawToken = body.data.captureToken;
    });

    it('2. POST /api/sourcing/extension/capture: ingests candidate into SourcingItem (does not create Candidate)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/extension/capture',
        headers: {
          Authorization: `Bearer ${rawToken}`,
        },
        payload: {
          name: 'Naveen Kumar',
          email: `naveen.kumar.${Date.now()}@example.com`,
          phone: '+91 95555 33333',
          currentTitle: 'DevOps Specialist',
          currentCompany: 'Paytm',
          location: 'Noida',
          skills: ['Kubernetes', 'Terraform', 'AWS'],
          sourcePlatform: 'LINKEDIN',
          profileUrl: 'https://linkedin.com/in/naveen-kumar-mock',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.source).toBe('CHROME_EXTENSION');
      expect(body.data.status).toBe('PENDING_REVIEW');
      cleanupSourcingItemIds.push(body.data.id);

      // Verify NO Candidate was automatically created
      const candCheck = await prisma.candidate.findFirst({
        where: { email: body.data.email },
      });
      expect(candCheck).toBeNull();
    });

    it('3. POST /api/sourcing/extension/capture: rejects invalid or forged tokens with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/extension/capture',
        headers: {
          Authorization: 'Bearer hfe_forged_invalid_token',
        },
        payload: {
          name: 'Hacker Attempt',
          email: 'hacker@example.com',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVALID_EXTENSION_TOKEN');
    });
  });

  // --------------------------------------------------------------------------
  // F. Sourcing Integrations (Naukri, Foundit, Inbound Email)
  // --------------------------------------------------------------------------
  describe('Sourcing Integrations Framework', () => {
    it('1. GET /api/sourcing/integrations: returns provider health reports', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sourcing/integrations',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.data.map((p: any) => p.provider)).toContain('NAUKRI');
      expect(body.data.map((p: any) => p.provider)).toContain('FOUNDIT');
      expect(body.data.map((p: any) => p.provider)).toContain('INBOUND_EMAIL');
    });

    it('2. POST /api/sourcing/integrations/:provider/connect: connects Naukri in sandbox mode', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sourcing/integrations/NAUKRI/connect',
        headers: { cookie: adminCookie },
        payload: {
          credentials: {
            apiKey: 'demo_naukri_api_key_valid_123',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('CONNECTED');
    });
  });
});
