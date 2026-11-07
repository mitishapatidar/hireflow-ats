import { describe, it, expect } from 'vitest';
import {
  CampaignChannel,
  ExclusionReason,
  calculateSmsSegments,
  validateSmsDltCompliance,
  evaluateRecipientEligibility,
  generateUnsubscribeToken,
  CandidateRecipientContext,
  isProtectedStage,
} from './index';

describe('Prompt 29: Bulk Campaigns & Consent Evaluation Tests', () => {
  const baseCandidate: CandidateRecipientContext = {
    id: 'cand-1',
    name: 'Aarav Sharma',
    email: 'aarav@example.com',
    phone: '+919876543210',
    ownerId: 'user-recruiter-1',
    emailMarketingOptIn: true,
    smsOptIn: true,
    whatsappOptIn: true,
    isArchived: false,
  };

  describe('1. Audience Eligibility & Cross-Channel Consent Isolation', () => {
    it('permits eligible recipient when email consent is present', () => {
      const res = evaluateRecipientEligibility(baseCandidate, CampaignChannel.EMAIL, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(true);
      expect(res.recipient).toBe('aarav@example.com');
      expect(res.exclusionReason).toBeUndefined();
    });

    it('excludes recipient when emailMarketingOptIn is false (Opted Out)', () => {
      const candidate = { ...baseCandidate, emailMarketingOptIn: false };
      const res = evaluateRecipientEligibility(candidate, CampaignChannel.EMAIL, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(false);
      expect(res.exclusionReason).toBe(ExclusionReason.OPTED_OUT);
    });

    it('excludes recipient with malformed email', () => {
      const candidate = { ...baseCandidate, email: 'not-an-email' };
      const res = evaluateRecipientEligibility(candidate, CampaignChannel.EMAIL, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(false);
      expect(res.exclusionReason).toBe(ExclusionReason.INVALID_FORMAT);
    });

    it('permits eligible recipient when SMS consent is explicitly present', () => {
      const res = evaluateRecipientEligibility(baseCandidate, CampaignChannel.SMS, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(true);
      expect(res.recipient).toBe('+919876543210');
      expect(res.exclusionReason).toBeUndefined();
    });

    it('strictly isolates channels: Email consent does NOT authorize SMS', () => {
      const candidate = { ...baseCandidate, emailMarketingOptIn: true, smsOptIn: false };
      const res = evaluateRecipientEligibility(candidate, CampaignChannel.SMS, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(false);
      expect(res.exclusionReason).toBe(ExclusionReason.NO_SMS_CONSENT);
    });

    it('strictly isolates channels: WhatsApp consent does NOT authorize SMS', () => {
      const candidate = { ...baseCandidate, whatsappOptIn: true, smsOptIn: false };
      const res = evaluateRecipientEligibility(candidate, CampaignChannel.SMS, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(false);
      expect(res.exclusionReason).toBe(ExclusionReason.NO_SMS_CONSENT);
    });

    it('excludes recipient when phone number is missing or invalid', () => {
      const candidate = { ...baseCandidate, phone: '123' };
      const res = evaluateRecipientEligibility(candidate, CampaignChannel.SMS, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(false);
      expect(res.exclusionReason).toBe(ExclusionReason.INVALID_FORMAT);
    });

    it('excludes candidate outside recruiter assigned scope when ASSIGNED_ONLY is active', () => {
      const candidate = { ...baseCandidate, ownerId: 'other-recruiter' };
      const res = evaluateRecipientEligibility(candidate, CampaignChannel.EMAIL, 'user-recruiter-1', 'RECRUITER', 'ASSIGNED_ONLY');
      expect(res.isEligible).toBe(false);
      expect(res.exclusionReason).toBe(ExclusionReason.UNAUTHORIZED_SCOPE);
    });

    it('suppresses archived candidates from campaigns', () => {
      const candidate = { ...baseCandidate, isArchived: true };
      const res = evaluateRecipientEligibility(candidate, CampaignChannel.EMAIL, 'user-recruiter-1', 'RECRUITER');
      expect(res.isEligible).toBe(false);
      expect(res.exclusionReason).toBe(ExclusionReason.SUPPRESSED);
    });
  });

  describe('2. India SMS DLT Compliance Verification', () => {
    it('approves compliance when header, template and consent are present', () => {
      const res = validateSmsDltCompliance({
        phone: '+919876543210',
        dltHeaderId: 'AURCAP',
        dltTemplateId: '1107161234567890',
        hasSmsConsent: true,
      });
      expect(res.isCompliant).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('blocks compliance when DLT Header ID is missing', () => {
      const res = validateSmsDltCompliance({
        phone: '+919876543210',
        dltHeaderId: '',
        dltTemplateId: '1107161234567890',
        hasSmsConsent: true,
      });
      expect(res.isCompliant).toBe(false);
      expect(res.error).toContain('Header');
    });

    it('blocks compliance when DLT Content Template ID is missing', () => {
      const res = validateSmsDltCompliance({
        phone: '+919876543210',
        dltHeaderId: 'AURCAP',
        dltTemplateId: '',
        hasSmsConsent: true,
      });
      expect(res.isCompliant).toBe(false);
      expect(res.error).toContain('Template');
    });

    it('blocks compliance when recipient lacks explicit SMS consent', () => {
      const res = validateSmsDltCompliance({
        phone: '+919876543210',
        dltHeaderId: 'AURCAP',
        dltTemplateId: '1107161234567890',
        hasSmsConsent: false,
      });
      expect(res.isCompliant).toBe(false);
      expect(res.error).toContain('SMS opt-in consent');
    });
  });

  describe('3. SMS Segment & Character Calculator', () => {
    it('calculates single GSM-7 segment up to 160 characters', () => {
      const text = 'Hello candidate, your interview is scheduled at Aureva Capital on Friday.';
      const seg = calculateSmsSegments(text);
      expect(seg.isUnicode).toBe(false);
      expect(seg.segmentCount).toBe(1);
      expect(seg.characterCount).toBe(text.length);
      expect(seg.remainingInSegment).toBe(160 - text.length);
    });

    it('calculates multi-segment GSM-7 (153 characters per segment)', () => {
      const longText = 'A'.repeat(161);
      const seg = calculateSmsSegments(longText);
      expect(seg.isUnicode).toBe(false);
      expect(seg.segmentCount).toBe(2);
      expect(seg.characterCount).toBe(161);
    });

    it('detects Unicode characters and reduces segment capacity to 70 characters', () => {
      const unicodeText = 'Hello Aarav 🚀 your interview is confirmed.';
      const seg = calculateSmsSegments(unicodeText);
      expect(seg.isUnicode).toBe(true);
      expect(seg.charactersPerSegment).toBe(70);
    });
  });

  describe('4. Cryptographic Unsubscribe Token Generator', () => {
    it('generates secure 64-character hexadecimal tokens', () => {
      const token1 = generateUnsubscribeToken();
      const token2 = generateUnsubscribeToken();
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
      expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
    });
  });

  describe('5. Protected Pipeline Stage Verification', () => {
    it('identifies Joined and Placed stages as protected', () => {
      expect(isProtectedStage('HIRED', 'Placed')).toBe(true);
      expect(isProtectedStage('PLACED', 'Joined Candidate')).toBe(true);
      expect(isProtectedStage('CUSTOM', 'Joined')).toBe(true);
      expect(isProtectedStage('CUSTOM', 'Placed')).toBe(true);
    });

    it('identifies non-terminal stages as unprotected', () => {
      expect(isProtectedStage('SOURCING', 'Sourced')).toBe(false);
      expect(isProtectedStage('SCREENING', 'Technical Screen')).toBe(false);
      expect(isProtectedStage('INTERVIEW', 'Client Final Round')).toBe(false);
      expect(isProtectedStage('CUSTOM', 'Custom Assessment')).toBe(false);
    });
  });
});
