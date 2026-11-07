/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import { UserRole, generateSecureToken, hashToken, SESSION_COOKIE_NAME } from '@hireflow/shared';

describe('Prompt 25: Video Meetings, Self-Scheduling & Candidate Portal API', () => {
  let server: FastifyInstance;

  // Test Entities
  let org: any;
  let client: any;
  let recruiterUser: any;
  let candidateUser: any;
  let candidateRecord: any;
  let job: any;
  let jobRound: any;
  let application: any;

  let recruiterCookie: string;
  let candidateCookie: string;
  const createdSessionTokens: string[] = [];

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // 1. Organization
    org = await prisma.organization.upsert({
      where: { id: 'org-aureva-1' },
      update: {},
      create: {
        id: 'org-aureva-1',
        name: 'Aureva Capital Private Limited',
        domain: 'aurevacapital.com',
        slug: 'aureva-capital',
      },
    });

    // 2. Recruiter User
    recruiterUser = await prisma.user.create({
      data: {
        email: `recruiter.p25.${Date.now()}@aurevacapital.com`,
        name: 'Priya Recruiter',
        role: UserRole.RECRUITER,
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });

    const tokenRecruiter = generateSecureToken(32);
    createdSessionTokens.push(hashToken(tokenRecruiter));
    await prisma.session.create({
      data: {
        userId: recruiterUser.id,
        tokenHash: hashToken(tokenRecruiter),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    recruiterCookie = `${SESSION_COOKIE_NAME}=${tokenRecruiter}`;

    // 3. Candidate User & Profile
    const candidateEmail = `candidate.p25.${Date.now()}@example.com`;
    candidateUser = await prisma.user.create({
      data: {
        email: candidateEmail,
        name: 'Vikram Joshi',
        role: UserRole.CANDIDATE,
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });

    candidateRecord = await prisma.candidate.create({
      data: {
        code: `CAN-${Date.now().toString().slice(-4)}`,
        name: 'Vikram Joshi',
        email: candidateEmail,
        phone: '+91 98765 43210',
        currentTitle: 'Senior Frontend Engineer',
        currentCompany: 'NextGen Tech',
        location: 'Mumbai, India',
        source: 'DIRECT_APPLICATION',
        skills: ['React', 'TypeScript', 'Next.js'],
        organizationId: org.id,
        userId: candidateUser.id,
      },
    });

    const tokenCandidate = generateSecureToken(32);
    createdSessionTokens.push(hashToken(tokenCandidate));
    await prisma.session.create({
      data: {
        userId: candidateUser.id,
        tokenHash: hashToken(tokenCandidate),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    candidateCookie = `${SESSION_COOKIE_NAME}=${tokenCandidate}`;

    // 4. Client & Job
    client = await prisma.client.create({
      data: {
        code: `CLI-P25-${Date.now().toString().slice(-4)}`,
        legalName: 'Apex Cloud Solutions Ltd',
        organizationId: org.id,
      },
    });

    job = await prisma.job.create({
      data: {
        code: `JOB-P25-${Date.now().toString().slice(-4)}`,
        title: 'Lead Fullstack Developer',
        clientId: client.id,
        organizationId: org.id,
        status: 'ACTIVE',
      },
    });

    jobRound = await prisma.jobRound.create({
      data: {
        jobId: job.id,
        name: 'Technical Architecture Round',
        roundOrder: 1,
        interviewType: 'VIDEO',
        durationMinutes: 45,
      },
    });

    application = await prisma.application.create({
      data: {
        candidateId: candidateRecord.id,
        jobId: job.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (application?.id) {
      await prisma.slotOption.deleteMany({
        where: { invitation: { applicationId: application.id } },
      });
      await prisma.slotInvitation.deleteMany({
        where: { applicationId: application.id },
      });
      await prisma.interview.deleteMany({
        where: { applicationId: application.id },
      });
      await prisma.application.deleteMany({
        where: { id: application.id },
      });
    }
    if (candidateRecord?.id) {
      await prisma.candidate.deleteMany({
        where: { id: candidateRecord.id },
      });
    }
    if (jobRound?.id) {
      await prisma.jobRound.deleteMany({
        where: { id: jobRound.id },
      });
    }
    if (job?.id) {
      await prisma.job.deleteMany({
        where: { id: job.id },
      });
    }
    if (client?.id) {
      await prisma.client.deleteMany({
        where: { id: client.id },
      });
    }
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }
    const userIds = [recruiterUser?.id, candidateUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await server.close();
  });

  describe('Part 1: Video Meeting Integration Post-Persistence (Frame 27)', () => {
    let createdInterviewId: string;

    it('creates an interview and generates a video meeting post-persistence', async () => {
      const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const res = await server.inject({
        method: 'POST',
        url: '/api/interviews',
        headers: {
          cookie: recruiterCookie,
          'content-type': 'application/json',
        },
        payload: {
          applicationId: application.id,
          roundId: jobRound.id,
          scheduledAt,
          duration: 45,
          timezone: 'Asia/Kolkata',
          mode: 'VIDEO',
          provider: 'GOOGLE_MEET',
          panelMemberIds: [recruiterUser.id],
        },
      });

      if (res.statusCode !== 201) {
        console.error('FAILED POST /api/interviews:', res.statusCode, res.payload);
      }

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      createdInterviewId = body.data.id;

      // Verify interview exists in DB
      const dbInterview = await prisma.interview.findUnique({
        where: { id: createdInterviewId },
        include: { videoMeeting: true },
      });
      expect(dbInterview).not.toBeNull();
      expect(dbInterview?.videoMeeting).not.toBeNull();
      expect(dbInterview?.videoMeeting?.provider).toBe('GOOGLE_MEET');
      expect(dbInterview?.videoMeeting?.joinUrl).toContain('meet.google.com');
      expect(dbInterview?.meetingLink).toContain('meet.google.com');
    });

    it('allows retrying video meeting generation for an existing interview', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/interviews/${createdInterviewId}/meeting`,
        headers: {
          cookie: recruiterCookie,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'ZOOM',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.provider).toBe('ZOOM');
      expect(body.data.joinUrl || body.data.meetingLink).toContain('zoom.us/j');
    });
  });

  describe('Part 2: Slot Invitations & Public Self-Scheduling (Frame 44)', () => {
    let rawToken: string;
    let invitationId: string;
    let slotOptions: any[];

    it('creates a slot invitation with hashed token and slot options', async () => {
      const baseTime = Date.now() + 72 * 60 * 60 * 1000;
      const slots = [
        {
          startTime: new Date(baseTime).toISOString(),
          endTime: new Date(baseTime + 45 * 60 * 1000).toISOString(),
        },
        {
          startTime: new Date(baseTime + 60 * 60 * 1000).toISOString(),
          endTime: new Date(baseTime + 105 * 60 * 1000).toISOString(),
        },
      ];

      const res = await server.inject({
        method: 'POST',
        url: '/api/slot-invitations',
        headers: {
          cookie: recruiterCookie,
          'content-type': 'application/json',
        },
        payload: {
          applicationId: application.id,
          roundId: jobRound.id,
          duration: 45,
          timezone: 'Asia/Kolkata',
          expiresInHours: 72,
          panelMemberIds: [recruiterUser.id],
          slots,
        },
      });

      if (res.statusCode !== 201) {
        console.error('FAILED POST /api/slot-invitations:', res.statusCode, res.payload);
      }

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      rawToken = body.data.token;
      invitationId = body.data.id;
      slotOptions = body.data.slotOptions;
      expect(slotOptions.length).toBe(2);
    });

    it('allows candidate to view public slot invitation via raw token', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/slot-invitations/public/slots/${rawToken}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.candidateName).toBe('Vikram Joshi');
      expect(body.data.jobTitle).toBe('Lead Fullstack Developer');
      expect(body.data.duration).toBe(45);
      expect(body.data.slotOptions.length).toBe(2);
      expect(body.data.slotOptions[0].isAvailable).toBe(true);
    });

    it('confirms a slot booking atomically and generates video meeting + ICS', async () => {
      const selectedSlot = slotOptions[0];

      const res = await server.inject({
        method: 'POST',
        url: `/api/slot-invitations/public/slots/${rawToken}/confirm`,
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          slotOptionId: selectedSlot.id,
          timezone: 'Asia/Kolkata',
          candidateNotes: 'Looking forward to discussing the architecture.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('CONFIRMED');
      expect(body.data.meetingUrl).toContain('meet.google.com');

      // Verify invitation in DB is marked BOOKED
      const dbInvite = await prisma.slotInvitation.findUnique({
        where: { id: invitationId },
      });
      expect(dbInvite?.status).toBe('BOOKED');
    });

    it('prevents double booking when re-attempting booking on a booked invitation', async () => {
      const selectedSlot = slotOptions[1];

      const res = await server.inject({
        method: 'POST',
        url: `/api/slot-invitations/public/slots/${rawToken}/confirm`,
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          slotOptionId: selectedSlot.id,
          timezone: 'Asia/Kolkata',
        },
      });

      // Should be rejected because invitation is already BOOKED
      expect([400, 409]).toContain(res.statusCode);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
    });
  });

  describe('Part 3: Candidate Portal & Strict Anti-Leak Protection (Frames 14 & 48)', () => {
    it('returns candidate-safe portal data and never leaks internal recruiter fields', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/candidate-portal/me',
        headers: {
          cookie: candidateCookie,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      const portalData = body.data;
      expect(portalData.profile.name).toBe('Vikram Joshi');
      expect(portalData.profile.email).toBe(candidateUser.email);
      expect(portalData.profile.completenessScore).toBeGreaterThan(0);

      // Verify Applications
      expect(portalData.applications.length).toBeGreaterThan(0);
      const app = portalData.applications[0];
      expect(app.jobTitle).toBe('Lead Fullstack Developer');

      // Verify Anti-Leak: forbidden fields must NOT exist anywhere in payload
      const payloadString = JSON.stringify(portalData);
      expect(payloadString).not.toContain('feePercentage');
      expect(payloadString).not.toContain('recruiterMargin');
      expect(payloadString).not.toContain('paymentTerms');
      expect(payloadString).not.toContain('internalNotes');
      expect(payloadString).not.toContain('reviewerFeedback');
      expect(payloadString).not.toContain('scorecard');
    });

    it('updates candidate profile securely with allowed fields only', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/candidate-portal/profile',
        headers: {
          cookie: candidateCookie,
          'content-type': 'application/json',
        },
        payload: {
          phone: '+91 99999 88888',
          location: 'Bengaluru, India',
          skills: ['React', 'TypeScript', 'Next.js', 'Node.js', 'PostgreSQL'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.phone).toBe('+91 99999 88888');
      expect(body.data.location).toBe('Bengaluru, India');
      expect(body.data.skills).toContain('PostgreSQL');

      // Verify in DB
      const dbCandidate = await prisma.candidate.findUnique({
        where: { id: candidateRecord.id },
      });
      expect(dbCandidate?.phone).toBe('+91 99999 88888');
      expect(dbCandidate?.location).toBe('Bengaluru, India');
    });
  });
});
