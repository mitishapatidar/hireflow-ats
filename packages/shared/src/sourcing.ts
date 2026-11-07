/**
 * Sourcing, Bulk Import & Extension Capture Schemas and Utilities
 */

import { z } from 'zod';
import crypto from 'crypto';

export const IMPORT_BATCH_STATUSES = [
  'CREATED',
  'UPLOADING',
  'QUEUED',
  'PROCESSING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const IMPORT_ITEM_STATUSES = [
  'PENDING',
  'PROCESSING',
  'AWAITING_REVIEW',
  'APPROVED',
  'REJECTED',
  'FAILED',
] as const;

export type ImportItemStatus = (typeof IMPORT_ITEM_STATUSES)[number];

export const SOURCING_SOURCES = [
  'MANUAL_UPLOAD',
  'BULK_IMPORT',
  'CHROME_EXTENSION',
  'INBOUND_EMAIL',
  'NAUKRI',
  'FOUNDIT',
] as const;

export type SourcingSource = (typeof SOURCING_SOURCES)[number];

// ============================================================================
// Schemas
// ============================================================================

export const CreateImportBatchSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  importType: z.enum(['BULK_RESUME', 'CSV', 'JOB_BOARD']).default('BULK_RESUME'),
  totalRecords: z.number().int().min(1, 'At least 1 file required').max(50, 'Max 50 files per batch'),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        fileKey: z.string().min(1),
        fileSize: z.number().int().positive(),
        mimeType: z.string().min(1),
        fileChecksum: z.string().optional(),
      })
    )
    .min(1)
    .max(50),
});

export type CreateImportBatchInput = z.infer<typeof CreateImportBatchSchema>;

export const UpdateImportItemReviewSchema = z.object({
  name: z.string().trim().min(1, 'Candidate name is required'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().optional().nullable(),
  currentTitle: z.string().trim().optional().nullable(),
  currentCompany: z.string().trim().optional().nullable(),
  experienceYears: z.number().nonnegative().optional().nullable(),
  currentSalary: z.number().nonnegative().optional().nullable(),
  expectedSalary: z.number().nonnegative().optional().nullable(),
  noticePeriod: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  skills: z.array(z.string().trim()).default([]),
  jobId: z.string().min(1).optional().nullable(),
  ownerId: z.string().min(1).optional().nullable(),
  tags: z.array(z.string().trim()).default([]),
  notes: z.string().trim().optional().nullable(),
});

export type UpdateImportItemReviewInput = z.infer<typeof UpdateImportItemReviewSchema>;

export const ApproveImportItemSchema = z.object({
  candidateData: UpdateImportItemReviewSchema,
});

export type ApproveImportItemInput = z.infer<typeof ApproveImportItemSchema>;

export const ExtensionCaptureSchema = z.object({
  name: z.string().trim().min(1, 'Candidate name is required'),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  currentTitle: z.string().trim().optional().nullable(),
  currentCompany: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  skills: z.array(z.string().trim()).default([]),
  experienceYears: z.number().nonnegative().optional().nullable(),
  profileUrl: z.string().url('Invalid profile URL').optional().nullable(),
  sourcePlatform: z.string().trim().min(1).default('LINKEDIN'),
  jobId: z.string().min(1).optional().nullable(),
  ownerId: z.string().min(1).optional().nullable(),
  tags: z.array(z.string().trim()).default([]),
  notes: z.string().trim().optional().nullable(),
  rawHtml: z.string().optional().nullable(),
});

export type ExtensionCaptureInput = z.infer<typeof ExtensionCaptureSchema>;

export const SourcingQueueFilterSchema = z.object({
  source: z.enum(SOURCING_SOURCES).optional(),
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  jobId: z.string().min(1).optional(),
  recruiterId: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type SourcingQueueFilter = z.infer<typeof SourcingQueueFilterSchema>;

// ============================================================================
// Extension Token Management
// ============================================================================

export const EXTENSION_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generates a high-entropy random extension capture token.
 */
export function generateExtensionCaptureToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = 'hfe_' + crypto.randomBytes(32).toString('hex');
  const tokenHash = hashExtensionCaptureToken(rawToken);
  const expiresAt = new Date(Date.now() + EXTENSION_TOKEN_TTL_MS);
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Hashes an extension capture token for secure database storage.
 */
export function hashExtensionCaptureToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Checks whether an extension token has passed its expiration boundary.
 */
export function isExtensionTokenExpired(expiresAt: Date | string): boolean {
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return Date.now() > exp.getTime();
}
