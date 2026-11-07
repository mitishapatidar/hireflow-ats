/**
 * Candidate Merge Validation & Execution Engine
 *
 * Implements safe, non-destructive merging of duplicate candidate profiles:
 * 1. Side-by-side field resolution between Master and Secondary records.
 * 2. Unification of historical relations (CVs, Notes, Tags, Interviews, Submissions, Offers, Placements).
 * 3. Application conflict detection to prevent duplicate applications per job.
 * 4. Strict confirmation keyword: "MERGE".
 * 5. Soft-archival of the secondary candidate with `mergedIntoCandidateId`.
 */

import { z } from 'zod';

export interface MergeFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'array' | 'json';
  category: 'CORE' | 'EXPERIENCE' | 'COMPENSATION' | 'METADATA';
}

export const MERGE_FIELD_CATALOG: MergeFieldDefinition[] = [
  { key: 'name', label: 'Full Name', type: 'string', category: 'CORE' },
  { key: 'email', label: 'Email Address', type: 'string', category: 'CORE' },
  { key: 'phone', label: 'Phone Number', type: 'string', category: 'CORE' },
  { key: 'currentTitle', label: 'Current Title', type: 'string', category: 'EXPERIENCE' },
  { key: 'currentCompany', label: 'Current Company', type: 'string', category: 'EXPERIENCE' },
  { key: 'experienceYears', label: 'Total Experience (Years)', type: 'number', category: 'EXPERIENCE' },
  { key: 'currentSalary', label: 'Current Salary (CTC)', type: 'number', category: 'COMPENSATION' },
  { key: 'expectedSalary', label: 'Expected Salary (CTC)', type: 'number', category: 'COMPENSATION' },
  { key: 'noticePeriod', label: 'Notice Period', type: 'string', category: 'COMPENSATION' },
  { key: 'location', label: 'Current Location', type: 'string', category: 'CORE' },
  { key: 'skills', label: 'Key Skills', type: 'array', category: 'EXPERIENCE' },
  { key: 'source', label: 'Candidate Source', type: 'string', category: 'METADATA' },
  { key: 'ownerId', label: 'Recruiter Owner', type: 'string', category: 'METADATA' },
];

export const CandidateMergeSchema = z.object({
  masterCandidateId: z.string().min(1, 'Master candidate ID is required'),
  secondaryCandidateId: z.string().min(1, 'Secondary candidate ID is required'),
  fieldsRetained: z.record(z.enum(['MASTER', 'SECONDARY'])),
  mergeReason: z.string().trim().min(3, 'Merge reason must be at least 3 characters'),
  confirmation: z.literal('MERGE', {
    errorMap: () => ({ message: 'You must type "MERGE" in all uppercase to confirm' }),
  }),
});

export type CandidateMergeInput = z.infer<typeof CandidateMergeSchema>;

export interface MergeCandidateSourceData {
  id: string;
  code: string;
  name: string;
  organizationId: string;
  isArchived: boolean;
  isMerged?: boolean;
  mergedIntoCandidateId?: string | null;
  applications?: Array<{ id: string; jobId: string; status: string }>;
  documents?: Array<{ id: string; fileName: string }>;
  notes?: Array<{ id: string }>;
  tags?: Array<{ id: string }>;
}

export interface MergeEligibilityResult {
  eligible: boolean;
  error?: string;
  code?: string;
  conflictingJobIds?: string[];
}

/**
 * Validates whether two candidate records can be merged.
 */
export function validateMergeEligibility(
  master: MergeCandidateSourceData,
  secondary: MergeCandidateSourceData
): MergeEligibilityResult {
  if (master.id === secondary.id) {
    return {
      eligible: false,
      error: 'Cannot merge a candidate profile into itself.',
      code: 'SELF_MERGE_PROHIBITED',
    };
  }

  if (master.organizationId !== secondary.organizationId) {
    return {
      eligible: false,
      error: 'Cannot merge candidate records across different organizations.',
      code: 'CROSS_ORG_MERGE_FORBIDDEN',
    };
  }

  if (master.isArchived) {
    return {
      eligible: false,
      error: `Cannot merge into archived master candidate (${master.code}). Master candidate must be active.`,
      code: 'MASTER_ARCHIVED',
    };
  }

  if (master.isMerged || master.mergedIntoCandidateId) {
    return {
      eligible: false,
      error: `Candidate ${master.code} was already merged into another profile.`,
      code: 'MASTER_ALREADY_MERGED',
    };
  }

  if (secondary.isMerged || secondary.mergedIntoCandidateId) {
    return {
      eligible: false,
      error: `Candidate ${secondary.code} has already been merged.`,
      code: 'SECONDARY_ALREADY_MERGED',
    };
  }

  // Check for duplicate application job conflicts
  const masterJobIds = new Set((master.applications || []).map((a) => a.jobId));
  const conflictingJobIds: string[] = [];
  for (const secApp of secondary.applications || []) {
    if (masterJobIds.has(secApp.jobId)) {
      conflictingJobIds.push(secApp.jobId);
    }
  }

  return {
    eligible: true,
    conflictingJobIds,
  };
}

/**
 * Merges two arrays of skills without duplicates.
 */
export function mergeCandidateSkills(masterSkills: string[] = [], secondarySkills: string[] = []): string[] {
  const normalized = new Map<string, string>();
  for (const s of [...masterSkills, ...secondarySkills]) {
    const key = (s || '').trim().toLowerCase();
    if (key && !normalized.has(key)) {
      normalized.set(key, s.trim());
    }
  }
  return Array.from(normalized.values());
}
