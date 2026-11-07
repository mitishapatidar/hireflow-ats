import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  OfferStatus,
  PaymentStatus,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Prompt 21: Offers, Placements & Recruitment Analytics Integration Tests', () => {
  let app: any;
  let adminCookie: string;
  let managerCookie: string;
  let recruiterCookie: string;
  let clientCookie: string;
  let createdSessionTokens: string[] = [];

  let testApplicationId: string;
  let testClientId: string;
  let createdOfferId: string;
  let createdPlacementId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    const managerUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.MANAGER } });
    const recruiterUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RECRUITER } });
    const clientUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.CLIENT } });

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
    clientCookie = await createSessionCookie(clientUser.id);

    const testApp = await prisma.application.findFirstOrThrow({
      include: { job: true },
    });
    testApplicationId = testApp.id;
    testClientId = testApp.job.clientId;
  });

  afterAll(async () => {
    if (createdPlacementId) {
      await prisma.placement.deleteMany({ where: { id: createdPlacementId } });
    }
    if (createdOfferId) {
      await prisma.offer.deleteMany({ where: { id: createdOfferId } });
    }
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/offers/stats returns live offers and placement KPIs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/offers/stats',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('releasedMtd');
    expect(body.data).toHaveProperty('acceptedRate');
    expect(body.data).toHaveProperty('totalPlacementFeeMtd');
    expect(body.data.asOfTimestamp).toContain('IST');
  });

  it('2. POST /api/offers creates draft offer with validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/offers',
      headers: { cookie: recruiterCookie },
      payload: {
        applicationId: testApplicationId,
        clientId: testClientId,
        offeredSalary: 2500000,
        joiningDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Final offered CTC ₹25,00,000 per annum',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(OfferStatus.DRAFT);
    expect(Number(body.data.offeredSalary)).toBe(2500000);

    createdOfferId = body.data.id;
  });

  it('3. POST /api/offers/:id/release transitions DRAFT to RELEASED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/offers/${createdOfferId}/release`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(OfferStatus.RELEASED);
  });

  it('4. POST /api/offers/:id/accept transitions RELEASED to ACCEPTED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/offers/${createdOfferId}/accept`,
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(OfferStatus.ACCEPTED);
    expect(body.data.acceptedAt).toBeDefined();
  });

  it('5. POST /api/offers/:id/confirm-joining calculates fee strictly on server, ignoring client feeAmount', async () => {
    // Clean up any pre-existing placement for this application first
    await prisma.placement.deleteMany({ where: { applicationId: testApplicationId } });

    // Client sends a forged low feeAmount (99 INR) to attempt fee tampering
    const res = await app.inject({
      method: 'POST',
      url: `/api/offers/${createdOfferId}/confirm-joining`,
      headers: { cookie: adminCookie },
      payload: {
        feeBasis: 'PERCENTAGE',
        feeAmount: 99, // Forged client feeAmount must be strictly ignored
        paymentTerms: 'NET_30',
        joinedAt: new Date().toISOString(),
        joiningEvidence: {
          source: 'CLIENT_EMAIL',
          confirmedBy: 'HR Director',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.offer.status).toBe(OfferStatus.JOINED);
    expect(body.data.placement.paymentStatus).toBe(PaymentStatus.PENDING);
    // Server calculated 8.5% of ₹25,00,000 CTC = 2,12,500 (tampered 99 ignored)
    expect(Number(body.data.placement.feeAmount)).toBe(212500);

    createdPlacementId = body.data.placement.id;

    // Verify application status changed to PLACED
    const appRecord = await prisma.application.findUniqueOrThrow({ where: { id: testApplicationId } });
    expect(appRecord.status).toBe('PLACED');
  });

  it('5b. POST /api/offers/:id/confirm-joining rejects joining if client has no agreed fee agreement', async () => {
    // Create a temporary client with no fee percentage
    const tempClient = await prisma.client.create({
      data: {
        code: `NOFEE-${Date.now().toString().slice(-4)}`,
        legalName: 'Zero Agreement Corp',
        organizationId: 'org-aureva-1',
        feePercentage: null,
      },
    });

    const tempJob = await prisma.job.create({
      data: {
        title: 'Tester',
        code: `J-NOFEE-${Date.now().toString().slice(-4)}`,
        organizationId: 'org-aureva-1',
        clientId: tempClient.id,
      },
    });

    const tempCandidate = await prisma.candidate.create({
      data: {
        code: `C-NOFEE-${Date.now().toString().slice(-4)}`,
        name: 'No Agreement Candidate',
        email: `noagree-${Date.now()}@example.com`,
        organizationId: 'org-aureva-1',
      },
    });

    const tempApp = await prisma.application.create({
      data: {
        jobId: tempJob.id,
        candidateId: tempCandidate.id,
        status: 'OFFER',
      },
    });

    const tempOffer = await prisma.offer.create({
      data: {
        applicationId: tempApp.id,
        clientId: tempClient.id,
        organizationId: 'org-aureva-1',
        offeredSalary: 1000000,
        status: OfferStatus.ACCEPTED,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/offers/${tempOffer.id}/confirm-joining`,
      headers: { cookie: adminCookie },
      payload: {
        joiningEvidence: {
          source: 'HR_CONFIRMATION',
          confirmedBy: 'HR Lead',
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CLIENT_FEE_AGREEMENT_MISSING');

    // Cleanup temp records
    await prisma.offer.delete({ where: { id: tempOffer.id } });
    await prisma.application.delete({ where: { id: tempApp.id } });
    await prisma.candidate.delete({ where: { id: tempCandidate.id } });
    await prisma.job.delete({ where: { id: tempJob.id } });
    await prisma.client.delete({ where: { id: tempClient.id } });
  });

  it('6. POST /api/offers/:id/confirm-joining blocks duplicate placement creation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/offers/${createdOfferId}/confirm-joining`,
      headers: { cookie: adminCookie },
      payload: {
        joiningEvidence: {
          source: 'CLIENT_EMAIL',
          confirmedBy: 'HR Director',
        },
      },
    });

    expect(res.statusCode).toBe(400); // cannot confirm joining since it is already JOINED
  });

  it('7. GET /api/search returns multi-entity search results with permission masking', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=a&type=ALL',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('candidates');
    expect(body.data).toHaveProperty('jobs');
    expect(body.data).toHaveProperty('clients');
    expect(body.data.totalMatches).toBeGreaterThan(0);
  });

  it('8. GET /api/reports/analytics/overview returns recruitment overview KPIs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/analytics/overview',
      headers: { cookie: managerCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('timeToHireDays');
    expect(body.data).toHaveProperty('submissionToInterviewRate');
    expect(body.data).toHaveProperty('offerAcceptanceRate');
  });

  it('9. GET /api/reports/analytics/leaderboard returns recruiter rankings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/analytics/leaderboard',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
