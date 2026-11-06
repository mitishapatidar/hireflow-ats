/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  OpportunityStage,
  MeetingStatus,
  RecruiterActivityType,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Sales CRM, Recruiter Dashboard & Daily Activity API (Prompt 15)', { timeout: 35000 }, () => {
  let app: any;
  let adminCookie: string;
  let recruiterCookie: string;
  let candidateCookie: string;
  let clientCookie: string;
  let createdSessionTokens: string[] = [];

  let adminUserId: string;
  let recruiterUserId: string;
  let testOrgId: string;
  let testOpportunityId: string;
  let testMeetingId: string;
  let testJobId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });
    adminUserId = adminUser.id;
    testOrgId = adminUser.organizationId;

    const recruiterUser = await prisma.user.findFirstOrThrow({
      where: { id: 'user-mitisha-patidar' },
    });
    recruiterUserId = recruiterUser.id;

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
          tokenHash,
          userId,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
          ipAddress: '127.0.0.1',
          deviceInfo: 'vitest-test-agent',
        },
      });

      return `${SESSION_COOKIE_NAME}=${rawToken}`;
    }

    adminCookie = await createSessionCookie(adminUser.id);
    recruiterCookie = await createSessionCookie(recruiterUser.id);
    candidateCookie = await createSessionCookie(candidateUser.id);
    clientCookie = await createSessionCookie(clientUser.id);
  });

  afterAll(async () => {
    // Cleanup sessions
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }

    // Cleanup test records
    if (testJobId) {
      await prisma.job.deleteMany({ where: { id: testJobId } });
    }
    if (testMeetingId) {
      await prisma.meeting.deleteMany({ where: { id: testMeetingId } });
    }
    if (testOpportunityId) {
      await prisma.opportunityHistory.deleteMany({ where: { opportunityId: testOpportunityId } });
      await prisma.opportunity.deleteMany({ where: { id: testOpportunityId } });
    }
    await prisma.recruiterActivity.deleteMany({ where: { notes: { contains: 'Vitest Test Activity' } } });

    await app.close();
  });

  // =========================================================================
  // 1. Authorization & Role Security
  // =========================================================================
  describe('Strict Security & Permissions Guard', () => {
    it('rejects candidate access to sales CRM with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sales/opportunities',
        headers: { cookie: candidateCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects client portal access to recruiter dashboard with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dashboard/recruiter',
        headers: { cookie: clientCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects candidate access to daily activity with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/activity/daily',
        headers: { cookie: candidateCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 2. Sales CRM (Figma Frame 23)
  // =========================================================================
  describe('Sales CRM: Opportunities, Meetings & Conversion', () => {
    it('creates a new sales opportunity in PROSPECTING stage', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sales/opportunities',
        headers: { cookie: recruiterCookie },
        payload: {
          companyName: 'Apex Cloud Systems Ltd',
          title: 'Senior DevOps Mandate',
          estimatedValue: 1200000,
          contactName: 'Rohit Sharma',
          contactEmail: 'rohit@apexcloud.io',
          contactPhone: '+91 98765 43210',
          industry: 'Cloud Infrastructure',
          location: 'Bengaluru, India',
          estimatedOpenings: 3,
          priority: 'HIGH',
          notes: 'Series B cloud infra startup expanding devops team.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.opportunity.companyName).toBe('Apex Cloud Systems Ltd');
      expect(body.data.opportunity.stage).toBe('PROSPECTING');
      expect(body.data.opportunity.ownerId).toBe(recruiterUserId);
      testOpportunityId = body.data.opportunity.id;
    });

    it('lists opportunities filtered by stage', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sales/opportunities?stage=PROSPECTING',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.opportunities)).toBe(true);
      expect(body.data.stageSummaries.PROSPECTING.count).toBeGreaterThanOrEqual(1);
    });

    it('advances opportunity stage to MEETING, then PROPOSAL, then WON', async () => {
      // 1. Move to MEETING
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/sales/opportunities/${testOpportunityId}/stage`,
        headers: { cookie: recruiterCookie },
        payload: {
          stage: OpportunityStage.MEETING,
          reason: 'Introductory discovery call completed with VP Engineering.',
        },
      });
      expect(res1.statusCode).toBe(200);

      // 2. Move to PROPOSAL
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/sales/opportunities/${testOpportunityId}/stage`,
        headers: { cookie: recruiterCookie },
        payload: {
          stage: OpportunityStage.PROPOSAL,
          reason: 'Commercial rate card & NDA shared.',
        },
      });
      expect(res2.statusCode).toBe(200);

      // 3. Move to WON
      const res3 = await app.inject({
        method: 'POST',
        url: `/api/sales/opportunities/${testOpportunityId}/stage`,
        headers: { cookie: recruiterCookie },
        payload: {
          stage: OpportunityStage.WON,
          reason: 'Fee agreed at 15%, contract signed.',
        },
      });
      expect(res3.statusCode).toBe(200);
      const body3 = JSON.parse(res3.payload);
      expect(body3.data.opportunity.stage).toBe(OpportunityStage.WON);
    });

    it('schedules a client meeting with DEMO_MODE calendar sync', async () => {
      const meetingTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const res = await app.inject({
        method: 'POST',
        url: '/api/sales/meetings',
        headers: { cookie: recruiterCookie },
        payload: {
          opportunityId: testOpportunityId,
          title: 'Mandate Scoping & SLA Alignment',
          scheduledAt: meetingTime.toISOString(),
          durationMinutes: 45,
          contactName: 'Rohit Sharma',
          contactEmail: 'rohit@apexcloud.io',
          notes: 'Align on tech stack and interview panels',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.meeting.status).toBe(MeetingStatus.SCHEDULED);
      testMeetingId = body.data.meeting.id;
    });

    it('updates client meeting outcome and records next action', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/sales/meetings/${testMeetingId}/outcome`,
        headers: { cookie: recruiterCookie },
        payload: {
          status: MeetingStatus.COMPLETED,
          outcome: 'Client approved standard JD template and 3-stage interview process',
          nextAction: 'Create draft job mandate and begin sourcing',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.meeting.status).toBe(MeetingStatus.COMPLETED);
      expect(body.data.meeting.nextAction).toBe('Create draft job mandate and begin sourcing');
    });

    it('converts WON opportunity into an active Client and DRAFT Job', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sales/opportunities/${testOpportunityId}/convert`,
        headers: { cookie: recruiterCookie },
        payload: {
          contactName: 'Rohit Sharma',
          contactEmail: 'rohit@apexcloud.io',
          contactPhone: '+91 98765 43210',
          feePercentage: 15,
          paymentTerms: 'NET_30',
          jobTitle: 'Senior Site Reliability Engineer',
          recruiterOwnerId: recruiterUserId,
          openings: 2,
          location: 'Bengaluru, India',
          employmentType: 'FULL_TIME',
          description: 'Kubernetes, Terraform, AWS, Prometheus monitoring stack.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.job.status).toBe('DRAFT'); // MUST be DRAFT, never auto-activated
      expect(body.data.job.code).toMatch(/^J-\d+$/);
      expect(body.data.job.title).toBe('Senior Site Reliability Engineer');
      expect(body.data.opportunity.convertedJobId).toBe(body.data.job.id);
      testJobId = body.data.job.id;
    });
  });

  // =========================================================================
  // 3. Recruiter Dashboard (Figma Frame 01)
  // =========================================================================
  describe('Recruiter Dashboard: Real Database KPIs & Agenda', () => {
    it('returns live database-backed dashboard metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dashboard/recruiter',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      const data = body.data;
      // 4 KPI Cards
      expect(data.kpiCards).toBeDefined();
      expect(data.kpiCards.activeJobs).toHaveProperty('value');
      expect(data.kpiCards.activeJobs).toHaveProperty('delta');
      expect(data.kpiCards.candidates).toHaveProperty('value');
      expect(data.kpiCards.interviewsThisWeek).toHaveProperty('value');
      expect(data.kpiCards.placementsThisMonth).toHaveProperty('value');

      // Pipeline distribution
      expect(data.pipelineDistribution).toBeDefined();
      expect(Array.isArray(data.pipelineDistribution.stages)).toBe(true);
      expect(data.pipelineDistribution.stages.length).toBe(7);

      // Agenda & Recent Activity
      expect(Array.isArray(data.todayAgenda)).toBe(true);
      expect(Array.isArray(data.recentActivity)).toBe(true);
      expect(data.asOfTimestamp).toMatch(/IST$/);
    });
  });

  // =========================================================================
  // 4. Recruiter Daily Activity (Figma Frame 39)
  // =========================================================================
  describe('Recruiter Daily Activity: Targets & Call Logging', () => {
    it('returns daily activity counts against targets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/activity/daily',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      const d = body.data;
      expect(d.candidatesSourced).toBeDefined();
      expect(d.callsMade).toBeDefined();
      expect(d.emailsSent).toBeDefined();
      expect(d.submissionsSent).toBeDefined();
      expect(d.interviewsCompleted).toBeDefined();
      expect(typeof d.overallScorePercentage).toBe('number');
      expect(d.asOfTimestamp).toMatch(/IST$/);
    });

    it('logs a manual phone call activity and updates audit trail', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/activity/log',
        headers: { cookie: recruiterCookie },
        payload: {
          type: RecruiterActivityType.CALL,
          notes: 'Vitest Test Activity: Spoke with candidate about senior lead position compensation',
          durationMinutes: 15,
          outcome: 'Candidate agreed to proceed with technical interview round',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('CALL');
      expect(body.data.durationMinutes).toBe(15);
    });

    it('updates user recruiter daily targets', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/activity/targets',
        headers: { cookie: recruiterCookie },
        payload: {
          period: 'DAILY',
          targetCandidatesSourced: 15,
          targetCalls: 25,
          targetEmails: 20,
          targetSubmissions: 5,
          targetInterviews: 3,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.targetCalls).toBe(25);
      expect(body.data.targetCandidatesSourced).toBe(15);
    });
  });
});
