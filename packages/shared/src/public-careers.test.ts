import { describe, it, expect } from 'vitest';
import {
  isJobPubliclyEligible,
  serializePublicJob,
  PublicApplySchema,
  generateDraftToken,
  generateApplicationReference,
  DEFAULT_CAREERS_BRANDING,
  CareersBrandingSchema,
} from './public-careers';
import {
  MockCaptchaProvider,
  validateHoneypot,
} from './security/captcha';

describe('Prompt 28: Public Careers & Application Workflow Unit Tests', () => {
  const baseEligibleJob = {
    id: 'job-101',
    code: 'J-201',
    title: 'Staff Frontend Architect',
    description: 'Lead architecture for Next.js, micro-frontends, high-concurrency dashboard.',
    requirements: '7+ years React, TypeScript, Next.js architecture experience.',
    employmentType: 'FULL_TIME',
    openings: 2,
    location: 'Bengaluru / Hybrid',
    salaryMin: 3500000,
    salaryMax: 4500000,
    requiredSkills: ['React', 'TypeScript', 'Next.js'],
    status: 'ACTIVE',
    isPublished: true,
    publishedAt: new Date('2026-11-01T10:00:00Z'),
    hideClientName: false,
    isSalaryPublic: true,
    isArchived: false,
    client: { legalName: 'Acme Technologies' },
    // Internal fields that MUST NEVER leak:
    ownerId: 'user-recruiter-1',
    owner: { name: 'Anika Recruiter', email: 'anika@hireflow.internal' },
    closingNote: 'Client agreed to 8.5% fee margin',
    commercialFeePercentage: 8.5,
  };

  describe('1. Job Publishing Eligibility Rules', () => {
    it('approves an active, published, unarchived job', () => {
      expect(isJobPubliclyEligible(baseEligibleJob)).toBe(true);
    });

    it('rejects DRAFT jobs', () => {
      expect(isJobPubliclyEligible({ ...baseEligibleJob, status: 'DRAFT' })).toBe(false);
    });

    it('rejects PAUSED jobs', () => {
      expect(isJobPubliclyEligible({ ...baseEligibleJob, status: 'PAUSED' })).toBe(false);
    });

    it('rejects CLOSED jobs', () => {
      expect(isJobPubliclyEligible({ ...baseEligibleJob, status: 'CLOSED' })).toBe(false);
    });

    it('rejects ACTIVE jobs when isPublished is false', () => {
      expect(isJobPubliclyEligible({ ...baseEligibleJob, isPublished: false })).toBe(false);
    });

    it('rejects archived jobs', () => {
      expect(isJobPubliclyEligible({ ...baseEligibleJob, isArchived: true })).toBe(false);
    });

    it('rejects jobs whose deadline has passed', () => {
      const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isJobPubliclyEligible({ ...baseEligibleJob, deadline: pastDeadline })).toBe(false);
    });

    it('accepts jobs whose deadline is in the future', () => {
      const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(isJobPubliclyEligible({ ...baseEligibleJob, deadline: futureDeadline })).toBe(true);
    });
  });

  describe('2. Public Job Serialization & Anti-Data-Leak Guarantees', () => {
    it('serializes public job and completely scrubs internal fields', () => {
      const serialized = serializePublicJob(baseEligibleJob);
      expect(serialized).not.toBeNull();
      expect(serialized?.id).toBe('job-101');
      expect(serialized?.code).toBe('J-201');
      expect(serialized?.title).toBe('Staff Frontend Architect');
      expect(serialized?.companyName).toBe('Acme Technologies');
      expect(serialized?.salaryMin).toBe(3500000);
      expect(serialized?.salaryMax).toBe(4500000);

      // Verify strict omission of internal recruiter/commercial data
      expect((serialized as any).ownerId).toBeUndefined();
      expect((serialized as any).owner).toBeUndefined();
      expect((serialized as any).closingNote).toBeUndefined();
      expect((serialized as any).commercialFeePercentage).toBeUndefined();
    });

    it('masks client name as "Confidential client" when hideClientName is true', () => {
      const confidentialJob = {
        ...baseEligibleJob,
        hideClientName: true,
      };
      const serialized = serializePublicJob(confidentialJob);
      expect(serialized?.companyName).toBe('Confidential client');
      expect(serialized?.isClientConfidential).toBe(true);
      expect(JSON.stringify(serialized)).not.toContain('Acme Technologies');
    });

    it('hides salary range when isSalaryPublic is false', () => {
      const privateSalaryJob = {
        ...baseEligibleJob,
        isSalaryPublic: false,
      };
      const serialized = serializePublicJob(privateSalaryJob);
      expect(serialized?.salaryMin).toBeNull();
      expect(serialized?.salaryMax).toBeNull();
      expect(serialized?.isSalaryPublic).toBe(false);
    });

    it('returns null for an ineligible or unpublished job', () => {
      expect(serializePublicJob({ ...baseEligibleJob, isPublished: false })).toBeNull();
      expect(serializePublicJob({ ...baseEligibleJob, status: 'PAUSED' })).toBeNull();
    });

    it('truncates shortDescription cleanly to 160 characters', () => {
      const longJob = {
        ...baseEligibleJob,
        description: 'A'.repeat(250),
      };
      const serialized = serializePublicJob(longJob);
      expect(serialized?.shortDescription.length).toBeLessThanOrEqual(160);
      expect(serialized?.shortDescription.endsWith('...')).toBe(true);
    });
  });

  describe('3. Application Validation Schema', () => {
    const validApplication = {
      jobId: 'job-101',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      phone: '+91 98765 43210',
      currentLocation: 'Bengaluru, India',
      experienceYears: 6.5,
      portfolioUrl: 'https://github.com/aaravsharma',
      resumeKey: 'resumes/abc-123.pdf',
      resumeFileName: 'Aarav_Sharma_Resume.pdf',
      resumeFileSize: 1024 * 500,
      additionalNote: 'Excited about the Next.js platform mandate.',
      consentGiven: true,
      captchaToken: 'mock-captcha-token',
    };

    it('accepts valid public application input', () => {
      const result = PublicApplySchema.safeParse(validApplication);
      expect(result.success).toBe(true);
    });

    it('rejects application when consentGiven is false', () => {
      const result = PublicApplySchema.safeParse({
        ...validApplication,
        consentGiven: false,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email address', () => {
      const result = PublicApplySchema.safeParse({
        ...validApplication,
        email: 'invalid-email-address',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative experience years', () => {
      const result = PublicApplySchema.safeParse({
        ...validApplication,
        experienceYears: -2,
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing resume key', () => {
      const result = PublicApplySchema.safeParse({
        ...validApplication,
        resumeKey: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('4. Tokens & Application Reference Generation', () => {
    it('generates a 64-character cryptographically secure hex draft token', () => {
      const token = generateDraftToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('generates clean human-readable application reference number', () => {
      const ref = generateApplicationReference('J-201', 'e2b7a489-3d12-4c55-90af-6bcde1234567');
      expect(ref).toBe('APP-J-201-E2B7A489');
    });
  });

  describe('5. Security Honeypot & CAPTCHA Provider', () => {
    it('validates empty honeypot as clean human submission', () => {
      expect(validateHoneypot('')).toBe(true);
      expect(validateHoneypot(null)).toBe(true);
      expect(validateHoneypot(undefined)).toBe(true);
    });

    it('flags populated honeypot as automated bot submission', () => {
      expect(validateHoneypot('http://spam-link.ru')).toBe(false);
      expect(validateHoneypot('spam text')).toBe(false);
    });

    it('mock CAPTCHA provider verifies standard token', async () => {
      const provider = new MockCaptchaProvider();
      const res = await provider.verify('mock-captcha-token');
      expect(res.success).toBe(true);
      expect(res.isMock).toBe(true);
    });

    it('mock CAPTCHA provider rejects bot or empty token', async () => {
      const provider = new MockCaptchaProvider();
      const resEmpty = await provider.verify('');
      expect(resEmpty.success).toBe(false);

      const resBot = await provider.verify('bot-token');
      expect(resBot.success).toBe(false);
      expect(resBot.error).toContain('Automated bot detected');
    });
  });

  describe('6. Careers Branding Schema & Defaults', () => {
    it('provides sensible Figma-approved defaults', () => {
      expect(DEFAULT_CAREERS_BRANDING.brandPrimaryColor).toBe('#5B49D6');
      expect(DEFAULT_CAREERS_BRANDING.brandSecondaryColor).toBe('#1E2A4A');
      expect(DEFAULT_CAREERS_BRANDING.headline).toBe('Explore Open Technology Mandates');
    });

    it('validates valid branding overrides', () => {
      const parsed = CareersBrandingSchema.safeParse({
        headline: 'Join Aureva Capital Engineering',
        introductoryCopy: 'We are hiring top talent.',
        brandPrimaryColor: '#5B49D6',
        brandSecondaryColor: '#1E2A4A',
        footerCopy: '© 2026 Aureva Capital',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid hex color codes', () => {
      const parsed = CareersBrandingSchema.safeParse({
        brandPrimaryColor: 'not-a-color',
      });
      expect(parsed.success).toBe(false);
    });
  });
});
