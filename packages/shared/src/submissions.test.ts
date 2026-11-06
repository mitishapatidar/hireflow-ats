import { describe, it, expect } from 'vitest';
import {
  buildClientFacingProfile,
  computeProfileContentHash,
  generateCVWatermarkText,
  CreateSubmissionSchema,
  UpdateStandardProfileSchema,
  SendSubmissionSchema,
  ClientFacingStandardProfileDTO,
} from './submissions';

describe('Client Submissions & Standard Profile Domain Tests (Prompt 13)', () => {
  describe('Critical Privacy & Anti-Leak Allow-List Sanitization', () => {
    it('1. strictly strips forbidden internal fields from client-facing profile', () => {
      // Simulate raw candidate object containing private and confidential fields
      const rawPayload = {
        versionTag: 'S-241-v1',
        versionNumber: 1,
        candidateName: 'Aarav Shah',
        candidateCode: 'C-0001',
        headline: 'Staff Frontend Architect',
        currentTitle: 'Lead Software Engineer',
        currentCompany: 'Tech Corp',
        location: 'Bengaluru, India',
        summary: 'Experienced web architect specializing in micro-frontends.',
        selectedSkills: ['TypeScript', 'React', 'Next.js'],
        experienceHighlights: [
          { title: 'Lead Architect', company: 'Tech Corp', duration: '2021–Present' },
        ],
        educationHighlights: [
          { degree: 'B.Tech CS', institution: 'IIT Bombay', year: '2016' },
        ],
        portfolioUrl: 'https://aarav.dev',
        clientName: 'Aureva Capital',

        // FORBIDDEN PRIVATE FIELDS THAT MUST BE STRIPPED:
        internalCandidateNotes: 'Demands high hike, seems difficult in negotiations',
        confidentialRecruiterNotes: 'Agency margin is 22% on placement',
        candidateCurrentSalary: 2800000,
        candidateExpectedSalary: 3800000,
        recruiterCommission: 83600,
        clientCommercialTerms: 'Net 30 with 20% placement fee',
        placementFee: 760000,
        internalMarginCalculation: 'Margin ₹1,67,200',
        privateInterviewPanelFeedback: 'Strong candidate but asked tough questions about culture',
        internalRejectionFeedback: 'Not applicable',
        otherClientsInformation: 'Also interviewing at Starlight Tech',
        privateAuditMetadata: { ip: '192.168.1.1', userAgent: 'Chrome' },
      };

      const sanitized: ClientFacingStandardProfileDTO = buildClientFacingProfile(rawPayload);

      // Verify allowed fields exist
      expect(sanitized.candidateName).toBe('Aarav Shah');
      expect(sanitized.candidateCode).toBe('C-0001');
      expect(sanitized.headline).toBe('Staff Frontend Architect');
      expect(sanitized.clientName).toBe('Aureva Capital');
      expect(sanitized.coreSkills).toEqual(['TypeScript', 'React', 'Next.js']);

      // CRITICAL: Ensure forbidden fields are strictly undefined
      const sanitizedAny = sanitized as Record<string, any>;
      expect(sanitizedAny.internalCandidateNotes).toBeUndefined();
      expect(sanitizedAny.confidentialRecruiterNotes).toBeUndefined();
      expect(sanitizedAny.candidateCurrentSalary).toBeUndefined();
      expect(sanitizedAny.candidateExpectedSalary).toBeUndefined();
      expect(sanitizedAny.recruiterCommission).toBeUndefined();
      expect(sanitizedAny.clientCommercialTerms).toBeUndefined();
      expect(sanitizedAny.placementFee).toBeUndefined();
      expect(sanitizedAny.internalMarginCalculation).toBeUndefined();
      expect(sanitizedAny.privateInterviewPanelFeedback).toBeUndefined();
      expect(sanitizedAny.internalRejectionFeedback).toBeUndefined();
      expect(sanitizedAny.otherClientsInformation).toBeUndefined();
      expect(sanitizedAny.privateAuditMetadata).toBeUndefined();
    });

    it('2. ensures serialized JSON string does not contain forbidden keywords', () => {
      const rawPayload = {
        versionTag: 'S-241-v1',
        versionNumber: 1,
        candidateName: 'Priya Sharma',
        candidateCode: 'C-0002',
        clientName: 'Aureva Capital',
        summary: 'Product engineering manager.',
        selectedSkills: ['Management', 'Agile'],
        // Leaked attributes:
        margin: '25% margin',
        expectedSalary: '45,00,000 INR',
        privateNote: 'Do not tell client about gap in 2020',
      };

      const sanitized = buildClientFacingProfile(rawPayload);
      const jsonOutput = JSON.stringify(sanitized);

      expect(jsonOutput).not.toContain('margin');
      expect(jsonOutput).not.toContain('45,00,000');
      expect(jsonOutput).not.toContain('gap in 2020');
      expect(jsonOutput).not.toContain('privateNote');
    });
  });

  describe('Content Hash & Cryptographic Approval Binding', () => {
    it('3. generates a 64-character SHA-256 hash for a profile snapshot', () => {
      const profile = buildClientFacingProfile({
        versionTag: 'S-241-v1',
        versionNumber: 1,
        candidateName: 'Aarav Shah',
        candidateCode: 'C-0001',
        clientName: 'Aureva Capital',
      });

      const hash1 = computeProfileContentHash(profile);
      expect(hash1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);

      // Deterministic: same profile yields exact same hash
      const hash2 = computeProfileContentHash(profile);
      expect(hash1).toBe(hash2);
    });

    it('4. detects profile content modification with an altered hash', () => {
      const profileOriginal = buildClientFacingProfile({
        versionTag: 'S-241-v1',
        versionNumber: 1,
        candidateName: 'Aarav Shah',
        candidateCode: 'C-0001',
        summary: 'Original summary',
        clientName: 'Aureva Capital',
      });

      const profileEdited = buildClientFacingProfile({
        versionTag: 'S-241-v2',
        versionNumber: 2,
        candidateName: 'Aarav Shah',
        candidateCode: 'C-0001',
        summary: 'Updated summary by recruiter',
        clientName: 'Aureva Capital',
      });

      const hashOriginal = computeProfileContentHash(profileOriginal);
      const hashEdited = computeProfileContentHash(profileEdited);

      expect(hashOriginal).not.toBe(hashEdited);
    });
  });

  describe('Client CV Watermark Generator', () => {
    it('5. formats watermark using HIREFLOW / [CLIENT NAME] / [DATE] pattern', () => {
      const wm = generateCVWatermarkText('Aureva Capital', '06 NOV 2026');
      expect(wm).toBe('HIREFLOW / AUREVA CAPITAL / 06 NOV 2026');
    });

    it('6. handles default uppercase and trimmed client names', () => {
      const wm = generateCVWatermarkText('   Acme Global Partners   ', '12 DEC 2026');
      expect(wm).toBe('HIREFLOW / ACME GLOBAL PARTNERS / 12 DEC 2026');
    });
  });

  describe('Validation Schemas', () => {
    it('7. validates profile update requires changeSummary for versioning', () => {
      const invalid = UpdateStandardProfileSchema.safeParse({
        headline: 'New headline',
        // missing changeSummary
      });
      expect(invalid.success).toBe(false);

      const valid = UpdateStandardProfileSchema.safeParse({
        headline: 'New headline',
        changeSummary: 'Updated headline to highlight architecture leadership',
      });
      expect(valid.success).toBe(true);
    });

    it('8. validates send submission requires recipient contact ID', () => {
      const res = SendSubmissionSchema.safeParse({
        recipientContactId: 'contact-01',
        emailSubject: 'Candidate Presentation: Aarav Shah for Staff Architect',
      });
      expect(res.success).toBe(true);
    });
  });
});
