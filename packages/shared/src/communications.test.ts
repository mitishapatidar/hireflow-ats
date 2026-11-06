import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  encryptOAuthToken,
  decryptOAuthToken,
  renderMergeFields,
  escapeHtml,
  renderTeamSignature,
  getDefaultSharedSignatureHtml,
  isWithinWhatsApp24hWindow,
  validateWhatsAppSend,
  MockEmailProvider,
  MockWhatsAppProvider,
  MockSMSProvider,
  verifyWhatsAppWebhookSignature,
  serializeThreadSafe,
  MessageChannel,
  MessageDeliveryStatus,
} from './communications';

describe('Prompt 14 — Communications, Integrations & Templates Engine', () => {
  describe('AES-256-GCM OAuth Token Security', () => {
    it('successfully encrypts and decrypts an OAuth access token', () => {
      const originalToken = 'ya29.a0AfH6SMBDEMO_GMAIL_TOKEN_SECRET_987654321';
      const encrypted = encryptOAuthToken(originalToken);

      expect(encrypted).toContain(':');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3); // iv : authTag : ciphertext

      const decrypted = decryptOAuthToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('works with custom 256-bit encryption master key', () => {
      const customKey = crypto.randomBytes(32).toString('hex');
      const originalToken = 'EAAK...whatsapp_meta_cloud_token';
      const encrypted = encryptOAuthToken(originalToken, customKey);
      const decrypted = decryptOAuthToken(encrypted, customKey);

      expect(decrypted).toBe(originalToken);
    });

    it('throws error when tampering with ciphertext or auth tag', () => {
      const originalToken = 'secret-refresh-token';
      const encrypted = encryptOAuthToken(originalToken);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Tampered ciphertext
      const tamperedCiphertext = ciphertext.slice(0, -2) + 'aa';
      expect(() => {
        decryptOAuthToken(`${iv}:${authTag}:${tamperedCiphertext}`);
      }).toThrow();

      // Tampered auth tag
      const tamperedTag = '00'.repeat(16);
      expect(() => {
        decryptOAuthToken(`${iv}:${tamperedTag}:${ciphertext}`);
      }).toThrow();
    });
  });

  describe('Merge Fields Resolution & HTML Sanitization', () => {
    it('escapes dangerous HTML characters to prevent XSS', () => {
      const dangerous = '<script>alert("hacked")</script> & "quotes"';
      const escaped = escapeHtml(dangerous);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;');
    });

    it('renders standard merge fields correctly', () => {
      const template = 'Hi {{first_name}}, invitation to interview at {{client}} for round {{round}} at {{time}}.';
      const context = {
        first_name: 'Aarav',
        client: 'FinTech Corp',
        round: 'Technical Architecture',
        time: '3:00 PM IST',
      };

      const result = renderMergeFields(template, context);
      expect(result.rendered).toBe('Hi Aarav, invitation to interview at FinTech Corp for round Technical Architecture at 3:00 PM IST.');
      expect(result.missingFields).toHaveLength(0);
      expect(result.hasWarnings).toBe(false);
    });

    it('identifies missing variables and emits warnings without crashing', () => {
      const template = 'Hello {{first_name}}, meeting link: {{meeting_link}}. Recruiter: {{recruiter_name}}';
      const context = {
        first_name: 'Priya',
        // missing meeting_link and recruiter_name
      };

      const result = renderMergeFields(template, context);
      expect(result.rendered).toContain('Hello Priya');
      expect(result.missingFields).toEqual(['meeting_link', 'recruiter_name']);
      expect(result.hasWarnings).toBe(true);
    });
  });

  describe('Corporate Team Signature Engine', () => {
    it('renders shared corporate signature for a specific team member', () => {
      const raw = getDefaultSharedSignatureHtml();
      const user = {
        name: 'Rohan Sharma',
        designation: 'Lead Tech Recruiter',
        organizationName: 'Aureva Capital',
        email: 'rohan.sharma@aurevacapital.com',
        phone: '+91 98765 43210',
      };

      const rendered = renderTeamSignature(raw, user);
      expect(rendered).toContain('Rohan Sharma');
      expect(rendered).toContain('Lead Tech Recruiter');
      expect(rendered).toContain('rohan.sharma@aurevacapital.com');
      expect(rendered).toContain('+91 98765 43210');
      expect(rendered).toContain('Aureva Capital Private Limited • Confidential');
    });

    it('omits phone block when sender phone is not configured', () => {
      const raw = getDefaultSharedSignatureHtml();
      const user = {
        name: 'Deepa Sen',
        email: 'deepa.sen@aurevacapital.com',
      };

      const rendered = renderTeamSignature(raw, user);
      expect(rendered).toContain('Deepa Sen');
      expect(rendered).not.toContain('Phone:');
    });
  });

  describe('WhatsApp 24-Hour Window & Template Rules', () => {
    it('calculates 24-hour service window accurately', () => {
      const recent = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      expect(isWithinWhatsApp24hWindow(recent)).toBe(true);

      const expired = new Date(Date.now() - 26 * 60 * 60 * 1000); // 26 hours ago
      expect(isWithinWhatsApp24hWindow(expired)).toBe(false);

      expect(isWithinWhatsApp24hWindow(null)).toBe(false);
    });

    it('rejects sending to candidates who have opted out', () => {
      const result = validateWhatsAppSend({
        optIn: false,
        isTemplate: true,
        isTemplateApproved: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('opted in');
    });

    it('allows freeform message within 24-hour window', () => {
      const recent = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const result = validateWhatsAppSend({
        optIn: true,
        isTemplate: false,
        isTemplateApproved: false,
        lastInboundAt: recent,
      });
      expect(result.allowed).toBe(true);
    });

    it('prohibits freeform message outside 24-hour window', () => {
      const expired = new Date(Date.now() - 30 * 60 * 60 * 1000);
      const result = validateWhatsAppSend({
        optIn: true,
        isTemplate: false,
        isTemplateApproved: false,
        lastInboundAt: expired,
      });
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Meta-approved WhatsApp template');
    });

    it('allows Meta-approved template outside 24-hour window', () => {
      const result = validateWhatsAppSend({
        optIn: true,
        isTemplate: true,
        isTemplateApproved: true,
        lastInboundAt: null, // First outbound reach
      });
      expect(result.allowed).toBe(true);
    });

    it('rejects unapproved template outside 24-hour window', () => {
      const result = validateWhatsAppSend({
        optIn: true,
        isTemplate: true,
        isTemplateApproved: false,
        lastInboundAt: null,
      });
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('not approved by Meta');
    });
  });

  describe('Mock Providers Transparency', () => {
    it('generates mock email with demo mode label', () => {
      const res = MockEmailProvider.sendEmail({
        to: 'candidate@example.com',
        subject: 'Job Opportunity',
        bodyHtml: '<p>Test</p>',
      });
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toMatch(/^mock-email-/);
      expect(res.isMock).toBe(true);
      expect(res.label).toContain('Demo mode');
      expect(res.deliveryStatus).toBe(MessageDeliveryStatus.SENT);
    });

    it('generates mock whatsapp with demo mode label', () => {
      const res = MockWhatsAppProvider.sendWhatsApp({
        to: '+919876543210',
        messageText: 'Hello',
      });
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toMatch(/^mock-wamid-/);
      expect(res.isMock).toBe(true);
      expect(res.label).toContain('Demo mode');
    });

    it('generates mock sms with demo mode label', () => {
      const res = MockSMSProvider.sendSMS({
        to: '+919876543210',
        messageText: 'Your verification code is 123456',
      });
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toMatch(/^mock-sms-/);
      expect(res.isMock).toBe(true);
      expect(res.label).toContain('Demo mode');
    });
  });

  describe('Webhook HMAC-SHA256 Verification', () => {
    const appSecret = 'super_secret_meta_webhook_token_32chars';
    const rawPayload = JSON.stringify({ entry: [{ id: '12345', changes: [] }] });

    it('validates authentic webhook signature', () => {
      const sig = crypto.createHmac('sha256', appSecret).update(rawPayload).digest('hex');
      const header = `sha256=${sig}`;
      expect(verifyWhatsAppWebhookSignature(rawPayload, header, appSecret)).toBe(true);
    });

    it('rejects tampered or forged signature', () => {
      const badHeader = `sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;
      expect(verifyWhatsAppWebhookSignature(rawPayload, badHeader, appSecret)).toBe(false);
    });

    it('rejects when payload is missing or altered', () => {
      const sig = crypto.createHmac('sha256', appSecret).update(rawPayload).digest('hex');
      const header = `sha256=${sig}`;
      expect(verifyWhatsAppWebhookSignature('altered payload', header, appSecret)).toBe(false);
    });
  });

  describe('Anti-Leak Safe DTO Serializer', () => {
    it('serializes thread removing internal notes and margins', () => {
      const rawThread = {
        id: 'thread-001',
        channel: MessageChannel.EMAIL,
        subject: 'Senior Fullstack Role',
        lastMessageAt: new Date('2026-11-06T10:00:00Z'),
        unreadCount: 2,
        candidate: {
          id: 'cand-001',
          name: 'Vikram Seth',
          email: 'vikram@example.com',
          phone: '+91 9988776655',
          currentTitle: 'Staff Architect',
          currentCompany: 'GlobalTech',
          internalNotes: 'DO NOT HIRE - ASKS FOR 100 LPA',
          expectedSalary: 10000000,
        },
        job: {
          id: 'job-001',
          title: 'Lead Engineer',
          code: 'LEAD-2026-01',
          billRate: 3500,
          payRate: 2000,
          margin: 1500,
        },
      };

      const safe = serializeThreadSafe(rawThread);
      expect(safe.id).toBe('thread-001');
      expect(safe.channel).toBe(MessageChannel.EMAIL);
      expect(safe.candidate.name).toBe('Vikram Seth');
      expect((safe.candidate as any).internalNotes).toBeUndefined();
      expect((safe.candidate as any).expectedSalary).toBeUndefined();
      expect(safe.job?.title).toBe('Lead Engineer');
      expect((safe.job as any).billRate).toBeUndefined();
      expect((safe.job as any).margin).toBeUndefined();
    });
  });
});
