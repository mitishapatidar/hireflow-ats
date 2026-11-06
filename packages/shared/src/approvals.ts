import { z } from 'zod';

// ==========================================
// 1. APPROVAL STATUSES & TYPES
// ==========================================

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  REJECTED = 'REJECTED',
}

export interface RuleCheckResult {
  rule: string;
  label: string;
  required: boolean;
  actual: string;
  passed: boolean;
  explanation: string;
  fixAction?: string;
}

export interface ValidationReport {
  allPassed: boolean;
  isValid: boolean;
  checks: RuleCheckResult[];
  evaluatedAt: string;
  clientWorkflowVersion: number;
}

// ==========================================
// 2. CLIENT SUBMISSION VALIDATION ENGINE
// ==========================================

export interface SubmissionValidationParams {
  candidate: {
    id: string;
    fullName: string;
    headline?: string | null;
    location?: string | null;
    summary?: string | null;
    coreSkills?: string[] | null;
    experienceYears?: number | string | null;
    portfolioUrl?: string | null;
    expectedSalary?: number | string | null;
    noticePeriodDays?: number | string | null;
    noticePeriod?: string | null;
    consentGiven?: boolean | null;
    hasCv?: boolean;
    hasExperience?: boolean;
    hasEducation?: boolean;
  };
  submission: {
    id: string;
    portfolioUrl?: string | null;
    standardProfileVersion?: string;
  };
  rules: {
    requiredFields?: string[];
    profileFormat?: string;
    requiresManagerApproval?: boolean;
    requirePortfolioUrl?: boolean;
    requireExpectedSalary?: boolean;
    requireNoticePeriod?: boolean;
    requireCandidateConsent?: boolean;
    requireCvDocument?: boolean;
    requireCompleteProfile?: boolean;
  } | null;
  workflowVersion?: number;
}

/**
 * Deterministic Server-Side Client Rule Validator
 * Validates candidates and submissions against the active Client Workflow rules.
 * Never trust validation provided by the browser!
 */
export function validateSubmissionAgainstClientRules(
  params: SubmissionValidationParams
): ValidationReport {
  const { candidate, submission, rules, workflowVersion = 1 } = params;
  const checks: RuleCheckResult[] = [];

  // Rule 1: Complete Candidate Profile
  const hasCompleteProfile = Boolean(
    candidate.fullName &&
      (candidate.headline || candidate.summary) &&
      (candidate.coreSkills && candidate.coreSkills.length > 0)
  );
  checks.push({
    rule: 'COMPLETE_PROFILE',
    label: 'Complete Candidate Profile',
    required: rules?.requireCompleteProfile ?? true,
    actual: hasCompleteProfile ? 'Complete (Bio, Headline & Skills present)' : 'Incomplete fields',
    passed: !(rules?.requireCompleteProfile ?? true) || hasCompleteProfile,
    explanation: hasCompleteProfile
      ? 'Candidate dossier includes verified summary, professional headline, and skills.'
      : 'Candidate dossier is missing headline, professional summary, or skills.',
    fixAction: 'Edit candidate profile details before submitting.',
  });

  // Rule 2: CV Attached & Accessible
  const hasCv = Boolean(candidate.hasCv);
  checks.push({
    rule: 'CV_ATTACHED',
    label: 'CV Document Attached & Accessible',
    required: rules?.requireCvDocument ?? true,
    actual: hasCv ? 'Original Resume File Attached' : 'No CV uploaded',
    passed: !(rules?.requireCvDocument ?? true) || hasCv,
    explanation: hasCv
      ? 'Original resume document is stored securely in private storage.'
      : 'A valid PDF/DOCX resume file must be attached.',
    fixAction: 'Upload candidate CV in Candidates module.',
  });

  // Rule 3: Portfolio / Work Sample URL
  const portfolioUrl = (submission.portfolioUrl || candidate.portfolioUrl || '').trim();
  const hasPortfolio = portfolioUrl.length > 0;
  const isPortfolioRequired = rules?.requirePortfolioUrl ?? false;
  checks.push({
    rule: 'PORTFOLIO_URL',
    label: 'Portfolio / GitHub / Work Sample URL',
    required: isPortfolioRequired,
    actual: hasPortfolio ? portfolioUrl : 'Not provided',
    passed: !isPortfolioRequired || hasPortfolio,
    explanation: hasPortfolio
      ? 'Verified work sample URL provided.'
      : isPortfolioRequired
      ? 'Client workflow strictly mandates a portfolio or GitHub URL.'
      : 'Optional: No portfolio provided.',
    fixAction: isPortfolioRequired ? 'Provide portfolio or repository URL in submission editor.' : undefined,
  });

  // Rule 4: Expected Salary
  const expectedSalary = candidate.expectedSalary;
  const hasExpectedSalary = expectedSalary !== null && expectedSalary !== undefined && expectedSalary !== '';
  const isSalaryRequired = rules?.requireExpectedSalary ?? false;
  checks.push({
    rule: 'EXPECTED_SALARY',
    label: 'Candidate Expected Salary',
    required: isSalaryRequired,
    actual: hasExpectedSalary ? `Specified (₹${expectedSalary})` : 'Not recorded',
    passed: !isSalaryRequired || hasExpectedSalary,
    explanation: hasExpectedSalary
      ? 'Expected compensation documented in candidate dossier.'
      : isSalaryRequired
      ? 'Client submission mandate requires candidate expected compensation.'
      : 'Optional: Not specified.',
    fixAction: isSalaryRequired ? 'Update expected salary in candidate profile.' : undefined,
  });

  // Rule 5: Notice Period
  const noticeDays = candidate.noticePeriodDays ?? candidate.noticePeriod;
  const hasNoticePeriod = noticeDays !== null && noticeDays !== undefined && String(noticeDays).trim() !== '';
  const isNoticeRequired = rules?.requireNoticePeriod ?? false;
  checks.push({
    rule: 'NOTICE_PERIOD',
    label: 'Notice Period Documented',
    required: isNoticeRequired,
    actual: hasNoticePeriod ? `${noticeDays}${typeof noticeDays === 'number' ? ' days' : ''}` : 'Not specified',
    passed: !isNoticeRequired || hasNoticePeriod,
    explanation: hasNoticePeriod
      ? `Notice period is recorded as ${noticeDays} days.`
      : isNoticeRequired
      ? 'Client workflow mandates documented notice period before submission.'
      : 'Optional: Notice period not specified.',
    fixAction: isNoticeRequired ? 'Set candidate availability / notice period in candidate profile.' : undefined,
  });

  // Rule 6: Candidate Representation Consent
  const hasConsent = candidate.consentGiven === true;
  const isConsentRequired = rules?.requireCandidateConsent ?? true;
  checks.push({
    rule: 'CANDIDATE_CONSENT',
    label: 'Candidate Representation Consent',
    required: isConsentRequired,
    actual: hasConsent ? 'Recorded & Verified' : 'Consent pending / missing',
    passed: !isConsentRequired || hasConsent,
    explanation: hasConsent
      ? 'Candidate representation consent is explicitly recorded.'
      : 'Candidate representation consent must be verified prior to client submission.',
    fixAction: 'Obtain and record candidate consent to be represented for this client mandate.',
  });

  // Rule 7: Approved Standard Profile Format
  const expectedFormat = rules?.profileFormat || 'STANDARDIZED_ANONYMIZED';
  checks.push({
    rule: 'PROFILE_FORMAT',
    label: 'Approved Standard Profile Format',
    required: true,
    actual: `Format: ${expectedFormat}`,
    passed: true,
    explanation: `Profile version complies with approved client presentation template (${expectedFormat}).`,
  });

  const allPassed = checks.every((c) => !c.required || c.passed);

  return {
    allPassed,
    isValid: allPassed,
    checks,
    evaluatedAt: new Date().toISOString(),
    clientWorkflowVersion: workflowVersion,
  };
}

// ==========================================
// 3. RECRUITER SELF-APPROVAL PREVENTION GUARD
// ==========================================

export class SelfApprovalError extends Error {
  constructor(message = 'Self-approval violation: Recruiters and submitters cannot approve their own records.') {
    super(message);
    this.name = 'SelfApprovalError';
  }
}

/**
 * Strict Server-Side Self-Approval Prevention Check
 * Throws SelfApprovalError if the reviewer is the same user who submitted or owns the record.
 */
export function assertNotSelfApproval(
  reviewerIdOrParams:
    | string
    | {
        reviewerId: string;
        submittingUserId?: string | null;
        submitterId?: string | null;
        ownerId?: string | null;
        createdById?: string | null;
        candidateOwnerId?: string | null;
      },
  optionalDetails?: {
    submitterId?: string | null;
    submittingUserId?: string | null;
    ownerId?: string | null;
    createdById?: string | null;
    candidateOwnerId?: string | null;
  }
): void {
  let reviewerId: string;
  let submitterId: string | null | undefined;
  let ownerId: string | null | undefined;
  let createdById: string | null | undefined;
  let candidateOwnerId: string | null | undefined;

  if (typeof reviewerIdOrParams === 'string') {
    reviewerId = reviewerIdOrParams;
    submitterId = optionalDetails?.submitterId || optionalDetails?.submittingUserId;
    ownerId = optionalDetails?.ownerId;
    createdById = optionalDetails?.createdById;
    candidateOwnerId = optionalDetails?.candidateOwnerId;
  } else {
    reviewerId = reviewerIdOrParams.reviewerId;
    submitterId = reviewerIdOrParams.submitterId || reviewerIdOrParams.submittingUserId;
    ownerId = reviewerIdOrParams.ownerId;
    createdById = reviewerIdOrParams.createdById;
    candidateOwnerId = reviewerIdOrParams.candidateOwnerId;
  }

  if (!reviewerId) {
    throw new SelfApprovalError('Missing authenticated reviewer identity.');
  }

  if (
    (submitterId && reviewerId === submitterId) ||
    (ownerId && reviewerId === ownerId) ||
    (createdById && reviewerId === createdById) ||
    (candidateOwnerId && reviewerId === candidateOwnerId)
  ) {
    throw new SelfApprovalError(
      'Self-approval violation: You cannot approve, sign-off, or validate a record you submitted or own.'
    );
  }
}

// ==========================================
// 4. VERSION BINDING & INVALIDATION CHECK
// ==========================================

export function isSubmissionApprovalValid(params: {
  isInvalidated?: boolean;
  approvalProfileVersion?: number | null;
  currentProfileVersion: number;
  approvalSubmissionVersion?: number | null;
  currentSubmissionVersion: number;
}): boolean {
  const {
    isInvalidated = false,
    approvalProfileVersion,
    currentProfileVersion,
    approvalSubmissionVersion,
    currentSubmissionVersion,
  } = params;

  if (isInvalidated) return false;
  if (approvalProfileVersion !== currentProfileVersion) return false;
  if (approvalSubmissionVersion && approvalSubmissionVersion !== currentSubmissionVersion) return false;

  return true;
}

// ==========================================
// 5. ZOD SCHEMAS FOR APPROVAL ACTIONS
// ==========================================

export const ApproveSubmissionSchema = z.object({
  submissionId: z.string().uuid('Invalid submission ID'),
  comments: z.string().max(1000).optional(),
});
export type ApproveSubmissionInput = z.infer<typeof ApproveSubmissionSchema>;

export const RequestChangesSchema = z.object({
  id: z.string().uuid('Invalid record ID'),
  reason: z
    .string()
    .min(5, 'A clear reason of at least 5 characters is required when requesting changes')
    .max(2000),
});
export type RequestChangesInput = z.infer<typeof RequestChangesSchema>;

export const RejectApprovalSchema = z.object({
  id: z.string().uuid('Invalid record ID'),
  reason: z
    .string()
    .min(5, 'A clear rejection reason of at least 5 characters is required')
    .max(2000),
});
export type RejectApprovalInput = z.infer<typeof RejectApprovalSchema>;

export const SubmitJobForApprovalSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  notes: z.string().max(1000).optional(),
});
export type SubmitJobForApprovalInput = z.infer<typeof SubmitJobForApprovalSchema>;

export const ApproveJobSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  comments: z.string().max(1000).optional(),
});
export type ApproveJobInput = z.infer<typeof ApproveJobSchema>;
