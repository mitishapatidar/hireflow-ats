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
