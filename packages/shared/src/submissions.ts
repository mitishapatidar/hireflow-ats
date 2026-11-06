import { z } from 'zod';
import { createHash } from 'crypto';

// ==========================================
// SUBMISSION ENUMS & CONSTANTS
// ==========================================

export enum SubmissionApprovalStatus {
  APPROVAL_NOT_REQUIRED = 'APPROVAL_NOT_REQUIRED',
  PENDING_MANAGER_APPROVAL = 'PENDING_MANAGER_APPROVAL',
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  REJECTED = 'REJECTED',
  APPROVAL_INVALIDATED = 'APPROVAL_INVALIDATED',
}

export enum SendState {
  NOT_SENT = 'NOT_SENT',
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// ==========================================
// CRITICAL PRIVACY & ANTI-LEAK ALLOW-LIST DTO
// ==========================================

export interface ExperienceHighlight {
  title: string;
  company: string;
  duration?: string;
  description?: string;
}

export interface EducationHighlight {
  degree: string;
  institution: string;
  year?: string;
}

export interface CustomProfileSection {
  title: string;
  content: string;
}

/**
 * Strict Client-Facing Standard Profile DTO (Figma Frame 29)
 *
 * CRITICAL PRIVACY RULES:
 * The client-facing profile MUST NEVER CONTAIN:
 * - Internal candidate notes
 * - Confidential recruiter notes
 * - Internal salary notes
 * - Candidate current salary
 * - Candidate expected salary
 * - Recruiter commission / margins
 * - Client commercial terms or placement fees
 * - Private interview panel feedback
 * - Internal rejection reasons / feedback
 * - Other clients' information
 * - Internal audit metadata
 */
export interface ClientFacingStandardProfileDTO {
  versionTag: string; // e.g. "S-241-v1"
  versionNumber: number;
  candidateName: string;
  candidateCode: string;
  headline: string;
  currentTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  professionalSummary: string;
  coreSkills: string[];
  experienceHighlights: ExperienceHighlight[];
  educationHighlights: EducationHighlight[];
  portfolioUrl: string | null;
  certifications?: string[];
  clientName: string;
  generatedDate: string;
}

/**
 * Strict allow-list profile sanitizer:
 * Strips all internal, financial, margin, and confidential fields.
 */
export function buildClientFacingProfile(raw: {
  versionTag: string;
  versionNumber: number;
  candidateName: string;
  candidateCode: string;
  headline?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  location?: string | null;
  summary?: string | null;
  selectedSkills?: string[] | null;
  experienceHighlights?: ExperienceHighlight[] | null;
  educationHighlights?: EducationHighlight[] | null;
  portfolioUrl?: string | null;
  certifications?: string[] | null;
  clientName: string;
  generatedDate?: string;
  // Dangerous fields that might be passed accidentally:
  [key: string]: any;
}): ClientFacingStandardProfileDTO {
  return {
    versionTag: String(raw.versionTag),
    versionNumber: Number(raw.versionNumber) || 1,
    candidateName: String(raw.candidateName || 'Candidate'),
    candidateCode: String(raw.candidateCode || ''),
    headline: String(raw.headline || raw.currentTitle || 'Experienced Professional'),
    currentTitle: raw.currentTitle ? String(raw.currentTitle) : null,
    currentCompany: raw.currentCompany ? String(raw.currentCompany) : null,
    location: raw.location ? String(raw.location) : null,
    professionalSummary: String(raw.summary || ''),
    coreSkills: Array.isArray(raw.selectedSkills) ? raw.selectedSkills.map(String) : [],
    experienceHighlights: Array.isArray(raw.experienceHighlights)
      ? raw.experienceHighlights.map((e) => ({
          title: String(e.title || ''),
          company: String(e.company || ''),
          duration: e.duration ? String(e.duration) : undefined,
          description: e.description ? String(e.description) : undefined,
        }))
      : [],
    educationHighlights: Array.isArray(raw.educationHighlights)
      ? raw.educationHighlights.map((ed) => ({
          degree: String(ed.degree || ''),
          institution: String(ed.institution || ''),
          year: ed.year ? String(ed.year) : undefined,
        }))
      : [],
    portfolioUrl: raw.portfolioUrl ? String(raw.portfolioUrl) : null,
    certifications: Array.isArray(raw.certifications) ? raw.certifications.map(String) : [],
    clientName: String(raw.clientName || ''),
    generatedDate: raw.generatedDate || new Date().toISOString().split('T')[0],
  };
}

/**
 * Computes deterministic SHA-256 hash of a standard profile snapshot.
 * Used for cryptographic binding between an approval and the exact profile content.
 */
export function computeProfileContentHash(profile: ClientFacingStandardProfileDTO): string {
  // Sort keys deterministically
  const canonicalString = JSON.stringify(profile, Object.keys(profile).sort());
  return createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Generates CV watermark string for a client
 * Format: "HIREFLOW / [CLIENT NAME] / [DATE]"
 */
export function generateCVWatermarkText(clientName: string, dateStr?: string): string {
  const dateFormatted =
    dateStr ||
    new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).toUpperCase();

  const cleanClient = (clientName || 'CLIENT').trim().toUpperCase();
  return `HIREFLOW / ${cleanClient} / ${dateFormatted}`;
}

// ==========================================
// ZOD SCHEMAS FOR API & SERVER ACTIONS
// ==========================================

export const CreateSubmissionSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  headline: z.string().max(200).optional(),
  summary: z.string().max(4000).optional(),
  selectedSkills: z.array(z.string()).default([]),
  experienceHighlights: z
    .array(
      z.object({
        title: z.string().min(1),
        company: z.string().min(1),
        duration: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  educationHighlights: z
    .array(
      z.object({
        degree: z.string().min(1),
        institution: z.string().min(1),
        year: z.string().optional(),
      })
    )
    .optional(),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
});
export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;

export const UpdateStandardProfileSchema = z.object({
  headline: z.string().max(200).optional(),
  summary: z.string().max(4000).optional(),
  selectedSkills: z.array(z.string()).default([]),
  experienceHighlights: z
    .array(
      z.object({
        title: z.string().min(1),
        company: z.string().min(1),
        duration: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  educationHighlights: z
    .array(
      z.object({
        degree: z.string().min(1),
        institution: z.string().min(1),
        year: z.string().optional(),
      })
    )
    .optional(),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  changeSummary: z.string().min(1, 'Change summary is required to create a new profile version').max(500),
});
export type UpdateStandardProfileInput = z.infer<typeof UpdateStandardProfileSchema>;

export const SendSubmissionSchema = z.object({
  recipientContactId: z.string().min(1, 'Target client contact recipient is required'),
  emailSubject: z.string().min(1).max(250).optional(),
  coverNote: z.string().max(3000).optional(),
});
export type SendSubmissionInput = z.infer<typeof SendSubmissionSchema>;

export const RequestApprovalSchema = z.object({
  comments: z.string().max(1000).optional(),
});
export type RequestApprovalInput = z.infer<typeof RequestApprovalSchema>;

export const ReviewApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']),
  comments: z.string().min(1, 'Comments are required when reviewing an approval').max(1000),
});
export type ReviewApprovalInput = z.infer<typeof ReviewApprovalSchema>;

export const SubmissionsQueryFiltersSchema = z.object({
  status: z
    .enum([
      'ALL',
      'AWAITING_APPROVAL',
      'APPROVED',
      'CHANGES_REQUESTED',
      'REJECTED',
      'APPROVAL_NOT_REQUIRED',
    ])
    .optional()
    .default('ALL'),
  search: z.string().optional(),
  clientId: z.string().optional(),
  jobId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SubmissionsQueryFilters = z.infer<typeof SubmissionsQueryFiltersSchema>;

// ==========================================
// SUBMISSION ROW DTO (FRAME 07)
// ==========================================

export interface SubmissionRowDTO {
  id: string;
  code: string;
  candidateId: string;
  candidateName: string;
  candidateCode: string;
  jobId: string;
  jobTitle: string;
  jobCode: string;
  jobStatus: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  matchPercentage: number;
  submittedByName: string;
  submittedAt: string;
  approvalStatus: SubmissionApprovalStatus;
  currentVersion: number;
  versionTag: string;
  sendState: string;
  sentAt: string | null;
  clientDecision: string | null;
}
