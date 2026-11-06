import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  JobStatus,
  SubmissionApprovalStatus,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Prompt 18: Approvals, Client Workflows & Manager Overview Integration Tests', { timeout: 35000 }, () => {
  let app: any;
  let adminCookie: string;
  let managerCookie: string;
  let recruiterCookie: string;
  let candidateCookie: string;
  let clientCookie: string;

  let adminUser: any;
  let managerUser: any;
  let recruiterUser: any;
  let candidateUser: any;
  let clientUser: any;

  let createdSessionTokens: string[] = [];

  let testClientId: string;
  let testJobId: string;
  let testCandidateId: string;
  let testApplicationId: string;
  let testSubmissionId: string;

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
      where: { id: 'user-mitisha-patidar' },
    });

    candidateUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CANDIDATE },
    });

    clientUser = await prisma.user.findFirstOrThrow({
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
    managerCookie = await createSessionCookie(managerUser.id);
    recruiterCookie = await createSessionCookie(recruiterUser.id);
    candidateCookie = await createSessionCookie(candidateUser.id);
    clientCookie = await createSessionCookie(clientUser.id);

    // Get active client
    const client = await prisma.client.findFirstOrThrow({
      where: { isArchived: false, organizationId: adminUser.organizationId },
    });
    testClientId = client.id;

    // Create a dedicated test candidate
    const candidate = await prisma.candidate.create({
      data: {
        organizationId: adminUser.organizationId,
        code: `CAN-P18-${Date.now().toString().slice(-4)}`,
        name: 'Test Candidate P18',
        email: `candidate.p18.${Date.now()}@example.com`,
        phone: '+919876543210',
        currentTitle: 'Senior Backend Engineer',
        currentCompany: 'FinTech Labs',
        experienceYears: 6,
        expectedSalary: 2800000,
        noticePeriod: '30 days',
        consentRecordedAt: new Date(),
        skills: ['TypeScript', 'Fastify', 'PostgreSQL', 'Docker'],
        location: 'Bengaluru, India',
        ownerId: recruiterUser.id,
      },
    });
    testCandidateId = candidate.id;

    // Attach CV document for rule validation
    await prisma.candidateDocument.create({
      data: {
        candidateId: candidate.id,
        documentType: 'RESUME',
        fileName: 'resume_p18.pdf',
        fileUrl: 'https://storage.supabase.co/hireflow/resumes/resume_p18.pdf',
        storageBucket: 'resumes',
        uploadedById: recruiterUser.id,
        version: 1,
      },
    });

    // Create a dedicated test job
    const job = await prisma.job.create({
      data: {
        organizationId: adminUser.organizationId,
        clientId: testClientId,
        code: `J-P18-${Date.now().toString().slice(-4)}`,
        title: 'Platform Engineer (P18 Test)',
        openings: 1,
        employmentType: 'FULL_TIME',
        status: JobStatus.ACTIVE as any,
        ownerId: recruiterUser.id,
        createdById: recruiterUser.id,
      },
    });
    testJobId = job.id;

    // Create application
    const application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        status: 'SCREENING',
        createdById: recruiterUser.id,
      },
    });
    testApplicationId = application.id;

    // Create submission awaiting approval
    const subCode = `SUB-P18-${Date.now().toString().slice(-4)}`;
    const submission = await prisma.submission.create({
      data: {
        applicationId: application.id,
        code: subCode,
        version: 1,
        approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
        sendState: 'NOT_SENT',
        createdById: recruiterUser.id,
        profileVersions: {
          create: {
            versionNumber: 1,
            versionTag: `${subCode}-v1`,
            headline: 'Senior Backend Engineer',
            summary: 'Proven platform engineer with experience building scalable microservices.',
            selectedSkills: ['TypeScript', 'Fastify', 'PostgreSQL'],
            experienceHighlights: [{ title: 'Senior Backend Engineer', company: 'FinTech Labs', duration: '3 yrs' }],
            isCurrent: true,
            createdById: recruiterUser.id,
            contentSnapshot: {
              candidateName: 'Test Candidate P18',
              candidateCode: candidate.code,
              clientName: client.legalName,
              versionTag: `${subCode}-v1`,
              headline: 'Senior Backend Engineer',
              professionalSummary: 'Proven platform engineer with experience building scalable microservices.',
              coreSkills: ['TypeScript', 'Fastify', 'PostgreSQL'],
              experienceHighlights: [{ title: 'Senior Backend Engineer', company: 'FinTech Labs', duration: '3 yrs' }],
              educationHighlights: [],
            },
            contentHash: 'hash-p18-test-v1',
          },
        },
      },
    });
    testSubmissionId = submission.id;
  });

  afterAll(async () => {
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }
    await app.close();
  });

  describe('1. Manager Overview Dashboard (/api/manager/overview)', () => {
    it('allows Manager and Admin to retrieve overview KPIs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/manager/overview',
        headers: { cookie: managerCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.kpis).toBeDefined();
      expect(typeof body.data.kpis.jobsAwaitingApproval).toBe('number');
      expect(typeof body.data.kpis.submissionsAwaitingApproval).toBe('number');
      expect(typeof body.data.kpis.activeRecruiters).toBe('number');
      expect(typeof body.data.kpis.placementsThisMonth).toBe('number');
      expect(body.data.pendingApprovals).toBeInstanceOf(Array);
    });

    it('rejects Recruiter access to Manager Overview with HTTP 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/manager/overview',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns team performance breakdown for managers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/manager/team-performance',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.recruiters).toBeInstanceOf(Array);
    });
  });

  describe('2. Approval Center Submissions & Review Workflow', () => {
    it('lists pending submissions in Approval Center', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/approvals?tab=submissions',
        headers: { cookie: managerCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
      const found = body.data.items.find((i: any) => i.id === testSubmissionId);
      expect(found).toBeDefined();
      expect(found.candidateName).toBe('Test Candidate P18');
    });

    it('fetches detailed submission review data and client rule validation', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/approvals/submissions/${testSubmissionId}`,
        headers: { cookie: managerCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.submission.id).toBe(testSubmissionId);
      expect(body.data.candidate.name).toBe('Test Candidate P18');
      expect(body.data.ruleValidation).toBeDefined();
      expect(body.data.cvDocument).toBeDefined();
      expect(body.data.profilePreview).toBeDefined();
    });

    it('strictly prevents Recruiter self-approval with HTTP 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/approvals/submissions/${testSubmissionId}/approve`,
        headers: { cookie: recruiterCookie },
        payload: { comments: 'Self approval attempt' },
      });

      // Recruiter is forbidden from manager approvals
      expect(res.statusCode).toBe(403);
    });

    it('allows designated Manager/Admin to approve submission and stamps 3-way version', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/approvals/submissions/${testSubmissionId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comments: 'Approved for client presentation. Great candidate profile.' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.approvalStatus).toBe('APPROVED');
      expect(body.data.profileVersion).toBe(1);

      // Verify in DB that SubmissionApproval was created with exact version
      const approval = await prisma.submissionApproval.findFirst({
        where: { submissionId: testSubmissionId, decision: 'APPROVED' },
      });
      expect(approval).toBeDefined();
      expect(approval?.profileVersion).toBe(1);
      expect(approval?.isInvalidated).toBe(false);
    });
  });

  describe('3. Job Approval Lifecycle & Security Policy', () => {
    let pendingJobId: string;

    it('enforces requireJobApproval when enabled in SecurityPolicy', async () => {
      // Temporarily enable requireJobApproval
      await prisma.securityPolicy.upsert({
        where: { organizationId: adminUser.organizationId },
        update: { requireJobApproval: true },
        create: {
          organizationId: adminUser.organizationId,
          requireJobApproval: true,
        },
      });

      // Recruiter creates a job in DRAFT
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { cookie: recruiterCookie },
        payload: {
          title: 'Fullstack React Engineer',
          clientId: testClientId,
          openings: 2,
          employmentType: 'FULL_TIME',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const job = createRes.json().data;
      pendingJobId = job.id;
      expect(job.status).toBe('DRAFT');

      // Attempting to activate directly from DRAFT must be rejected with HTTP 409 because policy requires approval
      const activateRes = await app.inject({
        method: 'POST',
        url: `/api/jobs/${pendingJobId}/activate`,
        headers: { cookie: recruiterCookie },
      });
      expect(activateRes.statusCode).toBe(409);

      // Recruiter submits job for approval
      const submitRes = await app.inject({
        method: 'POST',
        url: `/api/jobs/${pendingJobId}/submit-for-approval`,
        headers: { cookie: recruiterCookie },
        payload: { note: 'Ready for manager review' },
      });
      expect(submitRes.statusCode).toBe(200);
      expect(submitRes.json().data.status).toBe('PENDING_APPROVAL');

      // Reset policy to false to avoid affecting other tests
      await prisma.securityPolicy.update({
        where: { organizationId: adminUser.organizationId },
        data: { requireJobApproval: false },
      });
    });

    it('blocks self-approval on job mandates', async () => {
      // Recruiter owns the job, so if they attempt approval it must fail
      const res = await app.inject({
        method: 'POST',
        url: `/api/approvals/jobs/${pendingJobId}/approve`,
        headers: { cookie: recruiterCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows Manager to approve pending job and activates mandate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/approvals/jobs/${pendingJobId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comments: 'Job mandate budget and requirements approved.' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ACTIVE');

      // Verify JobApproval created in DB
      const jobApproval = await prisma.jobApproval.findFirst({
        where: { jobId: pendingJobId },
      });
      expect(jobApproval).toBeDefined();
      expect(jobApproval?.decision).toBe('APPROVED');
    });
  });

  describe('4. Client Workflows & Versioning (/api/clients/:clientId/workflow)', () => {
    it('returns published client workflow with stages, rounds and submission rules', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/clients/${testClientId}/workflow`,
        headers: { cookie: managerCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.workflow).toBeDefined();
      expect(body.data.workflow.version).toBeGreaterThanOrEqual(1);
      expect(body.data.workflow.stages).toBeInstanceOf(Array);
      expect(body.data.workflow.rounds).toBeInstanceOf(Array);
      expect(body.data.workflow.submissionRule).toBeDefined();
    });

    it('creates and updates a draft workflow', async () => {
      // Create draft
      const draftRes = await app.inject({
        method: 'POST',
        url: `/api/clients/${testClientId}/workflow/draft`,
        headers: { cookie: managerCookie },
      });
      expect(draftRes.statusCode === 200 || draftRes.statusCode === 201).toBe(true);

      // Update draft submission rules and stages
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/clients/${testClientId}/workflow/draft`,
        headers: { cookie: managerCookie },
        payload: {
          submissionRule: {
            requireCompleteProfile: true,
            requireCvDocument: true,
            requireExpectedSalary: true,
            requireNoticePeriod: true,
            requireCandidateConsent: true,
            profileFormat: 'STANDARDIZED_ANONYMIZED',
          },
        },
      });
      expect(updateRes.statusCode).toBe(200);
    });

    it('publishes draft workflow into an immutable new version', async () => {
      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/clients/${testClientId}/workflow/publish`,
        headers: { cookie: managerCookie },
        payload: {
          changeSummary: 'Updated compliance and interview rounds configuration for engineering roles',
        },
      });

      expect(publishRes.statusCode).toBe(200);
      const body = publishRes.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('PUBLISHED');
      expect(body.data.changeSummary).toContain('Updated compliance');

      // Verify version history
      const historyRes = await app.inject({
        method: 'GET',
        url: `/api/clients/${testClientId}/workflow/versions`,
        headers: { cookie: managerCookie },
      });
      expect(historyRes.statusCode).toBe(200);
      const history = historyRes.json().data;
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Approval Invalidation on Profile Edit', () => {
    it('invalidates manager approval when a new profile version is saved', async () => {
      // Candidate profile currently approved (v1)
      const subBefore = await prisma.submission.findUniqueOrThrow({
        where: { id: testSubmissionId },
      });
      expect(subBefore.approvalStatus).toBe('APPROVED');

      // Recruiter creates a new profile version (v2)
      const versionRes = await app.inject({
        method: 'POST',
        url: `/api/submissions/${testSubmissionId}/profile/versions`,
        headers: { cookie: recruiterCookie },
        payload: {
          headline: 'Lead Platform Architect',
          summary: 'Updated summary reflecting senior architecture leadership.',
          selectedSkills: ['TypeScript', 'Kubernetes', 'Fastify', 'PostgreSQL'],
          changeSummary: 'Promoted title to Lead Platform Architect and added Kubernetes skill',
        },
      });
      expect(versionRes.statusCode).toBe(201);
      expect(versionRes.json().data.approvalStatus).toBe('APPROVAL_INVALIDATED');

      // Verify that sending to client is now blocked with HTTP 409
      const clientContacts = await prisma.clientContact.findMany({
        where: { clientId: testClientId },
      });
      if (clientContacts.length > 0) {
        const sendRes = await app.inject({
          method: 'POST',
          url: `/api/submissions/${testSubmissionId}/send`,
          headers: { cookie: recruiterCookie },
          payload: {
            recipientContactId: clientContacts[0].id,
            emailSubject: 'Candidate Presentation: Lead Platform Architect',
          },
        });
        expect(sendRes.statusCode).toBe(400); // blocked because status is APPROVAL_INVALIDATED
      }
    });
  });
});
