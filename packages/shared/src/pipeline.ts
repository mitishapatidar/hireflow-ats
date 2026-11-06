import { z } from 'zod';
import { UserRole } from './roles';
import { JobStatus } from './jobs';

// Re-export for shared consumers
export { UserRole, JobStatus };

export enum ApplicationStatus {
  SOURCED = 'SOURCED',
  SCREENING = 'SCREENING',
  INTERVIEW = 'INTERVIEW',
  TECHNICAL = 'TECHNICAL',
  CLIENT_REVIEW = 'CLIENT_REVIEW',
  OFFER = 'OFFER',
  PLACED = 'PLACED',
  REJECTED = 'REJECTED',
}

// ==========================================
// CONSTANTS & DEFAULT STAGES
// ==========================================

export interface DefaultStageDefinition {
  id: string;
  name: string;
  stageType: ApplicationStatus;
  order: number;
}

export const DEFAULT_PIPELINE_STAGES: DefaultStageDefinition[] = [
  { id: 'stage-sourced', name: 'Sourced', stageType: ApplicationStatus.SOURCED, order: 1 },
  { id: 'stage-screening', name: 'Screening', stageType: ApplicationStatus.SCREENING, order: 2 },
  { id: 'stage-interview', name: 'Interview', stageType: ApplicationStatus.INTERVIEW, order: 3 },
  { id: 'stage-technical', name: 'Technical', stageType: ApplicationStatus.TECHNICAL, order: 4 },
  { id: 'stage-client-review', name: 'Client Review', stageType: ApplicationStatus.CLIENT_REVIEW, order: 5 },
  { id: 'stage-offer', name: 'Offer', stageType: ApplicationStatus.OFFER, order: 6 },
  { id: 'stage-placed', name: 'Placed', stageType: ApplicationStatus.PLACED, order: 7 },
  { id: 'stage-rejected', name: 'Rejected', stageType: ApplicationStatus.REJECTED, order: 8 },
];

export interface DefaultRejectionReason {
  code: string;
  reason: string;
  category: string;
}

export const DEFAULT_REJECTION_REASONS: DefaultRejectionReason[] = [
  { code: 'SKILLS_MISMATCH', reason: 'Skills or Technical Competency Mismatch', category: 'QUALIFICATIONS' },
  { code: 'EXPERIENCE_INSUFFICIENT', reason: 'Insufficient Domain/Industry Experience', category: 'QUALIFICATIONS' },
  { code: 'SALARY_EXPECTATION', reason: 'Compensation Expectations Beyond Budget', category: 'COMPENSATION' },
  { code: 'LOCATION_UNAVAILABLE', reason: 'Unable to Relocate or Non-Hybrid Match', category: 'LOGISTICS' },
  { code: 'NOTICE_PERIOD', reason: 'Notice Period Too Long (> 60 Days)', category: 'TIMELINE' },
  { code: 'OFFER_DECLINED_BY_CANDIDATE', reason: 'Candidate Declined Offer / Counter-Offer Accepted', category: 'CANDIDATE_WITHDREW' },
  { code: 'POOR_CULTURE_FIT', reason: 'Culture & Working Style Alignment', category: 'INTERVIEW_FEEDBACK' },
  { code: 'FAILED_BACKGROUND_CHECK', reason: 'Background Verification Discrepancy', category: 'COMPLIANCE' },
  { code: 'OTHER', reason: 'Other / General Assessment', category: 'GENERAL' },
];

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

export const TransitionApplicationStageSchema = z.object({
  targetStageId: z.string().min(1, 'Target stage is required'),
  comments: z.string().max(1000).optional().nullable(),
  rejectionReasonId: z.string().min(1).optional().nullable(),
  rejectionFeedback: z.string().max(2000).optional().nullable(),
});
export type TransitionApplicationStageInput = z.infer<typeof TransitionApplicationStageSchema>;

export const RejectApplicationSchema = z.object({
  rejectionReasonId: z.string().min(1, 'Rejection reason is required'),
  rejectionFeedback: z.string().min(3, 'Internal feedback must be at least 3 characters').max(2000),
  candidateMessagePreview: z.string().max(2000).optional().nullable(),
});
export type RejectApplicationInput = z.infer<typeof RejectApplicationSchema>;

export const AddCandidateToJobSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID is required'),
  initialStageId: z.string().min(1).optional().nullable(),
});
export type AddCandidateToJobInput = z.infer<typeof AddCandidateToJobSchema>;

export const CreateApplicationNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(2000),
});
export type CreateApplicationNoteInput = z.infer<typeof CreateApplicationNoteSchema>;

export const PipelineColumnQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PipelineColumnQuery = z.infer<typeof PipelineColumnQuerySchema>;

// ==========================================
// STATE MACHINE & TRANSITION VALIDATION
// ==========================================

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether an application can transition to a target stage given the job's lifecycle status.
 */
export function canTransitionApplicationStage(
  currentStatus: ApplicationStatus,
  targetStageType: ApplicationStatus,
  jobStatus: JobStatus
): TransitionValidationResult {
  // 1. Job Lifecycle rule: If job is PAUSED or CLOSED, operational stage changes are strictly blocked.
  if (jobStatus === JobStatus.PAUSED) {
    return {
      allowed: false,
      reason: 'Job mandate is currently on hold (PAUSED). Stage movements are blocked until the job is resumed.',
    };
  }

  if (jobStatus === JobStatus.CLOSED) {
    return {
      allowed: false,
      reason: 'Job mandate is CLOSED. Operational candidate movements are not permitted.',
    };
  }

  if (jobStatus === JobStatus.DRAFT || jobStatus === JobStatus.PENDING_APPROVAL) {
    return {
      allowed: false,
      reason: `Job mandate is in ${jobStatus} status. It must be ACTIVE before advancing candidates.`,
    };
  }

  // 2. Identity transition: No-op
  if (currentStatus === targetStageType) {
    return { allowed: true };
  }

  // 3. Placed applications cannot be casually moved back unless reopening
  if (currentStatus === ApplicationStatus.PLACED && targetStageType !== ApplicationStatus.PLACED) {
    return {
      allowed: false,
      reason: 'Candidate has already been PLACED. Placements cannot be reversed via standard pipeline drag-and-drop.',
    };
  }

  // 4. Any active candidate can be rejected
  if (targetStageType === ApplicationStatus.REJECTED) {
    return { allowed: true };
  }

  // 5. From Rejected back to pipeline (Reactivation/Reconsideration)
  if (currentStatus === ApplicationStatus.REJECTED) {
    return {
      allowed: true,
      reason: 'Candidate reconsidered and reactivated into the pipeline.',
    };
  }

  // 6. Normal progression/regression between active pipeline stages is allowed for agency recruiters
  return { allowed: true };
}

// ==========================================
// ANTI-LEAK SERIALIZATION & DTOS
// ==========================================

export interface PipelineCardDTO {
  id: string; // applicationId
  candidateId: string;
  candidateCode: string;
  name: string;
  currentTitle: string | null;
  currentCompany: string | null;
  experienceYears: number | null;
  expectedSalary: string | null;
  location: string | null;
  skills: string[];
  stageId: string | null;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  ownerName: string | null;
  matchScore?: number;
}

/**
 * Sanitizes an application record for the Kanban board card display.
 * Strictly prevents internal recruiter margins or client commercial terms from leaking.
 */
export function serializePipelineCard(app: any, userRole: UserRole): PipelineCardDTO {
  const isCandidate = userRole === UserRole.CANDIDATE;
  const isClient = userRole === UserRole.CLIENT;

  return {
    id: app.id,
    candidateId: app.candidate?.id || app.candidateId,
    candidateCode: app.candidate?.code || '',
    name: app.candidate?.name || 'Unknown Candidate',
    currentTitle: app.candidate?.currentTitle || null,
    currentCompany: isCandidate ? null : app.candidate?.currentCompany || null,
    experienceYears: app.candidate?.experienceYears != null ? Number(app.candidate.experienceYears) : null,
    expectedSalary: isClient ? null : app.candidate?.expectedSalary ? `₹${(Number(app.candidate.expectedSalary) / 100000).toFixed(1)} LPA` : null,
    location: app.candidate?.location || null,
    skills: Array.isArray(app.candidate?.skills) ? app.candidate.skills : [],
    stageId: app.stageId || null,
    status: app.status,
    appliedAt: app.appliedAt ? new Date(app.appliedAt).toISOString() : new Date().toISOString(),
    updatedAt: app.updatedAt ? new Date(app.updatedAt).toISOString() : new Date().toISOString(),
    ownerName: app.candidate?.owner?.name || null,
    matchScore: 88, // Normalized match indicator
  };
}

export interface PipelineColumnDTO {
  stage: {
    id: string;
    name: string;
    stageType: ApplicationStatus;
    order: number;
    isArchived: boolean;
  };
  totalCount: number;
  cards: PipelineCardDTO[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface JobPipelineHeaderDTO {
  jobId: string;
  jobCode: string;
  jobTitle: string;
  clientId: string;
  clientName: string;
  jobStatus: JobStatus;
  ownerId: string | null;
  ownerName: string | null;
  openings: number;
  totalApplications: number;
}
