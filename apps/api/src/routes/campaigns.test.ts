/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  CampaignChannel,
  CampaignStatus,
  RecipientDeliveryStatus,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Prompt 29: Bulk Email/SMS Campaigns & Compliance Integration Tests', () => {
  let app: any;
  let adminCookie: string;
  let recruiterCookie: string;
  let clientCookie: string;
  const createdSessionTokens: string[] = [];
  const cleanupCampaignIds: string[] = [];
  const cleanupCandidateIds: string[] = [];

  let testCandidateEligible: any;
  let testCandidateUnsubscribed: any;
  let testCandidateNoPhone: any;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const admin = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    const recruiter = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RECRUITER } });
    const clientUser = await prisma.user.findFirst({ where: { role: UserRole.CLIENT } });

    async function makeSession(userId: string) {
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

    adminCookie = await makeSession(admin.id);
    recruiterCookie = await makeSession(recruiter.id);
    if (clientUser) {
      clientCookie = await makeSession(clientUser.id);
    }

    // Seed test candidates for audience filtering tests
    const timestamp = Date.now();
    testCandidateEligible = await prisma.candidate.create({
      data: {
        code: `CAN-${timestamp}-1`,
        name: `Campaign Eligible-${timestamp}`,
        organizationId: admin.organizationId,
        email: `campaign.eligible.${timestamp}@test.hireflow.internal`,
        phone: '+919876543210',
        emailMarketingOptIn: true,
        smsOptIn: true,
        unsubscribeToken: `unsub-${timestamp}-1`,
      },
    });
    cleanupCandidateIds.push(testCandidateEligible.id);

    testCandidateUnsubscribed = await prisma.candidate.create({
      data: {
        code: `CAN-${timestamp}-2`,
        name: `Campaign OptedOut-${timestamp}`,
        organizationId: admin.organizationId,
        email: `campaign.optout.${timestamp}@test.hireflow.internal`,
        phone: '+919876543211',
        emailMarketingOptIn: false,
        smsOptIn: false,
        unsubscribeToken: `unsub-${timestamp}-2`,
      },
    });
    cleanupCandidateIds.push(testCandidateUnsubscribed.id);

    testCandidateNoPhone = await prisma.candidate.create({
      data: {
        code: `CAN-${timestamp}-3`,
        name: `Campaign NoPhone-${timestamp}`,
        organizationId: admin.organizationId,
        email: `campaign.nophone.${timestamp}@test.hireflow.internal`,
        phone: null,
        emailMarketingOptIn: true,
        smsOptIn: true,
        unsubscribeToken: `unsub-${timestamp}-3`,
      },
    });
    cleanupCandidateIds.push(testCandidateNoPhone.id);
  });

  afterAll(async () => {
    // Cleanup
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }
    if (cleanupCampaignIds.length > 0) {
      await prisma.campaignRecipient.deleteMany({
        where: { campaignId: { in: cleanupCampaignIds } },
      });
      await prisma.campaign.deleteMany({
        where: { id: { in: cleanupCampaignIds } },
      });
    }
    if (cleanupCandidateIds.length > 0) {
      await prisma.candidate.deleteMany({
        where: { id: { in: cleanupCandidateIds } },
      });
    }
    await app.close();
  });

  it('1. GET /api/campaigns rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns',
    });
    expect(res.statusCode).toBe(401);
  });

  it('2. GET /api/campaigns rejects CLIENT role with 403', async () => {
    if (!clientCookie) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns',
      headers: { cookie: clientCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('3. POST /api/campaigns creates an Email campaign draft successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { cookie: recruiterCookie },
      payload: {
        title: 'Q4 Senior Engineering Outreach',
        channel: CampaignChannel.EMAIL,
        subject: 'Senior Technical Opportunities at Aureva Capital',
        bodyHtml: '<p>Hi {{first_name}}, explore our latest tech positions.</p>',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe(CampaignStatus.DRAFT);
    expect(body.data.channel).toBe(CampaignChannel.EMAIL);
    cleanupCampaignIds.push(body.data.id);
  });

  it('4. POST /api/campaigns rejects SMS campaign with invalid DLT parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { cookie: recruiterCookie },
      payload: {
        title: 'SMS Blast Without DLT',
        channel: CampaignChannel.SMS,
        bodyText: 'Hello {{first_name}}, update on your application.',
        dltSenderId: 'INVALID-TOO-LONG-SENDER', // DLT sender ID must be 6 alpha characters
        dltTemplateId: '123', // Must be 19 numeric digits
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('TRAI DLT');
  });

  it('5. POST /api/campaigns creates a valid SMS campaign draft with approved DLT info', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { cookie: recruiterCookie },
      payload: {
        title: 'Interview Schedule Reminder SMS',
        channel: CampaignChannel.SMS,
        bodyText: 'Hello {{first_name}}, please confirm your interview for {{date}} at {{time}} with Aureva Capital.',
        dltSenderId: 'AURVCP',
        dltTemplateId: '1107161234567890123',
        dltEntityId: '1101150000000000123',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.dltSenderId).toBe('AURVCP');
    cleanupCampaignIds.push(body.data.id);
  });

  it('6. POST /api/campaigns/test-send delivers mock test Email and SMS with segment metadata', async () => {
    // Email Test Send
    const emailRes = await app.inject({
      method: 'POST',
      url: '/api/campaigns/test-send',
      headers: { cookie: recruiterCookie },
      payload: {
        channel: CampaignChannel.EMAIL,
        recipient: 'qa-tester@aurevacapital.com',
        subject: 'Test Subject',
        bodyHtml: '<p>Hi {{first_name}}, this is a test.</p>',
      },
    });

    expect(emailRes.statusCode).toBe(200);
    const emailBody = emailRes.json();
    expect(emailBody.success).toBe(true);
    expect(emailBody.data.isMock).toBe(true);

    // SMS Test Send
    const smsRes = await app.inject({
      method: 'POST',
      url: '/api/campaigns/test-send',
      headers: { cookie: recruiterCookie },
      payload: {
        channel: CampaignChannel.SMS,
        recipient: '+919876543210',
        bodyText: 'Test SMS message to {{first_name}}.',
      },
    });

    expect(smsRes.statusCode).toBe(200);
    const smsBody = smsRes.json();
    expect(smsBody.success).toBe(true);
    expect(smsBody.data.segmentInfo).toBeDefined();
    expect(smsBody.data.segmentInfo.segmentCount).toBe(1);
  });

  it('7. POST /api/campaigns/:id/audience calculates audience and strictly excludes unsubscribed candidate', async () => {
    // Create draft campaign
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { cookie: recruiterCookie },
      payload: {
        title: 'Audience Calculation Verification',
        channel: CampaignChannel.EMAIL,
        subject: 'Special Outreach',
        bodyHtml: '<p>Hi {{first_name}}</p>',
      },
    });
    const campaignId = draftRes.json().data.id;
    cleanupCampaignIds.push(campaignId);

    // Run audience calculation
    const audRes = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaignId}/audience`,
      headers: { cookie: recruiterCookie },
      payload: {
        saveRecipients: true,
        audienceFilter: {
          search: 'Campaign',
        },
      },
    });

    expect(audRes.statusCode).toBe(200);
    const audData = audRes.json().data;
    expect(audData.totalEvaluated).toBeGreaterThanOrEqual(2);
    expect(audData.exclusionBreakdown.UNSUBSCRIBED).toBeGreaterThanOrEqual(1);

    // Verify sampleExcluded contains our testCandidateUnsubscribed
    const excludedIds = audData.sampleExcluded.map((e: any) => e.candidateId);
    expect(excludedIds).toContain(testCandidateUnsubscribed.id);

    // Verify sampleEligible contains our testCandidateEligible
    const eligibleIds = audData.sampleEligible.map((e: any) => e.candidateId);
    expect(eligibleIds).toContain(testCandidateEligible.id);
  });

  it('8. POST /api/campaigns/:id/schedule starts dispatch immediately and updates status', async () => {
    // Create draft
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { cookie: recruiterCookie },
      payload: {
        title: 'Instant Send Campaign',
        channel: CampaignChannel.EMAIL,
        subject: 'Important Job Update',
        bodyHtml: '<p>Hello {{first_name}}</p>',
      },
    });
    const campaignId = draftRes.json().data.id;
    cleanupCampaignIds.push(campaignId);

    // Save audience
    await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaignId}/audience`,
      headers: { cookie: recruiterCookie },
      payload: {
        saveRecipients: true,
        audienceFilter: { search: testCandidateEligible.name },
      },
    });

    // Send now
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaignId}/schedule`,
      headers: { cookie: recruiterCookie },
      payload: {
        sendNow: true,
      },
    });

    expect(sendRes.statusCode).toBe(200);
    const sendData = sendRes.json();
    expect(sendData.success).toBe(true);
    expect(sendData.data.status).toBe(CampaignStatus.PROCESSING);
  });

  it('9. POST /api/campaigns/:id/cancel cancels a scheduled campaign', async () => {
    // Create draft
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { cookie: recruiterCookie },
      payload: {
        title: 'Scheduled Future Campaign',
        channel: CampaignChannel.EMAIL,
        subject: 'Upcoming Event',
        bodyHtml: '<p>Hello {{first_name}}</p>',
      },
    });
    const campaignId = draftRes.json().data.id;
    cleanupCampaignIds.push(campaignId);

    // Save audience
    await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaignId}/audience`,
      headers: { cookie: recruiterCookie },
      payload: {
        saveRecipients: true,
        audienceFilter: { search: testCandidateEligible.name },
      },
    });

    // Schedule for future
    await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaignId}/schedule`,
      headers: { cookie: recruiterCookie },
      payload: {
        sendNow: false,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    // Cancel
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaignId}/cancel`,
      headers: { cookie: recruiterCookie },
    });

    expect(cancelRes.statusCode).toBe(200);
    const cancelData = cancelRes.json();
    expect(cancelData.data.status).toBe(CampaignStatus.CANCELLED);
  });

  it('10. Public Unsubscribe flow: GET /api/public/unsubscribe/:token and POST opt-out', async () => {
    const token = testCandidateEligible.unsubscribeToken;

    // Check token info
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/public/unsubscribe/${token}`,
    });

    expect(getRes.statusCode).toBe(200);
    const getData = getRes.json().data;
    expect(getData.email).toBe(testCandidateEligible.email);
    expect(getData.isSubscribed).toBe(true);

    // Submit opt-out
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/public/unsubscribe/${token}`,
      payload: {
        channel: CampaignChannel.EMAIL,
        feedback: 'Too many emails',
      },
    });

    expect(postRes.statusCode).toBe(200);
    expect(postRes.json().success).toBe(true);

    // Verify candidate database opt-out state
    const updatedCandidate = await prisma.candidate.findUnique({
      where: { id: testCandidateEligible.id },
    });
    expect(updatedCandidate?.emailMarketingOptIn).toBe(false);
    expect(updatedCandidate?.emailMarketingOptOutAt).toBeDefined();
  });
});
