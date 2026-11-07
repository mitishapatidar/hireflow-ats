import { z } from 'zod';
import crypto from 'crypto';

// ==========================================
// 1. BRANDING SCHEMAS & DEFAULTS
// ==========================================

export const CareersBrandingSchema = z.object({
  headline: z.string().min(1).max(150).default('Explore Open Technology Mandates'),
  introductoryCopy: z
    .string()
    .max(500)
    .default(
      'HireFlow partners with fast-growing venture-backed startups and enterprises to source top engineering and product talent.'
    ),
  brandPrimaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code')
    .default('#5B49D6'),
  brandSecondaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code')
    .default('#1E2A4A'),
  logoUrl: z.string().url().nullable().optional(),
  footerCopy: z.string().max(250).default('© 2026 Aureva Capital. Powered by HireFlow ATS.'),
});

export type CareersBrandingDTO = z.infer<typeof CareersBrandingSchema>;

export const DEFAULT_CAREERS_BRANDING: CareersBrandingDTO = {
  headline: 'Explore Open Technology Mandates',
  introductoryCopy:
    'HireFlow partners with fast-growing venture-backed startups and enterprises to source top engineering and product talent.',
  brandPrimaryColor: '#5B49D6',
  brandSecondaryColor: '#1E2A4A',
  logoUrl: null,
  footerCopy: '© 2026 Aureva Capital. Powered by HireFlow ATS.',
};

// ==========================================
// 2. PUBLIC JOB DTOs & SERIALIZATION
// ==========================================

export const PublicJobCardDTOSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  companyName: z.string(),
  isClientConfidential: z.boolean(),
  location: z.string().nullable(),
  employmentType: z.string(),
  openings: z.number().int().min(1),
  experienceMin: z.number().nullable(),
  experienceMax: z.number().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  isSalaryPublic: z.boolean(),
  requiredSkills: z.array(z.string()),
  shortDescription: z.string(),
  publishedAt: z.string().nullable(),
  deadline: z.string().nullable(),
});

export type PublicJobCardDTO = z.infer<typeof PublicJobCardDTOSchema>;

export const PublicJobDetailDTOSchema = PublicJobCardDTOSchema.extend({
  description: z.string().nullable(),
  requirements: z.string().nullable(),
});

export type PublicJobDetailDTO = z.infer<typeof PublicJobDetailDTOSchema>;

export const PublicJobQuerySchema = z.object({
  search: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type PublicJobQueryInput = z.infer<typeof PublicJobQuerySchema>;

/**
 * Checks whether a job satisfies all strict public publishing conditions:
 * - status = 'ACTIVE'
 * - isPublished = true
 * - isArchived = false
 * - not passed deadline (if deadline is set)
 */
export function isJobPubliclyEligible(job: {
  status: string;
  isPublished?: boolean | null;
  isArchived?: boolean | null;
  deadline?: Date | string | null;
}): boolean {
  if (job.status !== 'ACTIVE') return false;
  if (!job.isPublished) return false;
  if (job.isArchived) return false;
  if (job.deadline) {
    const deadlineTime = new Date(job.deadline).getTime();
    if (!isNaN(deadlineTime) && deadlineTime < Date.now()) {
      return false;
    }
  }
  return true;
}

/**
 * Strict allow-list serializer for public careers jobs.
 * Prevents leakage of internal margins, recruiter names, commercial fees,
 * approval histories, or internal candidate metrics.
 */
export function serializePublicJob(job: any): PublicJobDetailDTO | null {
  if (!job || !isJobPubliclyEligible(job)) {
    return null;
  }

  const isClientConfidential = Boolean(job.hideClientName);
  const companyName = isClientConfidential
    ? 'Confidential client'
    : job.client?.legalName || job.clientName || 'Hiring Partner';

  const isSalaryPublic = Boolean(job.isSalaryPublic);
  const salaryMin = isSalaryPublic && job.salaryMin != null ? Number(job.salaryMin) : null;
  const salaryMax = isSalaryPublic && job.salaryMax != null ? Number(job.salaryMax) : null;

  // Extract short description (first 160 characters stripped of markdown / extra whitespace)
  const fullDesc = (job.description || '').replace(/[\r\n]+/g, ' ').trim();
  const shortDescription =
    fullDesc.length > 160 ? `${fullDesc.slice(0, 157)}...` : fullDesc || 'No summary available';

  return {
    id: job.id,
    code: job.code,
    title: job.title,
    companyName,
    isClientConfidential,
    location: job.location || null,
    employmentType: job.employmentType || 'FULL_TIME',
    openings: Number(job.openings) || 1,
    experienceMin: job.experienceMin != null ? Number(job.experienceMin) : null,
    experienceMax: job.experienceMax != null ? Number(job.experienceMax) : null,
    salaryMin,
    salaryMax,
    isSalaryPublic,
    requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills : [],
    shortDescription,
    description: job.description || null,
    requirements: job.requirements || null,
    publishedAt: job.publishedAt ? new Date(job.publishedAt).toISOString() : null,
    deadline: job.deadline ? new Date(job.deadline).toISOString() : null,
  };
}

// ==========================================
// 3. APPLICATION & DRAFT SCHEMAS
// ==========================================

export const PublicApplySchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s.'-]+$/, 'Full name contains invalid characters'),
  email: z.string().email('Please enter a valid email address').max(100),
  phone: z
    .string()
    .min(7, 'Phone number must be at least 7 digits')
    .max(20, 'Phone number cannot exceed 20 characters')
    .regex(/^[+0-9\s()-]+$/, 'Please enter a valid phone number'),
  currentLocation: z.string().min(2, 'Current location is required').max(100),
  experienceYears: z.coerce
    .number()
    .min(0, 'Experience years cannot be negative')
    .max(50, 'Experience years cannot exceed 50'),
  portfolioUrl: z
    .string()
    .url('Please enter a valid URL (e.g. https://github.com/...)')
    .max(250)
    .optional()
    .or(z.literal(''))
    .nullable(),
  resumeKey: z.string().min(1, 'Please upload your resume'),
  resumeFileName: z.string().min(1, 'Resume file name is required'),
  resumeFileSize: z.number().int().positive('Invalid file size'),
  additionalNote: z.string().max(1000, 'Additional note cannot exceed 1000 characters').optional().nullable(),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'You must consent to data processing to submit your application' }),
  }),
  // Security honeypot & captcha
  website_url_hp: z.string().optional().nullable(),
  captchaToken: z.string().min(1, 'CAPTCHA verification is required'),
  draftToken: z.string().optional().nullable(),
});

export type PublicApplyInput = z.infer<typeof PublicApplySchema>;

export const SaveApplicationDraftSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  draftToken: z.string().optional().nullable(),
  formData: z.object({
    fullName: z.string().max(100).optional().nullable(),
    email: z.string().max(100).optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    currentLocation: z.string().max(100).optional().nullable(),
    experienceYears: z.coerce.number().min(0).max(50).optional().nullable(),
    portfolioUrl: z.string().max(250).optional().nullable(),
    additionalNote: z.string().max(1000).optional().nullable(),
    consentGiven: z.boolean().optional(),
    resumeFileName: z.string().optional().nullable(),
    resumeFileSize: z.number().optional().nullable(),
  }),
  resumeKey: z.string().optional().nullable(),
});

export type SaveApplicationDraftInput = z.infer<typeof SaveApplicationDraftSchema>;

/**
 * Generates a cryptographically random 64-character hex token for draft resumption
 */
export function generateDraftToken(): string {
  if (crypto && typeof crypto.randomBytes === 'function') {
    return crypto.randomBytes(32).toString('hex');
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const array = new Uint8Array(32);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

/**
 * Generates human-readable application reference number
 * Example: APP-J-201-B7E28A19
 */
export function generateApplicationReference(jobCode: string, applicationId: string): string {
  const cleanCode = (jobCode || 'JOB').toUpperCase();
  const hexPart = applicationId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `APP-${cleanCode}-${hexPart}`;
}
