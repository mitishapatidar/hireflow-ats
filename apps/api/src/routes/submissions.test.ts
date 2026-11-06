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

describe('Client Submissions & Standard Profile API Integration Tests (Prompt 13)', { timeout: 30000 }, () => {
  let app: any;
  let adminCookie: string;
  let managerCookie: string;
  let recruiterCookie: string;
  let candidateCookie: string;
  let clientCookie: string;
  let createdSessionTokens: string[] = [];

  let testSubmissionId: string;
  let testJobId: string;
  let testClientId: string;
  let testClientContactId: string;
  let testApplicationId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    const managerUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.MANAGER },
    });

    const recruiterUser = await prisma.user.findFirstOrThrow({
      where: { id: 'user-mitisha-patidar' },
    });

    const candidateUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CANDIDATE },
    });

    const clientUser = await prisma.user.findFirstOrThrow({
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

    // Locate seeded submission S-241 or create one for test
    const existingSub = await prisma.submission.findFirst({
      where: { code: 'S-241' },
      include: {
        application: {
          include: {
            job: {
              include: {
                client: {
                  include: { contacts: true },
                },
              },
            },
          },
        },
      },
    });

    if (existingSub) {
      testSubmissionId = existingSub.id;
      testJobId = existingSub.application.job.id;
      testClientId = existingSub.application.job.clientId;
      testApplicationId = existingSub.applicationId;
      testClientContactId = existingSub.application.job.client.contacts[0]?.id || '';

      // Ensure profile version 1 exists for existingSub
      await prisma.submissionProfileVersion.upsert({
        where: {
          submissionId_versionNumber: {
            submissionId: existingSub.id,
            versionNumber: 1,
          },
        },
        update: {},
        create: {
          submissionId: existingSub.id,
          versionNumber: 1,
          versionTag: 'S-241-v1',
          headline: 'Staff Frontend Architect',
          summary: 'Experienced micro-frontend architect.',
          selectedSkills: ['TypeScript', 'React', 'Next.js'],
          contentSnapshot: {
            versionTag: 'S-241-v1',
            versionNumber: 1,
            candidateName: 'Aarav Shah',
            candidateCode: 'C-0001',
            clientName: 'Aureva Capital',
            coreSkills: ['TypeScript', 'React', 'Next.js'],
            experienceHighlights: [],
            educationHighlights: [],
            generatedDate: '2026-11-06',
          },
          contentHash: 'hash-initial-v1-aarav',
          createdById: recruiterUser.id,
        },
      });
    } else {
      // Find an application
      const appRecord = await prisma.application.findFirstOrThrow({
        include: {
          job: {
            include: {
              client: { include: { contacts: true } },
            },
          },
        },
      });
      testJobId = appRecord.job.id;
      testClientId = appRecord.job.clientId;
      testApplicationId = appRecord.id;
      testClientContactId = appRecord.job.client.contacts[0]?.id || '';

      const created = await prisma.submission.create({
        data: {
          code: 'S-241',
          applicationId: appRecord.id,
          version: 1,
          approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
          matchScore: 88,
          createdById: recruiterUser.id,
        },
      });
      testSubmissionId = created.id;

      await prisma.submissionProfileVersion.create({
        data: {
          submissionId: created.id,
          versionNumber: 1,
          versionTag: 'S-241-v1',
          headline: 'Senior Full Stack Engineer',
          summary: 'Expert developer with extensive experience.',
          selectedSkills: ['TypeScript', 'React'],
          contentSnapshot: {
            versionTag: 'S-241-v1',
            versionNumber: 1,
            candidateName: 'Test Candidate',
            candidateCode: 'C-0001',
            clientName: 'Aureva Capital',
            coreSkills: ['TypeScript', 'React'],
            experienceHighlights: [],
            educationHighlights: [],
            generatedDate: '2026-11-06',
          },
          contentHash: 'hash-initial-test-v1',
          createdById: recruiterUser.id,
        },
      });
    }

    // Ensure client contact exists
    if (!testClientContactId) {
      const contact = await prisma.clientContact.create({
        data: {
          clientId: testClientId,
          name: 'Vikram Malhotra',
          email: 'vikram.m@aurevacapital.com',
          designation: 'Managing Director',
        },
      });
      testClientContactId = contact.id;
    }
  });

  afterAll(async () => {
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }
    await app.close();
  });

  // 1. GET /api/submissions
  it('1. GET /api/submissions returns paginated list and live counts for recruiter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/submissions?page=1&limit=10',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.stats).toBeDefined();
    expect(body.stats.all).toBeGreaterThanOrEqual(1);
  });

  // 2. Role restriction on /api/submissions
  it('2. GET /api/submissions strictly rejects CANDIDATE and CLIENT with 403 Forbidden', async () => {
    const resCandidate = await app.inject({
      method: 'GET',
      url: '/api/submissions',
      headers: { cookie: candidateCookie },
    });
    expect(resCandidate.statusCode).toBe(403);

    const resClient = await app.inject({
      method: 'GET',
      url: '/api/submissions',
      headers: { cookie: clientCookie },
    });
    expect(resClient.statusCode).toBe(403);
  });

  // 3. GET /api/submissions/:id
  it('3. GET /api/submissions/:id returns full submission detail and candidate metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${testSubmissionId}`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(testSubmissionId);
    expect(body.data.candidate).toBeDefined();
    expect(body.data.job).toBeDefined();
  });

  // 4. GET /api/submissions/:id/match
  it('4. GET /api/submissions/:id/match returns deterministic breakdown and explanations without LLM', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${testSubmissionId}/match`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.overallScore).toBeGreaterThanOrEqual(0);
    expect(body.data.overallScore).toBeLessThanOrEqual(100);
    expect(body.data.algorithmVersion).toBe('1.0.0');
    expect(body.data.breakdown.skills).toBeDefined();
    expect(body.data.breakdown.experience).toBeDefined();
    expect(body.data.breakdown.location).toBeDefined();
    expect(body.data.breakdown.salary).toBeDefined();
    expect(Array.isArray(body.data.explanation)).toBe(true);
  });

  // 5. GET /api/submissions/:id/profile (Anti-Leak Guarantee)
  it('5. GET /api/submissions/:id/profile returns client-facing DTO and strictly excludes confidential fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${testSubmissionId}/profile`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    const profile = body.data;

    // Allowed fields present
    expect(profile.candidateName).toBeDefined();
    expect(profile.clientName).toBeDefined();
    expect(profile.versionTag).toBeDefined();
    expect(Array.isArray(profile.coreSkills)).toBe(true);

    // CRITICAL ANTI-LEAK: Private fields must NOT exist
    expect(profile.internalCandidateNotes).toBeUndefined();
    expect(profile.confidentialRecruiterNotes).toBeUndefined();
    expect(profile.candidateCurrentSalary).toBeUndefined();
    expect(profile.candidateExpectedSalary).toBeUndefined();
    expect(profile.recruiterCommission).toBeUndefined();
    expect(profile.clientCommercialTerms).toBeUndefined();
    expect(profile.placementFee).toBeUndefined();
    expect(profile.internalMarginCalculation).toBeUndefined();
  });

  // 6. POST /api/submissions/:id/profile/versions (Create v2 & Invalidate Approval)
  it('6. POST /api/submissions/:id/profile/versions creates v2 and marks previous approval invalidated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/submissions/${testSubmissionId}/profile/versions`,
      headers: { cookie: recruiterCookie },
      payload: {
        headline: 'Lead Architect — FinTech Scale',
        summary: 'Updated profile summary highlighting distributed ledger and cloud migrations.',
        selectedSkills: ['TypeScript', 'React', 'AWS', 'System Design'],
        changeSummary: 'Tailored candidate strengths to Aureva Capital architecture needs.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.versionNumber).toBeGreaterThanOrEqual(2);
    expect(body.data.versionTag).toContain('-v');
    expect(body.data.approvalStatus).toBe(SubmissionApprovalStatus.APPROVAL_INVALIDATED);
    expect(body.data.contentHash).toBeDefined();
  });

  // 7. GET /api/submissions/:id/profile/versions
  it('7. GET /api/submissions/:id/profile/versions returns complete immutable version history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${testSubmissionId}/profile/versions`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.data[0].versionNumber).toBeGreaterThan(body.data[1].versionNumber);
  });

  // 8. GET /api/submissions/:id/profile/preview
  it('8. GET /api/submissions/:id/profile/preview returns sanitized HTML matching Frame 29 layout', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${testSubmissionId}/profile/preview`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.payload).toContain('<!DOCTYPE html>');
    expect(res.payload).toContain('CONFIDENTIAL PROFILE');
  });

  // 9. GET /api/submissions/:id/cv/preview
  it('9. GET /api/submissions/:id/cv/preview returns watermarked CV preview with client name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${testSubmissionId}/cv/preview`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.watermarkText).toContain('HIREFLOW /');
  });

  // 10. POST /api/submissions/:id/approval/request
  it('10. POST /api/submissions/:id/approval/request moves status to PENDING_MANAGER_APPROVAL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/submissions/${testSubmissionId}/approval/request`,
      headers: { cookie: recruiterCookie },
      payload: { comments: 'Ready for manager review against Aureva requirements.' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.approvalStatus).toBe(SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL);
  });

  // 11. POST /api/submissions/:id/approval/review (Manager only)
  it('11. POST /api/submissions/:id/approval/review allows MANAGER to approve, while regular RECRUITER gets 403', async () => {
    // Recruiter tries to approve own submission -> 403
    const resRecruiter = await app.inject({
      method: 'POST',
      url: `/api/submissions/${testSubmissionId}/approval/review`,
      headers: { cookie: recruiterCookie },
      payload: { decision: 'APPROVED', comments: 'Self-approval attempt' },
    });
    expect(resRecruiter.statusCode).toBe(403);

    // Manager approves -> 200
    const resManager = await app.inject({
      method: 'POST',
      url: `/api/submissions/${testSubmissionId}/approval/review`,
      headers: { cookie: managerCookie },
      payload: { decision: 'APPROVED', comments: 'Profile verified and compliant with MSA.' },
    });
    expect(resManager.statusCode).toBe(200);
    const body = JSON.parse(resManager.payload);
    expect(body.success).toBe(true);
    expect(body.data.approvalStatus).toBe(SubmissionApprovalStatus.APPROVED);
  });

  // 12. POST /api/submissions/:id/send (Blocks when Job is PAUSED / CLOSED)
  it('12. POST /api/submissions/:id/send strictly blocks sending with 409 Conflict when job is PAUSED', async () => {
    // Temporarily set job to PAUSED
    await prisma.job.update({
      where: { id: testJobId },
      data: { status: JobStatus.PAUSED },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/submissions/${testSubmissionId}/send`,
      headers: { cookie: recruiterCookie },
      payload: {
        recipientContactId: testClientContactId,
        emailSubject: 'Candidate Presentation: Aarav Shah',
        coverNote: 'Please review candidate profile.',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Job mandate');
    expect(body.error).toContain('PAUSED');

    // Restore job to ACTIVE
    await prisma.job.update({
      where: { id: testJobId },
      data: { status: JobStatus.ACTIVE },
    });
  });

  // 13. POST /api/submissions/:id/send (Succeeds when job is ACTIVE and approved)
  it('13. POST /api/submissions/:id/send delivers submission when job is ACTIVE and approved', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/submissions/${testSubmissionId}/send`,
      headers: { cookie: recruiterCookie },
      payload: {
        recipientContactId: testClientContactId,
        emailSubject: 'Candidate Presentation: Aarav Shah for Staff Architect',
        coverNote: 'Dear Vikram, please find attached the candidate standard profile and watermarked CV.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.sentAt).toBeDefined();
    expect(body.data.recipient.email).toContain('@');
    expect(body.data.providerStatus).toBe('DEMO_MOCK_DISPATCHED');
  });

  // 14. GET /api/submissions/:id/history
  it('14. GET /api/submissions/:id/history returns audit trail of all lifecycle events', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${testSubmissionId}/history`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });
});
