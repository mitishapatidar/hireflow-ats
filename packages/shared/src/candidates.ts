import { z } from 'zod';

// ============================================================================
// Candidate Filter & Search Schema
// ============================================================================

export const CandidateFilterSchema = z.object({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  jobId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  source: z.string().trim().optional(),
  location: z.string().trim().optional(),
  minExp: z.coerce.number().min(0).optional(),
  maxExp: z.coerce.number().min(0).optional(),
  minSalary: z.coerce.number().min(0).optional(),
  maxSalary: z.coerce.number().min(0).optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return val.split(',').map((t) => t.trim()).filter(Boolean);
    }),
  includeArchived: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['updatedAt', 'createdAt', 'name', 'experienceYears']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CandidateFilterInput = z.infer<typeof CandidateFilterSchema>;

// ============================================================================
// Candidate Profile Update Schema
// ============================================================================

export const UpdateCandidateSchema = z.object({
  name: z.string().trim().min(1, 'Candidate name is required').max(100),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  currentTitle: z.string().trim().max(100).optional().or(z.literal('')),
  currentCompany: z.string().trim().max(100).optional().or(z.literal('')),
  experienceYears: z.coerce.number().min(0, 'Experience must be positive').max(60).optional().nullable(),
  currentSalary: z.coerce.number().min(0).optional().nullable(),
  expectedSalary: z.coerce.number().min(0).optional().nullable(),
  noticePeriod: z.string().trim().max(50).optional().or(z.literal('')),
  location: z.string().trim().max(100).optional().or(z.literal('')),
  skills: z.array(z.string().trim().min(1)).default([]),
  source: z.string().trim().max(100).optional().or(z.literal('')),
});

export type UpdateCandidateInput = z.infer<typeof UpdateCandidateSchema>;

// ============================================================================
// Candidate Note Schemas
// ============================================================================

export const CreateCandidateNoteSchema = z.object({
  content: z.string().trim().min(1, 'Note content cannot be empty').max(5000, 'Note is too long'),
  isInternalOnly: z.boolean().default(true),
});

export type CreateCandidateNoteInput = z.infer<typeof CreateCandidateNoteSchema>;

// ============================================================================
// Ownership Handover Schema
// ============================================================================

export const CandidateHandoverSchema = z.object({
  newOwnerId: z.string().trim().min(1, 'New owner is required'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export type CandidateHandoverInput = z.infer<typeof CandidateHandoverSchema>;

// ============================================================================
// Archive & Restore Schemas
// ============================================================================

export const ArchiveCandidateSchema = z.object({
  reason: z.string().trim().min(3, 'Archive reason must be at least 3 characters').max(500),
});

export type ArchiveCandidateInput = z.infer<typeof ArchiveCandidateSchema>;

export const RestoreCandidateSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type RestoreCandidateInput = z.infer<typeof RestoreCandidateSchema>;

// ============================================================================
// Saved Custom View Schema
// ============================================================================

export const SavedViewSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, 'View name is required').max(50),
  filters: CandidateFilterSchema,
  createdAt: z.string(),
});

export type SavedView = z.infer<typeof SavedViewSchema>;

// ============================================================================
// Prompt 8: Candidate Creation, Resume Parsing & Review Schemas
// ============================================================================

export const ConfidenceStatusEnum = z.enum([
  'HIGH_CONFIDENCE',
  'NEEDS_REVIEW',
  'MISSING',
  'MANUALLY_EDITED',
]);

export type ConfidenceStatus = z.infer<typeof ConfidenceStatusEnum>;

export interface ExtractedField<T> {
  value: T | null;
  confidence: number; // 0.0 - 1.0
  evidence?: string | null;
  status: ConfidenceStatus;
}

export interface ParsedResumeReview {
  name: ExtractedField<string>;
  email: ExtractedField<string>;
  phone: ExtractedField<string>;
  currentTitle: ExtractedField<string>;
  currentCompany: ExtractedField<string>;
  experienceYears: ExtractedField<number>;
  currentSalary: ExtractedField<number>;
  expectedSalary: ExtractedField<number>;
  location: ExtractedField<string>;
  noticePeriod: ExtractedField<string>;
  skills: ExtractedField<string[]>;
  rawSummary: string;
  sourceSnippets: string[];
  extractedFieldsCount: number;
  fileMetadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
    fileChecksum: string;
  };
}

export const CreateCandidateSchema = z.object({
  name: z.string().trim().min(1, 'Candidate name is required').max(100),
  email: z.string().trim().email('Valid email address is required').max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  currentTitle: z.string().trim().max(100).optional().nullable(),
  currentCompany: z.string().trim().max(100).optional().nullable(),
  experienceYears: z.coerce.number().min(0).max(60).optional().nullable(),
  currentSalary: z.coerce.number().min(0).optional().nullable(),
  expectedSalary: z.coerce.number().min(0).optional().nullable(),
  noticePeriod: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(100).optional().nullable(),
  skills: z.array(z.string().trim().min(1)).default([]),
  source: z.string().trim().max(100).default('Resume Upload'),
  ownerId: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().trim().max(5000).optional().nullable(),
  resumeDocument: z
    .object({
      fileName: z.string().trim().min(1),
      storageKey: z.string().trim().min(1),
      fileSize: z.number().int().positive(),
      mimeType: z.string().trim().min(1),
      fileChecksum: z.string().trim().min(1),
      documentType: z.string().default('RESUME'),
    })
    .optional()
    .nullable(),
});

export type CreateCandidateInput = z.infer<typeof CreateCandidateSchema>;

export const DuplicateCheckSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().optional().nullable(),
});

export type DuplicateCheckInput = z.infer<typeof DuplicateCheckSchema>;

export interface DuplicateCandidateMatch {
  candidateId: string;
  code: string;
  name: string;
  email: string;
  phone?: string | null;
  owner?: { id: string; name: string } | null;
  isArchived: boolean;
  matchingField: 'email' | 'phone';
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: DuplicateCandidateMatch[];
}

// ============================================================================
// Normalization & Security Utilities
// ============================================================================

/**
 * Normalizes email by trimming, converting to lower case.
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Normalizes phone numbers for matching (removes non-digits, keeps last 10 digits for Indian numbers).
 */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  // If Indian 12 digits starting with 91, extract last 10 digits
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  // If 11 digits starting with 0, extract last 10 digits
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Validates file magic bytes to verify actual format matches extension
 * Supported: PDF, DOCX, DOC
 * Maximum size: 10 MB
 */
export function validateFileSecurity(
  buffer: Buffer | Uint8Array,
  fileName: string,
  declaredMimeType?: string
): { valid: boolean; detectedMime?: string; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (buffer.length > MAX_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of 10 MB (File size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
    };
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext || !['pdf', 'docx', 'doc'].includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension .${ext || ''}. Only PDF, DOCX, and DOC are permitted.`,
    };
  }

  const u8 = buffer instanceof Buffer ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length) : buffer;

  // 1. PDF Magic Bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    u8.length >= 5 &&
    u8[0] === 0x25 &&
    u8[1] === 0x50 &&
    u8[2] === 0x44 &&
    u8[3] === 0x46 &&
    u8[4] === 0x2d
  ) {
    if (ext !== 'pdf') {
      return { valid: false, error: `File signature is PDF but extension is .${ext}` };
    }
    return { valid: true, detectedMime: 'application/pdf' };
  }

  // 2. DOCX / ZIP Magic Bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (
    u8.length >= 4 &&
    u8[0] === 0x50 &&
    u8[1] === 0x4b &&
    u8[2] === 0x03 &&
    u8[3] === 0x04
  ) {
    if (ext !== 'docx') {
      return { valid: false, error: `File signature is DOCX (ZIP archive) but extension is .${ext}` };
    }
    return {
      valid: true,
      detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  // 3. DOC (OLE Compound Document) Magic Bytes: \xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1
  if (
    u8.length >= 8 &&
    u8[0] === 0xd0 &&
    u8[1] === 0xcf &&
    u8[2] === 0x11 &&
    u8[3] === 0xe0 &&
    u8[4] === 0xa1 &&
    u8[5] === 0xb1 &&
    u8[6] === 0x1a &&
    u8[7] === 0xe1
  ) {
    if (ext !== 'doc') {
      return { valid: false, error: `File signature is legacy Word DOC but extension is .${ext}` };
    }
    return { valid: true, detectedMime: 'application/msword' };
  }

  return {
    valid: false,
    error: `Invalid file content or signature. The file headers do not match genuine PDF, DOCX, or DOC formats.`,
  };
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Formats Indian Rupee (INR) amounts cleanly (e.g. ₹32.0 LPA or ₹50,000)
 */
export function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return '—';
  }

  // If >= 1 Lakh (100,000), format as LPA
  if (amount >= 100000) {
    const lpa = amount / 100000;
    // Format to 1 decimal place if fractional, otherwise integer
    const formatted = lpa % 1 === 0 ? lpa.toFixed(0) : lpa.toFixed(1);
    return `₹${formatted} LPA`;
  }

  // Standard Indian comma format
  return `₹${new Intl.NumberFormat('en-IN').format(amount)}`;
}

/**
 * Formats candidate experience in years
 */
export function formatExperience(years?: number | null): string {
  if (years === undefined || years === null || isNaN(years)) {
    return '—';
  }
  if (years === 0) {
    return 'Fresher';
  }
  if (years === 1) {
    return '1 year';
  }
  return `${years} years`;
}
