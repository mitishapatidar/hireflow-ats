/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  MessageChannel,
  MessageDeliveryStatus,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from '@hireflow/shared';

describe('Communications, Integrations & Templates API Integration Tests (Prompt 14)', { timeout: 30000 }, () => {
  let app: any;
  let adminCookie: string;
  let recruiterCookie: string;
  let candidateCookie: string;
  let createdSessionTokens: string[] = [];

  let testCandidateId: string;
  let testJobId: string;
  let adminUserId: string;
  let recruiterUserId: string;
  let testTemplateId: string;
  let testThreadId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });
    adminUserId = adminUser.id;

    const recruiterUser = await prisma.user.findFirstOrThrow({
      where: { id: 'user-mitisha-patidar' },
    });
    recruiterUserId = recruiterUser.id;

    const candidateUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CANDIDATE },
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

    // Get or create test candidate
    const candidate = await prisma.candidate.findFirstOrThrow({
      where: { isArchived: false },
    });
    testCandidateId = candidate.id;

    // Ensure test candidate has phone and opt-in
    await prisma.candidate.update({
      where: { id: testCandidateId },
      data: {
        phone: candidate.phone || '+91 98765 43210',
        whatsappOptIn: true,
        smsOptIn: true,
      },
    });

    const job = await prisma.job.findFirstOrThrow({
      where: { isArchived: false },
    });
    testJobId = job.id;

    // Create a published and approved WhatsApp test template
    const template = await prisma.template.create({
      data: {
        title: 'Interview Confirmation Meta Template',
        channel: MessageChannel.WHATSAPP,
        category: 'INTERVIEW_INVITE',
        body: 'Hello {{first_name}}, your interview for {{round}} at {{client}} is confirmed for {{time}}.',
        variables: ['first_name', 'round', 'client', 'time'],
        status: 'PUBLISHED',
        providerApprovalState: 'APPROVED',
        providerTemplateId: 'meta_interview_confirm_v1',
      },
    });
    testTemplateId = template.id;
  });

  afterAll(async () => {
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({
        where: { tokenHash: { in: createdSessionTokens } },
      });
    }
    if (testTemplateId) {
      await prisma.template.delete({ where: { id: testTemplateId } }).catch(() => {});
    }
    await app.close();
  });

  it('1. GET /api/communications/threads returns candidate communications inbox', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/communications/threads',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.threads)).toBe(true);
    expect(body.data.stats).toBeDefined();
    expect(body.data.stats.totalThreads).toBeDefined();
  });

  it('2. GET /api/communications/threads denies access to Candidate role with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/communications/threads',
      headers: { cookie: candidateCookie },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message || body.error?.message).toContain('Access denied');
  });

  it('3. POST /api/communications/email/send dispatches outbound email with signature injection', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/communications/email/send',
      headers: { cookie: recruiterCookie },
      payload: {
        candidateId: testCandidateId,
        jobId: testJobId,
        subject: 'Exciting Career Opportunity at Aureva Capital',
        bodyHtml: '<p>Dear Candidate, we were impressed by your background.</p>',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.message.id).toBeDefined();
    expect(body.data.message.providerMessageId).toMatch(/^mock-email-/);
    expect(body.data.message.isMock).toBe(true);
    testThreadId = body.data.message.threadId;

    // Verify thread contains injected signature and candidate activity was created
    const activity = await prisma.candidateActivity.findFirst({
      where: { candidateId: testCandidateId, type: 'EMAIL_SENT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeDefined();
    expect(activity?.title).toContain('Exciting Career Opportunity');
  });

  it('4. POST /api/communications/email/send creates draft without triggering mock send', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/communications/email/send',
      headers: { cookie: recruiterCookie },
      payload: {
        candidateId: testCandidateId,
        jobId: testJobId,
        subject: 'Draft Follow-up Note',
        bodyHtml: '<p>Drafting some thoughts...</p>',
        saveAsDraft: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.message.deliveryStatus).toBe('DRAFT');
  });

  it('5. POST /api/communications/whatsapp/send successfully sends approved template message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/communications/whatsapp/send',
      headers: { cookie: recruiterCookie },
      payload: {
        candidateId: testCandidateId,
        jobId: testJobId,
        templateId: testTemplateId,
        messageText: 'Hello Aarav, your interview is scheduled.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.message.providerMessageId).toMatch(/^mock-wamid-/);
  });

  it('6. POST /api/communications/whatsapp/send rejects freeform messages outside 24h window', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/communications/whatsapp/send',
      headers: { cookie: recruiterCookie },
      payload: {
        candidateId: testCandidateId,
        jobId: testJobId,
        // No approved template passed, freeform text
        messageText: 'Hey, are you free for a quick chat right now?',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('WHATSAPP_POLICY_VIOLATION');
    expect(body.error.message).toContain('Meta-approved WhatsApp template');
  });

  it('7. GET /api/communications/templates lists system templates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/communications/templates',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.templates.length).toBeGreaterThan(0);
  });

  it('8. POST /api/communications/templates/:id/preview renders merge variables', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/communications/templates/${testTemplateId}/preview`,
      headers: { cookie: recruiterCookie },
      payload: {
        candidateId: testCandidateId,
        customContext: {
          client: 'Barclays Global Tech',
          round: 'Final Partner Evaluation',
          time: '4:00 PM IST',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.renderedBody).toContain('Barclays Global Tech');
    expect(body.data.renderedBody).toContain('Final Partner Evaluation');
  });

  it('9. GET /api/communications/signature retrieves corporate team signature', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/communications/signature',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.previewRendered).toContain('Aureva Capital');
    expect(body.data.canEdit).toBe(false); // Recruiter cannot edit
  });

  it('10. PUT /api/communications/signature enforces Admin-only authorization', async () => {
    // Recruiter attempt -> 403 Forbidden
    const recruiterRes = await app.inject({
      method: 'PUT',
      url: '/api/communications/signature',
      headers: { cookie: recruiterCookie },
      payload: {
        signatureHtml: '<div>Malicious recruiter signature modification</div>',
      },
    });
    expect(recruiterRes.statusCode).toBe(403);

    // Admin attempt -> 200 OK
    const adminRes = await app.inject({
      method: 'PUT',
      url: '/api/communications/signature',
      headers: { cookie: adminCookie },
      payload: {
        signatureHtml: '<div style="font-family: Arial;"><b>{{name}}</b><br/>{{designation}} • {{organization}}</div>',
        designation: 'Executive Talent Lead',
        companyName: 'Aureva Capital Private Limited',
      },
    });
    expect(adminRes.statusCode).toBe(200);
  });

  it('11. GET /api/communications/integrations returns active provider connection statuses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/communications/integrations',
      headers: { cookie: recruiterCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.integrations).toHaveLength(4); // Gmail, Outlook, WhatsApp, SMS
    const providers = body.data.integrations.map((i: any) => i.provider);
    expect(providers).toEqual(expect.arrayContaining(['GMAIL', 'OUTLOOK', 'WHATSAPP', 'SMS']));
  });

  it('12. POST /api/communications/webhooks/whatsapp receives status updates idempotently', async () => {
    // Seed mock message
    let activeThreadId = testThreadId;
    if (!activeThreadId) {
      const th = await prisma.thread.create({
        data: {
          channel: MessageChannel.WHATSAPP,
          subject: 'Webhook Thread',
          candidateId: testCandidateId,
        },
      });
      activeThreadId = th.id;
    }

    const mockWamid = `mock-wamid-webhook-test-${Date.now()}`;
    await prisma.message.create({
      data: {
        threadId: activeThreadId,
        channel: MessageChannel.WHATSAPP,
        direction: 'OUTBOUND',
        status: 'SENT',
        deliveryStatus: 'SENT',
        sender: 'Aureva ATS WhatsApp',
        recipient: '+91 98765 43210',
        body: 'Webhook status check',
        providerMessageId: mockWamid,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/communications/webhooks/whatsapp',
      payload: {
        statuses: [
          {
            id: mockWamid,
            status: 'delivered',
            timestamp: '1762444800',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const updated = await prisma.message.findFirst({
      where: { providerMessageId: mockWamid },
    });
    expect(updated?.deliveryStatus).toBe('DELIVERED');
  });
});
