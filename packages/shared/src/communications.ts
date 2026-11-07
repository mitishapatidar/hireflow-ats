import { z } from 'zod';
import crypto from 'crypto';

// ==========================================
// ENUMS & CONSTANTS
// ==========================================

export enum MessageChannel {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageDeliveryStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum TemplateCategory {
  OUTREACH = 'OUTREACH',
  INTERVIEW_INVITE = 'INTERVIEW_INVITE',
  REJECTION = 'REJECTION',
  OFFER = 'OFFER',
  FOLLOW_UP = 'FOLLOW_UP',
}

export enum TemplateStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProviderApprovalState {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CREDENTIALS_MISSING = 'CREDENTIALS_MISSING',
}

export enum IntegrationProvider {
  GMAIL = 'GMAIL',
  OUTLOOK = 'OUTLOOK',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
}

export enum ConnectionState {
  READY = 'READY',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SETUP_REQUIRED = 'SETUP_REQUIRED',
  CREDENTIALS_MISSING = 'CREDENTIALS_MISSING',
  CONSENT_PENDING = 'CONSENT_PENDING',
  DEMO_MODE = 'DEMO_MODE',
}

export const SUPPORTED_MERGE_FIELDS = [
  'first_name',
  'candidate_name',
  'client',
  'job_title',
  'round',
  'date',
  'time',
  'meeting_link',
  'recruiter_name',
  'task_title',
  'due_date',
] as const;

export type SupportedMergeField = typeof SUPPORTED_MERGE_FIELDS[number];

// ==========================================
// AES-256-GCM OAUTH TOKEN ENCRYPTION
// ==========================================

const DEFAULT_DEV_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getEncryptionKey(providedKey?: string): Buffer {
  const rawKey = providedKey || process.env.OAUTH_TOKEN_ENCRYPTION_KEY || DEFAULT_DEV_KEY;
  if (rawKey.length === 64) {
    return Buffer.from(rawKey, 'hex');
  }
  // If base64 or other string, derive 32 bytes with SHA-256
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts an OAuth token payload using AES-256-GCM with a fresh 12-byte IV.
 * Produces format: `ivHex:authTagHex:ciphertextHex`.
 */
export function encryptOAuthToken(plaintextToken: string, masterKey?: string): string {
  if (!plaintextToken) throw new Error('Token payload is required');
  const key = getEncryptionKey(masterKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintextToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token payload.
 * Verifies authentication tag integrity.
 */
export function decryptOAuthToken(encryptedPayload: string, masterKey?: string): string {
  if (!encryptedPayload) throw new Error('Encrypted payload is required');
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token payload format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey(masterKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ==========================================
// MERGE FIELDS RESOLUTION & PREVIEW ENGINE
// ==========================================

/**
 * Safely escapes HTML special characters to prevent stored or reflected XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface MergeFieldContext {
  first_name?: string | null;
  client?: string | null;
  round?: string | null;
  date?: string | null;
  time?: string | null;
  meeting_link?: string | null;
  recruiter_name?: string | null;
  [key: string]: string | null | undefined;
}

export interface RenderTemplateResult {
  rendered: string;
  missingFields: string[];
  hasWarnings: boolean;
}

/**
 * Renders template merge fields (e.g. {{first_name}} or {first_name}).
 * Detects missing variables and sanitizes inserted values.
 */
export function renderMergeFields(
  templateText: string,
  context: MergeFieldContext,
  isHtml: boolean = false
): RenderTemplateResult {
  if (!templateText) {
    return { rendered: '', missingFields: [], hasWarnings: false };
  }

  const missingFields: string[] = [];
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g;

  const rendered = templateText.replace(regex, (match, p1, p2) => {
    const fieldKey = (p1 || p2).toLowerCase();
    const value = context[fieldKey];

    if (value === undefined || value === null || value.trim() === '') {
      if (!missingFields.includes(fieldKey)) {
        missingFields.push(fieldKey);
      }
      return match; // preserve token for warning
    }

    return isHtml ? escapeHtml(value) : value;
  });

  return {
    rendered,
    missingFields,
    hasWarnings: missingFields.length > 0,
  };
}

// ==========================================
// SHARED TEAM SIGNATURE ENGINE
// ==========================================

export interface TeamSignatureContext {
  name: string;
  designation?: string | null;
  organizationName?: string | null;
  email: string;
  phone?: string | null;
  logoUrl?: string | null;
}

export function getDefaultSharedSignatureHtml(): string {
  return `<div style="font-family: Arial, sans-serif; font-size: 13px; color: #1B2236; margin-top: 24px; border-top: 1px solid #E6E8F0; padding-top: 16px;">
  <p style="margin: 0; font-weight: bold; color: #5B49D6; font-size: 14px;">{{name}}</p>
  <p style="margin: 2px 0 6px 0; color: #6B7490; font-size: 12px;">{{designation}} • {{organization}}</p>
  <p style="margin: 0; color: #1B2236; font-size: 12px;">Email: <a href="mailto:{{email}}" style="color: #5B49D6; text-decoration: none;">{{email}}</a></p>
  {{#phone}}<p style="margin: 2px 0 0 0; color: #1B2236; font-size: 12px;">Phone: {{phone}}</p>{{/phone}}
  <p style="margin: 12px 0 0 0; font-size: 11px; color: #6B7490; font-style: italic;">Aureva Capital Private Limited • Confidential</p>
</div>`;
}

/**
 * Injects sender profile data into the shared corporate email signature.
 * Note: Shared signature is STRICTLY applied to Email messages only. NEVER to WhatsApp!
 */
export function renderTeamSignature(
  rawSignatureHtml: string,
  user: TeamSignatureContext
): string {
  let rendered = rawSignatureHtml
    .replace(/\{\{\s*name\s*\}\}/g, escapeHtml(user.name))
    .replace(/\{\{\s*designation\s*\}\}/g, escapeHtml(user.designation || 'Talent Acquisition'))
    .replace(/\{\{\s*organization\s*\}\}/g, escapeHtml(user.organizationName || 'Aureva Capital'))
    .replace(/\{\{\s*email\s*\}\}/g, escapeHtml(user.email));

  if (user.phone) {
    rendered = rendered.replace(/\{\{\s*phone\s*\}\}/g, escapeHtml(user.phone));
    rendered = rendered.replace(/\{\{#phone\}\}([\s\S]*?)\{\{\/phone\}\}/g, '$1');
  } else {
    rendered = rendered.replace(/\{\{#phone\}\}[\s\S]*?\{\{\/phone\}\}/g, '');
  }

  return rendered;
}

// ==========================================
// WHATSAPP BUSINESS CLOUD API RULES
// ==========================================

export const WHATSAPP_SERVICE_WINDOW_HOURS = 24;

/**
 * Checks whether candidate's last inbound message is within the 24-hour customer service window.
 */
export function isWithinWhatsApp24hWindow(lastInboundAt?: Date | string | null): boolean {
  if (!lastInboundAt) return false;
  const lastTime = new Date(lastInboundAt).getTime();
  const diffMs = Date.now() - lastTime;
  return diffMs <= WHATSAPP_SERVICE_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * Validates whether a WhatsApp message can be sent given candidate opt-in and template rules.
 */
export function validateWhatsAppSend(params: {
  optIn: boolean;
  isTemplate: boolean;
  isTemplateApproved: boolean;
  lastInboundAt?: Date | string | null;
}): { allowed: boolean; error?: string } {
  if (!params.optIn) {
    return {
      allowed: false,
      error: 'Candidate has not opted in or has unsubscribed from WhatsApp communications.',
    };
  }

  const within24h = isWithinWhatsApp24hWindow(params.lastInboundAt);

  if (!within24h) {
    if (!params.isTemplate) {
      return {
        allowed: false,
        error:
          'Outside the 24-hour service window, only Meta-approved WhatsApp template messages can be sent.',
      };
    }
    if (!params.isTemplateApproved) {
      return {
        allowed: false,
        error:
          'Selected WhatsApp template is not approved by Meta. Unapproved templates cannot be sent outside the 24-hour window.',
      };
    }
  }

  return { allowed: true };
}

// ==========================================
// MOCK PROVIDER GENERATORS & WEBHOOK VERIFIERS
// ==========================================

export class MockEmailProvider {
  static sendEmail(params: { to: string; subject: string; bodyHtml: string }) {
    const id = `mock-email-${crypto.randomBytes(6).toString('hex')}`;
    return {
      success: true,
      providerMessageId: id,
      deliveryStatus: MessageDeliveryStatus.SENT,
      isMock: true,
      label: 'Demo mode (Prompt 25 connects live Gmail/Outlook OAuth)',
    };
  }
}

export class MockWhatsAppProvider {
  static sendWhatsApp(params: { to: string; messageText: string; templateId?: string }) {
    const id = `mock-wamid-${crypto.randomBytes(8).toString('hex')}`;
    return {
      success: true,
      providerMessageId: id,
      deliveryStatus: MessageDeliveryStatus.SENT,
      isMock: true,
      label: 'Demo mode (Prompt 25 connects live Meta WhatsApp Cloud API)',
    };
  }
}

export class MockSMSProvider {
  static sendSMS(params: { to: string; messageText: string }) {
    const id = `mock-sms-${crypto.randomBytes(6).toString('hex')}`;
    return {
      success: true,
      providerMessageId: id,
      deliveryStatus: MessageDeliveryStatus.SENT,
      isMock: true,
      label: 'Demo mode (India DLT & Twilio connect in Phase 3)',
    };
  }
}

/**
 * Verifies Meta WhatsApp Cloud API Webhook HMAC-SHA256 signature.
 */
export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret || !rawBody) return false;
  try {
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    const incomingSig = signatureHeader.replace(/^sha256=/, '');

    const bufExpected = Buffer.from(expectedSig, 'utf8');
    const bufIncoming = Buffer.from(incomingSig, 'utf8');

    if (bufExpected.length !== bufIncoming.length) return false;
    return crypto.timingSafeEqual(bufExpected, bufIncoming);
  } catch {
    return false;
  }
}

// ==========================================
// ANTI-LEAK PRIVACY DTO SERIALIZER
// ==========================================

export interface SafeThreadDTO {
  id: string;
  channel: MessageChannel;
  subject?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    currentTitle?: string | null;
    currentCompany?: string | null;
  };
  job?: {
    id: string;
    title: string;
    code: string;
  } | null;
}

export function serializeThreadSafe(thread: any): SafeThreadDTO {
  return {
    id: thread.id,
    channel: thread.channel,
    subject: thread.subject,
    lastMessageAt: thread.lastMessageAt instanceof Date ? thread.lastMessageAt.toISOString() : thread.lastMessageAt,
    unreadCount: thread.unreadCount || 0,
    candidate: {
      id: thread.candidate.id,
      name: thread.candidate.name,
      email: thread.candidate.email,
      phone: thread.candidate.phone,
      currentTitle: thread.candidate.currentTitle,
      currentCompany: thread.candidate.currentCompany,
    },
    job: thread.job ? {
      id: thread.job.id,
      title: thread.job.title,
      code: thread.job.code,
    } : null,
  };
}

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

export const SendEmailSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID is required'),
  jobId: z.string().optional().nullable(),
  subject: z.string().min(1, 'Subject line is required'),
  bodyHtml: z.string().min(1, 'Email body is required'),
  templateId: z.string().optional().nullable(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        size: z.number().optional(),
        mimeType: z.string().optional(),
      })
    )
    .optional(),
  saveAsDraft: z.boolean().default(false),
});

export const SendWhatsAppSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID is required'),
  jobId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  messageText: z.string().min(1, 'Message text is required'),
});

export const SendSMSSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID is required'),
  messageText: z.string().min(1, 'SMS text is required'),
});

export const CreateTemplateSchema = z.object({
  title: z.string().min(2, 'Template title must be at least 2 characters'),
  channel: z.nativeEnum(MessageChannel),
  category: z.nativeEnum(TemplateCategory).default(TemplateCategory.OUTREACH),
  subject: z.string().optional().nullable(),
  body: z.string().min(5, 'Template body must be at least 5 characters'),
  providerTemplateId: z.string().optional().nullable(),
  language: z.string().default('en'),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  status: z.nativeEnum(TemplateStatus).optional(),
  providerApprovalState: z.nativeEnum(ProviderApprovalState).optional(),
});

export const UpdateTeamSignatureSchema = z.object({
  signatureHtml: z.string().min(10, 'Signature HTML must be at least 10 characters'),
  designation: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
});
