/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import { UserRole, generateSecureToken, hashToken } from '@hireflow/shared';

describe('Client Portal API & Anti-Leak Isolation (Prompt 22)', () => {
  let server: FastifyInstance;

  // Test Entities
  let orgA: any;
  let clientA: any;
  let clientB: any;
  let clientUserA: any;
  let clientUserB: any;
  let recruiterUser: any;

  let sessionTokenClientA: string;
  let sessionTokenClientB: string;
  let sessionTokenRecruiter: string;

  let jobA: any;
  let jobB: any;
  let candidateA: any;
  let appA: any;
  let submissionAApproved: any;
  let submissionAPending: any;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // 1. Organization
    orgA = await prisma.organization.upsert({
      where: { id: 'org-aureva-1' },
      update: {},
      create: {
        id: 'org-aureva-1',
        name: 'Aureva Capital Private Limited',
        domain: 'aurevacapital.com',
        slug: 'aureva-capital',
      },
    });

    // 2. Clients
    clientA = await prisma.client.create({
      data: {
        code: `CLI-APEX-${Date.now().toString().slice(-4)}`,
        legalName: 'Apex Financial Technologies Ltd',
        organizationId: orgA.id,
      },
    });

    clientB = await prisma.client.create({
      data: {
        code: `CLI-ZENITH-${Date.now().toString().slice(-4)}`,
        legalName: 'Zenith Retail Systems Inc',
        organizationId: orgA.id,
      },
    });

    // 3. Client Users
    clientUserA = await prisma.user.create({
      data: {
        email: `apex.contact.${Date.now()}@apexfin.com`,
        name: 'Suresh Apex',
        role: UserRole.CLIENT,
        status: 'ACTIVE',
        organizationId: orgA.id,
      },
    });

    await prisma.clientAccess.create({
      data: {
        userId: clientUserA.id,
        clientId: clientA.id,
        authorizedJobIds: [],
        status: 'ACTIVE',
      },
    });

    clientUserB = await prisma.user.create({
      data: {
        email: `zenith.contact.${Date.now()}@zenith.com`,
        name: 'Anita Zenith',
        role: UserRole.CLIENT,
        status: 'ACTIVE',
        organizationId: orgA.id,
      },
    });

    await prisma.clientAccess.create({
      data: {
        userId: clientUserB.id,
        clientId: clientB.id,
        authorizedJobIds: [],
        status: 'ACTIVE',
      },
    });

    recruiterUser = await prisma.user.create({
      data: {
        email: `recruiter.p22.${Date.now()}@aurevacapital.com`,
        name: 'Rohan Recruiter',
        role: UserRole.RECRUITER,
        status: 'ACTIVE',
        organizationId: orgA.id,
      },
    });

    // 4. Create Sessions
    sessionTokenClientA = generateSecureToken(32);
    await prisma.session.create({
      data: {
        userId: clientUserA.id,
        tokenHash: hashToken(sessionTokenClientA),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    sessionTokenClientB = generateSecureToken(32);
    await prisma.session.create({
      data: {
        userId: clientUserB.id,
        tokenHash: hashToken(sessionTokenClientB),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    sessionTokenRecruiter = generateSecureToken(32);
    await prisma.session.create({
      data: {
        userId: recruiterUser.id,
        tokenHash: hashToken(sessionTokenRecruiter),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 5. Jobs
    jobA = await prisma.job.create({
      data: {
        code: `J-APEX-${Date.now().toString().slice(-4)}`,
        title: 'Lead Quantitative Developer',
        clientId: clientA.id,
        organizationId: orgA.id,
        status: 'ACTIVE',
        location: 'Mumbai / Hybrid',
        openings: 2,
        requiredSkills: ['C++', 'Python', 'Trading Systems'],
        description: 'Design low-latency algorithmic trading infrastructure.',
      },
    });

    jobB = await prisma.job.create({
      data: {
        code: `J-ZENITH-${Date.now().toString().slice(-4)}`,
        title: 'Supply Chain Architect',
        clientId: clientB.id,
        organizationId: orgA.id,
        status: 'ACTIVE',
        location: 'Bengaluru',
        openings: 1,
        requiredSkills: ['SAP', 'Kafka'],
        description: 'Confidential supply chain modernization.',
      },
    });

    // 6. Candidate & Submissions for Job A
    candidateA = await prisma.candidate.create({
      data: {
        code: `CAN-P22-${Date.now().toString().slice(-4)}`,
        name: 'Vikram Joshi',
        email: `vikram.${Date.now()}@example.com`,
        organizationId: orgA.id,
        currentTitle: 'Senior C++ Developer',
        currentCompany: 'FinTech Innovations',
        experienceYears: 7,
        skills: ['C++', 'Python', 'Linux', 'ZeroMQ'],
      },
    });

    appA = await prisma.application.create({
      data: {
        candidateId: candidateA.id,
        jobId: jobA.id,
      },
    });

    // Approved & Sent Submission
    submissionAApproved = await prisma.submission.create({
      data: {
        code: `SUB-P22-A-${Date.now().toString().slice(-4)}`,
        applicationId: appA.id,
        version: 1,
        approvalStatus: 'APPROVED',
        sendState: 'SENT',
        sentAt: new Date(),
        matchScore: 92,
      },
    });

    await prisma.submissionProfileVersion.create({
      data: {
        submissionId: submissionAApproved.id,
        versionNumber: 1,
        versionTag: `${submissionAApproved.code}-v1`,
        headline: 'Senior C++ Quantitative Developer with 7 years experience',
        summary: 'Experienced in developing ultra-low-latency financial components.',
        selectedSkills: ['C++', 'Python', 'Linux'],
        contentSnapshot: {
          versionTag: `${submissionAApproved.code}-v1`,
          versionNumber: 1,
          candidateName: candidateA.name,
          candidateCode: candidateA.code,
          currentTitle: candidateA.currentTitle,
          currentCompany: candidateA.currentCompany,
          summary: 'Experienced in developing ultra-low-latency financial components.',
          selectedSkills: ['C++', 'Python', 'Linux'],
          clientName: clientA.legalName,
        },
        contentHash: 'hash-test-p22',
        isCurrent: true,
        createdById: recruiterUser.id,
      },
    });

    // Unapproved Submission (Pending Manager Approval)
    submissionAPending = await prisma.submission.create({
      data: {
        code: `SUB-P22-PENDING-${Date.now().toString().slice(-4)}`,
        applicationId: appA.id,
        version: 1,
        approvalStatus: 'PENDING_MANAGER_APPROVAL',
        sendState: 'NOT_SENT',
        matchScore: 78,
      },
    });
  });

  afterAll(async () => {
    if (server) await server.close();
  });

  // -------------------------------------------------------------------------
  // 1. Authentication & Role Protection
  // -------------------------------------------------------------------------
  it('rejects unauthenticated requests with 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/client-portal/overview',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects internal recruiter from accessing client portal with 403', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/client-portal/overview',
      headers: {
        authorization: `Bearer ${sessionTokenRecruiter}`,
      },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    const msg = body.error?.message || body.message;
    expect(msg).toContain('restricted to authorized client users');
  });

  // -------------------------------------------------------------------------
  // 2. Client Overview (Frame 12)
  // -------------------------------------------------------------------------
  it('returns overview with accurate metrics and client legal name for Client A', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/client-portal/overview',
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.clientLegalName).toBe(clientA.legalName);
    expect(body.data.clientContactName).toBe(clientUserA.name);
    expect(body.data.metrics.openPositions).toBeGreaterThanOrEqual(1);
    expect(body.data.metrics.profilesSubmitted).toBeGreaterThanOrEqual(1);

    // Verify recentSubmissions does NOT include unapproved submissions
    const subCodes = body.data.recentSubmissions.map((s: any) => s.code);
    expect(subCodes).toContain(submissionAApproved.code);
    expect(subCodes).not.toContain(submissionAPending.code);
  });

  // -------------------------------------------------------------------------
  // 3. Client A vs Client B Isolation & Anti-Leak Contracts
  // -------------------------------------------------------------------------
  it('Client A cannot view Client B open positions', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/client-portal/positions/${jobB.id}`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
    });
    // Should return 404 because jobB does not belong to clientA
    expect(res.statusCode).toBe(404);
  });

  it('Client B cannot view Client A submission or standard profile', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/client-portal/submissions/${submissionAApproved.id}`,
      headers: {
        authorization: `Bearer ${sessionTokenClientB}`,
      },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    const msg = body.error?.message || body.message;
    expect(msg).toContain('does not belong to your organization');
  });

  // -------------------------------------------------------------------------
  // 4. Candidate Standard Profile & CV Watermarking (Frame 29)
  // -------------------------------------------------------------------------
  it('returns sanitized standard profile for Client A without internal notes', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/client-portal/submissions/${submissionAApproved.id}`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.profile.candidateName).toBe(candidateA.name);
    expect(body.data.cv.watermarkPreview).toContain('APEX FINANCIAL TECHNOLOGIES LTD');

    // Anti-Leak Check: Verify no confidential recruiter/agency fields in response
    const rawJson = res.body;
    expect(rawJson).not.toContain('internalNotes');
    expect(rawJson).not.toContain('salaryNotes');
    expect(rawJson).not.toContain('feeBasis');
    expect(rawJson).not.toContain('feeAmount');
    expect(rawJson).not.toContain('margin');
    expect(rawJson).not.toContain('passwordHash');
    expect(rawJson).not.toContain('twoFactorSecret');
  });

  it('generates watermarked CV download and logs DownloadLog', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/client-portal/submissions/${submissionAApproved.id}/cv/download`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.watermarkApplied).toBe(true);
    expect(body.data.watermarkText).toContain('APEX FINANCIAL TECHNOLOGIES LTD');

    // Verify atomic DownloadLog entry
    const log = await prisma.downloadLog.findFirst({
      where: {
        userId: clientUserA.id,
        resourceType: 'CV',
        resourceId: submissionAApproved.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    expect(log?.result).toBe('SUCCESS');
    expect(log?.watermarkText).toContain('APEX FINANCIAL TECHNOLOGIES LTD');
  });

  // -------------------------------------------------------------------------
  // 5. Client Decision Actions: Shortlist, Reject & Need Details
  // -------------------------------------------------------------------------
  it('allows client to shortlist candidate and logs audit', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/client-portal/submissions/${submissionAApproved.id}/shortlist`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
      payload: {
        comments: 'Strong C++ background. Please schedule an introductory call.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.clientDecision).toBe('SHORTLISTED');

    // Verify submission state in DB
    const sub = await prisma.submission.findUnique({
      where: { id: submissionAApproved.id },
    });
    expect(sub?.clientDecision).toBe('SHORTLISTED');
    expect(sub?.sendState).toBe('CLIENT_REVIEWED');
  });

  it('rejects client rejection without mandatory reason', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/client-portal/submissions/${submissionAApproved.id}/reject`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
      payload: {
        reason: 'No', // Too short (minimum 5 chars)
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('records client rejection with valid reason and feedback', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/client-portal/submissions/${submissionAApproved.id}/reject`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
      payload: {
        reason: 'Experience does not meet our minimum 8-year requirement for this role.',
        feedback: 'Keep profile on file for mid-level opportunities.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.clientDecision).toBe('REJECTED');
    expect(body.data.clientDecisionReason).toContain('does not meet our minimum 8-year requirement');

    const sub = await prisma.submission.findUnique({
      where: { id: submissionAApproved.id },
    });
    expect(sub?.clientDecision).toBe('REJECTED');
    expect((sub as any)?.clientDecisionReason).toContain('minimum 8-year requirement');
  });

  it('allows client to request additional details', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/client-portal/submissions/${submissionAApproved.id}/request-details`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
      payload: {
        informationRequired: 'Please clarify current notice period and willingness to relocate to Mumbai.',
        priority: 'HIGH',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.clientDecision).toBe('NEED_DETAILS');
  });

  it('allows client to submit recruitment-team feedback', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/client-portal/submissions/${submissionAApproved.id}/feedback`,
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
      payload: {
        category: 'SUITABILITY',
        content: 'Candidate seems well suited for our core latency team. Please prepare them for modern C++20 questions.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('will not be sent to the candidate');
  });

  // -------------------------------------------------------------------------
  // 6. Progress Reports
  // -------------------------------------------------------------------------
  it('returns client hiring progress report with job-level breakdown', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/client-portal/reports',
      headers: {
        authorization: `Bearer ${sessionTokenClientA}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.summary.openPositions).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.data.jobProgress)).toBe(true);

    // Assert zero internal recruiter stats leaked
    const jsonStr = res.body;
    expect(jsonStr).not.toContain('recruiterLeaderboard');
    expect(jsonStr).not.toContain('placementFee');
    expect(jsonStr).not.toContain('margin');
  });
});
