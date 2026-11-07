/**
 * Centralized Duplicate Detection & Scoring Engine
 *
 * Implements multi-tiered matching for candidates:
 * 1. Exact Email match (normalized lowercase)
 * 2. Exact Phone match (normalized digits, 10-digit Indian standard)
 * 3. Fuzzy Name + Company match (Levenshtein distance & token overlap)
 *
 * Applicable to single resume upload, bulk import, Chrome extension capture,
 * inbound email, and job board integrations.
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export type DuplicateMatchReason =
  | 'EXACT_EMAIL_MATCH'
  | 'EXACT_PHONE_MATCH'
  | 'STRONG_NAME_COMPANY_MATCH'
  | 'POSSIBLE_NAME_MATCH'
  | 'POSSIBLE_COMPANY_MATCH';

export type DuplicateMatchCategory =
  | 'EXACT_DUPLICATE'
  | 'POSSIBLE_DUPLICATE'
  | 'NO_MATCH';

export interface DuplicateEvaluationResult {
  isDuplicate: boolean;
  score: number; // 0.00 to 1.00
  reasons: DuplicateMatchReason[];
  category: DuplicateMatchCategory;
  matchedCandidateId?: string;
  matchedCandidateCode?: string;
  matchedCandidateName?: string;
}

export const CandidateDuplicateCheckSchema = z.object({
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1, 'Candidate name is required').optional().nullable(),
  company: z.string().trim().optional().nullable(),
  includeArchived: z.boolean().default(true),
});

export type CandidateDuplicateCheckInput = z.infer<typeof CandidateDuplicateCheckSchema>;

export const ResolveDuplicatePairSchema = z.object({
  status: z.enum(['RESOLVED_DIFFERENT', 'MERGED', 'IGNORED']),
  resolutionNote: z.string().optional(),
});

export type ResolveDuplicatePairInput = z.infer<typeof ResolveDuplicatePairSchema>;

// ============================================================================
// Normalization & String Similarity Helpers
// ============================================================================

/**
 * Normalizes email address for consistent comparison.
 */
export function normalizeCandidateEmail(email?: string | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Normalizes phone number to digits only, keeping the last 10 digits for Indian standard.
 */
export function normalizeCandidatePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Normalizes company names by lowercasing, stripping legal entity suffixes, and punctuation.
 */
export function normalizeCompanyForMatching(company?: string | null): string {
  if (!company) return '';
  return company
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\b(private|pvt|limited|ltd|inc|incorporated|corp|corporation|llp|technologies|technology|solutions|services|group|co)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes candidate full name (removes titles, multiple spaces, punctuation).
 */
export function normalizeNameForMatching(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\b(mr|ms|mrs|dr|prof)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein Distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Computes string similarity score between 0.0 and 1.0 based on Levenshtein Distance.
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').trim().toLowerCase();
  const s2 = (str2 || '').trim().toLowerCase();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * Token overlap ratio between two strings (useful for multi-word names and companies).
 */
export function tokenOverlapRatio(str1: string, str2: string): number {
  const tokens1 = new Set((str1 || '').toLowerCase().split(/\s+/).filter(Boolean));
  const tokens2 = new Set((str2 || '').toLowerCase().split(/\s+/).filter(Boolean));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  tokens1.forEach((token) => {
    if (tokens2.has(token)) intersection++;
  });

  return (2 * intersection) / (tokens1.size + tokens2.size);
}

// ============================================================================
// Multi-Tiered Candidate Duplicate Evaluation
// ============================================================================

export interface CandidateComparisonTarget {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string | null;
  currentCompany?: string | null;
  isArchived: boolean;
}

/**
 * Evaluates candidate input data against an existing candidate record.
 */
export function evaluateCandidateDuplicate(
  input: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
  },
  existing: CandidateComparisonTarget
): DuplicateEvaluationResult {
  const reasons: DuplicateMatchReason[] = [];
  let score = 0.0;

  const inputEmail = normalizeCandidateEmail(input.email);
  const existingEmail = normalizeCandidateEmail(existing.email);
  const isExactEmail = Boolean(inputEmail && existingEmail && inputEmail === existingEmail);

  if (isExactEmail) {
    reasons.push('EXACT_EMAIL_MATCH');
    score = Math.max(score, 1.0);
  }

  const inputPhone = normalizeCandidatePhone(input.phone);
  const existingPhone = normalizeCandidatePhone(existing.phone);
  const isExactPhone = Boolean(inputPhone && existingPhone && inputPhone === existingPhone);

  if (isExactPhone) {
    reasons.push('EXACT_PHONE_MATCH');
    score = Math.max(score, 1.0);
  }

  // Fuzzy Name & Company
  const inputName = normalizeNameForMatching(input.name);
  const existingName = normalizeNameForMatching(existing.name);
  const inputCompany = normalizeCompanyForMatching(input.company);
  const existingCompany = normalizeCompanyForMatching(existing.currentCompany);

  const nameSim = stringSimilarity(inputName, existingName);
  const nameTokenOverlap = tokenOverlapRatio(inputName, existingName);
  const effectiveNameScore = Math.max(nameSim, nameTokenOverlap);

  const companySim = stringSimilarity(inputCompany, existingCompany);
  const companyTokenOverlap = tokenOverlapRatio(inputCompany, existingCompany);
  const effectiveCompanyScore = Math.max(companySim, companyTokenOverlap);

  if (effectiveNameScore >= 0.85 && effectiveCompanyScore >= 0.8) {
    reasons.push('STRONG_NAME_COMPANY_MATCH');
    score = Math.max(score, 0.9);
  } else if (effectiveNameScore >= 0.9) {
    reasons.push('POSSIBLE_NAME_MATCH');
    score = Math.max(score, 0.65);
  } else if (effectiveCompanyScore >= 0.9 && effectiveNameScore >= 0.7) {
    reasons.push('POSSIBLE_COMPANY_MATCH');
    score = Math.max(score, 0.55);
  }

  let category: DuplicateMatchCategory = 'NO_MATCH';
  if (score >= 0.95) {
    category = 'EXACT_DUPLICATE';
  } else if (score >= 0.6) {
    category = 'POSSIBLE_DUPLICATE';
  }

  return {
    isDuplicate: category !== 'NO_MATCH',
    score: Math.round(score * 100) / 100,
    reasons,
    category,
    matchedCandidateId: existing.id,
    matchedCandidateCode: existing.code,
    matchedCandidateName: existing.name,
  };
}
