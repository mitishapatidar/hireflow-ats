import { z } from 'zod';
import crypto from 'crypto';

// ==========================================
// 1. ENUMS & CONSTANTS
// ==========================================

export enum CampaignChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RecipientDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  EXCLUDED = 'EXCLUDED',
}

export enum ExclusionReason {
  NO_EMAIL_CONSENT = 'NO_EMAIL_CONSENT',
  NO_SMS_CONSENT = 'NO_SMS_CONSENT',
  OPTED_OUT = 'OPTED_OUT',
  INVALID_FORMAT = 'INVALID_FORMAT',
  UNAUTHORIZED_SCOPE = 'UNAUTHORIZED_SCOPE',
  SUPPRESSED = 'SUPPRESSED',
  DUPLICATE = 'DUPLICATE',
  MISSING_CONTACT = 'MISSING_CONTACT',
}

export const APPROVED_EMAIL_SENDERS = [
  'careers@aurevacapital.com',
  'talent@aurevacapital.com',
  'notifications@hireflow.app',
];

export const DEFAULT_DLT_SENDER_ID = 'AURCAP';

// ==========================================
// 2. AUDIENCE FILTERS & SCHEMAS
// ==========================================

export const CampaignAudienceFilterSchema = z.object({
  tags: z.array(z.string()).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  locations: z.array(z.string()).optional().default([]),
  candidateScope: z.enum(['ALL', 'ASSIGNED_ONLY']).optional().default('ALL'),
  clientId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
  jobIds: z.array(z.string()).optional().default([]),
  search: z.string().optional().nullable(),
  query: z.string().optional().nullable(),
});

export type CampaignAudienceFilterInput = z.infer<typeof CampaignAudienceFilterSchema>;

export const CreateCampaignDraftSchema = z.object({
  name: z.string().min(3, 'Campaign name must be at least 3 characters').max(100).optional(),
  title: z.string().min(3, 'Campaign title must be at least 3 characters').max(100).optional(),
  channel: z.nativeEnum(CampaignChannel),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(10000).optional(),
  bodyHtml: z.string().max(10000).optional(),
  bodyText: z.string().max(10000).optional(),
  senderIdentity: z.string().max(100).optional().nullable(),
  replyTo: z.string().email().optional().nullable().or(z.literal('')),
  templateId: z.string().optional().nullable(),
  dltSenderId: z.string().optional().nullable(),
  dltTemplateId: z.string().optional().nullable(),
  dltEntityId: z.string().optional().nullable(),
  dltHeaderId: z.string().optional().nullable(),
  audienceFilters: CampaignAudienceFilterSchema.optional(),
  audienceFilter: z.any().optional(),
}).refine((data) => data.name || data.title, {
  message: 'Campaign name or title is required',
});

export type CreateCampaignDraftInput = z.infer<typeof CreateCampaignDraftSchema>;

export const UpdateCampaignDraftSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  title: z.string().min(3).max(100).optional(),
  channel: z.nativeEnum(CampaignChannel).optional(),
  subject: z.string().max(200).optional().nullable(),
  senderIdentity: z.string().max(100).optional().nullable(),
  replyTo: z.string().email().optional().nullable().or(z.literal('')),
  body: z.string().max(10000).optional(),
  bodyHtml: z.string().max(10000).optional(),
  bodyText: z.string().max(10000).optional(),
  dltSenderId: z.string().max(50).optional().nullable(),
  dltTemplateId: z.string().max(50).optional().nullable(),
  dltHeaderId: z.string().max(50).optional().nullable(),
  dltEntityId: z.string().max(50).optional().nullable(),
  templateId: z.string().optional().nullable(),
  audienceFilters: CampaignAudienceFilterSchema.optional(),
  audienceFilter: z.any().optional(),
  scheduledAt: z.union([z.string(), z.date()]).optional().nullable(),
});

export type UpdateCampaignDraftInput = z.infer<typeof UpdateCampaignDraftSchema>;

export const ScheduleCampaignSchema = z.object({
  scheduledAt: z.union([z.string(), z.date()]).optional().nullable(),
  sendNow: z.boolean().optional().default(false),
}).refine(
  (data) => data.sendNow || (data.scheduledAt && new Date(data.scheduledAt).getTime() > Date.now() - 60000),
  {
    message: 'Scheduled time must be in the future, or sendNow must be true',
  }
);

export type ScheduleCampaignInput = z.infer<typeof ScheduleCampaignSchema>;

export const SendTestCampaignSchema = z.object({
  channel: z.nativeEnum(CampaignChannel),
  recipient: z.string().min(3, 'Recipient address or phone number is required'),
  subject: z.string().optional().nullable(),
  body: z.string().max(10000).optional(),
  bodyHtml: z.string().max(10000).optional(),
  bodyText: z.string().max(10000).optional(),
  senderIdentity: z.string().optional().nullable(),
  dltHeaderId: z.string().optional().nullable(),
  dltSenderId: z.string().optional().nullable(),
  dltTemplateId: z.string().optional().nullable(),
});

export type SendTestCampaignInput = z.infer<typeof SendTestCampaignSchema>;

export const UnsubscribeSchema = z.object({
  token: z.string().optional(),
  reason: z.string().max(300).optional(),
  feedback: z.string().max(500).optional(),
  channel: z.nativeEnum(CampaignChannel).optional(),
});

export type UnsubscribeInput = z.infer<typeof UnsubscribeSchema>;

// ==========================================
// 3. INDIA SMS DLT & SEGMENT CALCULATOR
// ==========================================

export interface SmsSegmentDetails {
  characterCount: number;
  segmentCount: number;
  isUnicode: boolean;
  charactersPerSegment: number;
  remainingInSegment: number;
}

/**
 * Calculates SMS segments adhering to TRAI/GSM standards
 */
export function calculateSmsSegments(text: string): SmsSegmentDetails {
  if (!text) {
    return {
      characterCount: 0,
      segmentCount: 1,
      isUnicode: false,
      charactersPerSegment: 160,
      remainingInSegment: 160,
    };
  }

  // Check if text contains characters outside standard 7-bit GSM character set
  // Non-GSM characters trigger UCS-2 / Unicode encoding (max 70 chars / segment)
  const isUnicode = /[^\u0020-\u007E\u00A0-\u00FF\n\r]/.test(text);

  const characterCount = text.length;
  let singleMax = isUnicode ? 70 : 160;
  let multiMax = isUnicode ? 67 : 153;

  let segmentCount = 1;
  let remainingInSegment = singleMax - characterCount;

  if (characterCount > singleMax) {
    segmentCount = Math.ceil(characterCount / multiMax);
    remainingInSegment = segmentCount * multiMax - characterCount;
  }

  return {
    characterCount,
    segmentCount,
    isUnicode,
    charactersPerSegment: segmentCount > 1 ? multiMax : singleMax,
    remainingInSegment: Math.max(0, remainingInSegment),
  };
}

/**
 * Mandatory India TRAI DLT SMS Compliance Check
 */
export function validateSmsDltCompliance(params: {
  phone?: string | null;
  dltHeaderId?: string | null;
  dltSenderId?: string | null;
  dltTemplateId?: string | null;
  dltEntityId?: string | null;
  hasSmsConsent?: boolean;
}): { isCompliant: boolean; error?: string } {
  const { phone, dltHeaderId, dltSenderId, dltTemplateId, hasSmsConsent } = params;
  const header = (dltSenderId || dltHeaderId || '').trim();

  if (phone !== undefined) {
    if (!phone || phone.trim().length < 8) {
      return { isCompliant: false, error: 'Invalid or missing phone number' };
    }
  }

  if (hasSmsConsent !== undefined && !hasSmsConsent) {
    return { isCompliant: false, error: 'Recipient has not provided explicit SMS opt-in consent' };
  }

  if (!header) {
    return { isCompliant: false, error: 'Missing registered TRAI DLT Header/Sender ID' };
  }

  if (header.length > 6) {
    return { isCompliant: false, error: 'TRAI DLT Header/Sender ID must be 6 characters (e.g. AURCAP)' };
  }

  if (!dltTemplateId || dltTemplateId.trim().length === 0) {
    return { isCompliant: false, error: 'Missing approved TRAI DLT Content Template ID' };
  }

  if (dltTemplateId.trim().length < 10) {
    return { isCompliant: false, error: 'TRAI DLT Content Template ID must be a registered 19-digit numeric identifier' };
  }

  return { isCompliant: true };
}

// ==========================================
// 4. RECIPIENT ELIGIBILITY EVALUATOR
// ==========================================

export interface CandidateRecipientContext {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  ownerId?: string | null;
  emailMarketingOptIn?: boolean;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  isArchived?: boolean;
}

export interface RecipientEvaluationResult {
  candidateId: string;
  recipient: string;
  recipientName: string;
  isEligible: boolean;
  eligible?: boolean;
  exclusionReason?: ExclusionReason;
  reason?: ExclusionReason;
}

/**
 * Evaluates candidate eligibility for an Email or SMS campaign
 * Strictly enforces channel-specific consent, opt-out priority, and format validity
 */
export function evaluateRecipientEligibility(
  candidate: CandidateRecipientContext,
  channel: CampaignChannel,
  requestingUserId: string = '',
  userRole: string = 'ADMIN',
  candidateScope: 'ALL' | 'ASSIGNED_ONLY' = 'ALL'
): RecipientEvaluationResult {
  const name = candidate.name || 'Candidate';

  // 1. Scope Check: If recruiter is restricted to ASSIGNED_ONLY, verify ownership
  if (userRole === 'RECRUITER' && candidateScope === 'ASSIGNED_ONLY') {
    if (candidate.ownerId !== requestingUserId) {
      return {
        candidateId: candidate.id,
        recipient: candidate.email || candidate.phone || 'Unknown',
        recipientName: name,
        isEligible: false,
        eligible: false,
        exclusionReason: ExclusionReason.UNAUTHORIZED_SCOPE,
        reason: ExclusionReason.UNAUTHORIZED_SCOPE,
      };
    }
  }

  // 2. Archived candidate suppression
  if (candidate.isArchived) {
    return {
      candidateId: candidate.id,
      recipient: candidate.email || candidate.phone || 'Unknown',
      recipientName: name,
      isEligible: false,
      eligible: false,
      exclusionReason: ExclusionReason.SUPPRESSED,
      reason: ExclusionReason.SUPPRESSED,
    };
  }

  if (channel === CampaignChannel.EMAIL) {
    const email = candidate.email ? candidate.email.trim().toLowerCase() : '';

    // Format validation (RFC 5322 regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      const reason = email ? ExclusionReason.INVALID_FORMAT : ExclusionReason.MISSING_CONTACT;
      return {
        candidateId: candidate.id,
        recipient: email || 'Missing Email',
        recipientName: name,
        isEligible: false,
        eligible: false,
        exclusionReason: reason,
        reason,
      };
    }

    // Opt-out priority check
    if (candidate.emailMarketingOptIn === false) {
      return {
        candidateId: candidate.id,
        recipient: email,
        recipientName: name,
        isEligible: false,
        eligible: false,
        exclusionReason: ExclusionReason.OPTED_OUT,
        reason: ExclusionReason.OPTED_OUT,
      };
    }

    return {
      candidateId: candidate.id,
      recipient: email,
      recipientName: name,
      isEligible: true,
      eligible: true,
    };
  } else {
    // SMS Channel
    const phone = candidate.phone ? candidate.phone.trim() : '';

    if (!phone) {
      return {
        candidateId: candidate.id,
        recipient: 'Missing Phone',
        recipientName: name,
        isEligible: false,
        eligible: false,
        exclusionReason: ExclusionReason.MISSING_CONTACT,
        reason: ExclusionReason.MISSING_CONTACT,
      };
    }

    // Basic international / E.164 phone regex (at least 8 digits)
    const phoneDigits = phone.replace(/[^0-9]/g, '');
    if (phoneDigits.length < 8) {
      return {
        candidateId: candidate.id,
        recipient: phone,
        recipientName: name,
        isEligible: false,
        eligible: false,
        exclusionReason: ExclusionReason.INVALID_FORMAT,
        reason: ExclusionReason.INVALID_FORMAT,
      };
    }

    // Explicit SMS consent required. (Email or WhatsApp consent does NOT imply SMS consent)
    if (candidate.smsOptIn !== true) {
      return {
        candidateId: candidate.id,
        recipient: phone,
        recipientName: name,
        isEligible: false,
        eligible: false,
        exclusionReason: ExclusionReason.NO_SMS_CONSENT,
        reason: ExclusionReason.NO_SMS_CONSENT,
      };
    }

    return {
      candidateId: candidate.id,
      recipient: phone,
      recipientName: name,
      isEligible: true,
      eligible: true,
    };
  }
}

// ==========================================
// 5. CRYPTOGRAPHIC UNSUBSCRIBE TOKEN
// ==========================================

export function generateUnsubscribeToken(): string {
  if (crypto && typeof crypto.randomBytes === 'function') {
    return crypto.randomBytes(32).toString('hex');
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const array = new Uint8Array(32);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}
