import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  PaymentStatus,
  OfferStatus,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Prompt 27: Placement Records & Commercial Fees Integration Tests', () => {
  let app: any;
  let adminCookie: string;
  let managerCookie: string;
  let recruiterCookie: string;
  let clientCookie: string;
  let createdSessionTokens: string[] = [];

  let testApplication: any;
  let testPlacementId: string;
  let testOfferId: string;

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

    // Find or setup test application
    testApplication = await prisma.application.findFirstOrThrow({
      include: { job: { include: { client: true } }, candidate: true },
    });

    // Clean any existing placement for this application
    await prisma.placement.deleteMany({ where: { applicationId: testApplication.id } });
    await prisma.offer.deleteMany({ where: { applicationId: testApplication.id } });

    // Create an initial placement for testing
    const placement = await prisma.placement.create({
      data: {
        applicationId: testApplication.id,
        clientId: testApplication.job.clientId,
        organizationId: 'org-aureva-1',
        feeBasis: 'PERCENTAGE',
        ctcSnapshot: 2000000,
        feePercentage: 8.5,
        feeAmount: 170000,
        adjustmentAmount: 0,
        paymentTerms: 'NET_30',
        paymentStatus: PaymentStatus.PENDING,
        amountReceived: 0,
        joiningDate: new Date(),
        createdById: adminUser.id,
        joiningConfirmation: {
          create: {
            source: 'CLIENT_EMAIL',
            confirmedBy: 'HR Director',
            notes: 'Formal joining confirmation via email',
          },
        },
        history: {
          create: {
            eventType: 'CREATED',
            actorId: adminUser.id,
            actorRole: UserRole.ADMIN,
            notes: 'Initial placement record created',
          },
        },
      },
    });

    testPlacementId = placement.id;

    // Create an upcoming offer in ACCEPTED status (not yet joined)
    const upcomingOffer = await prisma.offer.create({
      data: {
        applicationId: testApplication.id,
        clientId: testApplication.job.clientId,
        organizationId: 'org-aureva-1',
        offeredSalary: 1800000,
        joiningDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // in 15 days
        status: OfferStatus.ACCEPTED,
        acceptedAt: new Date(),
        createdById: recruiterUser.id,
      },
    });
    testOfferId = upcomingOffer.id;
  });

  afterAll(async () => {
    if (testPlacementId) {
      await prisma.placement.deleteMany({ where: { id: testPlacementId } });
    }
    if (testOfferId) {
      await prisma.offer.deleteMany({ where: { id: testOfferId } });
    }
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({ where: { tokenHash: { in: createdSessionTokens } } });
    }
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/placements/stats returns 5 KPI cards with leadership commercial visibility', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/placements/stats',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.totalConfirmedPlacements).toBeGreaterThanOrEqual(1);
    expect(body.data).toHaveProperty('placementsMtd');
    expect(body.data).toHaveProperty('upcomingJoiningDates');
    expect(body.data).toHaveProperty('pendingFeePayments');
    expect(body.data.totalFeeBookedMtd).toBeGreaterThanOrEqual(170000);
  });

  it('2. GET /api/placements/stats hides totalFeeBookedMtd from RECRUITER role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/placements/stats',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.totalFeeBookedMtd).toBeNull();
  });

  it('3. GET /api/placements/upcoming-offers returns accepted offers awaiting joining confirmation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/placements/upcoming-offers',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((o: any) => o.id === testOfferId);
    expect(found).toBeDefined();
    expect(found.status).toBe(OfferStatus.ACCEPTED);
  });

  it('4. GET /api/placements lists placements with pagination and role serialization', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/placements?limit=10',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    const testP = body.data.items.find((p: any) => p.id === testPlacementId);
    expect(testP).toBeDefined();
    expect(testP.commercials).toBeDefined();
    expect(testP.commercials.feeAmount).toBe(170000);
  });

  it('5. GET /api/placements/:id returns placement detail and evidence', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/placements/${testPlacementId}`,
      headers: { cookie: managerCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(testPlacementId);
    expect(body.data.joiningConfirmation.confirmedBy).toBe('HR Director');
    expect(body.data.commercials.balanceDue).toBe(170000);
  });

  it('6. PATCH /api/placements/:id/payment-status updates status and logs event in history', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/placements/${testPlacementId}/payment-status`,
      headers: { cookie: adminCookie },
      payload: {
        paymentStatus: PaymentStatus.INVOICED,
        invoiceNumber: 'INV-2026-0042',
        notes: 'Invoice sent to client accounts payable team',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.paymentStatus).toBe(PaymentStatus.INVOICED);
    expect(body.data.invoiceNumber).toBe('INV-2026-0042');
  });

  it('7. POST /api/placements/:id/payments records partial installment and marks PARTIALLY_PAID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/placements/${testPlacementId}/payments`,
      headers: { cookie: adminCookie },
      payload: {
        amount: 70000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'NEFT992381283',
        notes: 'First installment received',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.placement.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
    expect(body.data.placement.commercials.amountReceived).toBe(70000);
    expect(body.data.placement.commercials.balanceDue).toBe(100000);
  });

  it('8. POST /api/placements/:id/payments completes balance and marks PAID with paidAt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/placements/${testPlacementId}/payments`,
      headers: { cookie: adminCookie },
      payload: {
        amount: 100000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'NEFT992389999',
        notes: 'Final installment settlement',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.placement.paymentStatus).toBe(PaymentStatus.PAID);
    expect(body.data.placement.commercials.amountReceived).toBe(170000);
    expect(body.data.placement.commercials.balanceDue).toBe(0);
    expect(body.data.placement.commercials.paidAt).toBeDefined();
  });

  it('8b. POST /api/placements/:id/payments rejects overpayment beyond total commercial fee', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/placements/${testPlacementId}/payments`,
      headers: { cookie: adminCookie },
      payload: {
        amount: 50000, // Total fee is 170000, and 170000 is already received
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'NEFT_EXCESS_1',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('OVERPAYMENT_NOT_PERMITTED');
  });

  it('8c. POST /api/placements/:id/payments rejects negative or zero payment amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/placements/${testPlacementId}/payments`,
      headers: { cookie: adminCookie },
      payload: {
        amount: -1000,
        referenceNumber: 'NEFT_NEG',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('8d. PATCH /api/placements/:id/payment-status rejects WAIVED status without mandatory waiver reason', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/placements/${testPlacementId}/payment-status`,
      headers: { cookie: adminCookie },
      payload: {
        paymentStatus: PaymentStatus.WAIVED,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('9. GET /api/placements/:id/history returns immutable event log', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/placements/${testPlacementId}/history`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    const eventTypes = body.data.map((h: any) => h.eventType);
    expect(eventTypes).toContain('STATUS_CHANGED');
    expect(eventTypes).toContain('PAYMENT_RECORDED');
  });
});
