import { z } from 'zod';

// ============================================================================
// 1. CLIENT ENUMS & STATUSES
// ============================================================================

export const ClientStatusEnum = z.enum(['ACTIVE', 'PROSPECT', 'INACTIVE']);
export type ClientStatus = z.infer<typeof ClientStatusEnum>;

export const ClientDocumentCategoryEnum = z.enum([
  'AGREEMENT',
  'ROLE_BRIEF',
  'MSA',
  'COMMERCIAL',
  'OTHER',
]);
export type ClientDocumentCategory = z.infer<typeof ClientDocumentCategoryEnum>;

export const ClientMeetingStatusEnum = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']);
export type ClientMeetingStatus = z.infer<typeof ClientMeetingStatusEnum>;

export const ClientMeetingTypeEnum = z.enum([
  'CLIENT_CHECK_IN',
  'KICKOFF',
  'PIPELINE_REVIEW',
  'CANDIDATE_DEBRIEF',
  'COMMERCIAL_NEGOTIATION',
]);
export type ClientMeetingType = z.infer<typeof ClientMeetingTypeEnum>;

// ============================================================================
// 2. CONCURRENCY-SAFE CODE & NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalizes company names for duplicate detection (removes common legal suffixes,
 * lowercases, strips punctuation and multiple spaces).
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  // 1. Replace punctuation with space first
  const sanitized = name.toLowerCase().replace(/[^\w\s]/g, ' ');
  // 2. Remove corporate suffixes as words
  return sanitized
    .replace(/\b(private|pvt|limited|ltd|inc|incorporated|llc|corp|corporation)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats numeric sequence into standardized client code format: CL-1001, CL-1002, etc.
 */
export function formatClientCode(sequenceNum: number): string {
  const base = Math.max(1001, sequenceNum);
  return `CL-${base}`;
}

/**
 * Parses numeric ID from a standardized client code.
 */
export function parseClientCode(code: string): number | null {
  const match = code.trim().toUpperCase().match(/^CL-(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? null : num;
}

// ============================================================================
// 3. INPUT VALIDATION SCHEMAS
// ============================================================================

export const ClientFilterSchema = z.object({
  search: z.string().optional(),
  status: z.union([ClientStatusEnum, z.literal('ALL')]).default('ALL'),
  industry: z.string().optional(),
  relationshipOwnerId: z.string().optional(),
  isArchived: z.union([z.boolean(), z.literal('ALL')]).default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['legalName', 'code', 'status', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ClientFilterInput = z.infer<typeof ClientFilterSchema>;

export const CreateClientContactInputSchema = z.object({
  name: z.string().min(2, 'Contact name must be at least 2 characters').max(80),
  designation: z.string().max(80).optional().nullable(),
  email: z.string().email('Valid email address required'),
  phone: z.string().max(30).optional().nullable(),
  contactType: z.string().default('PRIMARY'),
  isPrimary: z.boolean().default(true),
});

export type CreateClientContactInput = z.infer<typeof CreateClientContactInputSchema>;

export const CreateClientSchema = z.object({
  legalName: z.string().min(2, 'Company legal name must be at least 2 characters').max(120),
  industry: z.string().max(80).optional().nullable(),
  website: z
    .string()
    .url('Website must be a valid URL (e.g. https://example.com)')
    .or(z.literal(''))
    .optional()
    .nullable(),
  location: z.string().max(100).optional().nullable(),
  relationshipOwnerId: z.string().optional().nullable(),
  status: ClientStatusEnum.default('PROSPECT'),
  nextStep: z.string().max(200).optional().nullable(),
  // Commercial terms (internal only)
  commercialTerms: z.string().max(500).optional().nullable(),
  feePercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  paymentTerms: z.string().max(50).default('NET_30').optional().nullable(),
  relationshipNotes: z.string().max(2000).optional().nullable(),
  // Optional primary contact to create in single atomic transaction
  primaryContact: CreateClientContactInputSchema.optional().nullable(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = z.object({
  legalName: z.string().min(2, 'Company legal name must be at least 2 characters').max(120).optional(),
  industry: z.string().max(80).optional().nullable(),
  website: z
    .string()
    .url('Website must be a valid URL (e.g. https://example.com)')
    .or(z.literal(''))
    .optional()
    .nullable(),
  location: z.string().max(100).optional().nullable(),
  relationshipOwnerId: z.string().optional().nullable(),
  status: ClientStatusEnum.optional(),
  nextStep: z.string().max(200).optional().nullable(),
});

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;

export const UpdateClientCommercialSchema = z.object({
  commercialTerms: z.string().max(500).optional().nullable(),
  feePercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  paymentTerms: z.string().max(50).optional().nullable(),
  relationshipNotes: z.string().max(2000).optional().nullable(),
});

export type UpdateClientCommercialInput = z.infer<typeof UpdateClientCommercialSchema>;

export const CreateClientContactSchema = z.object({
  name: z.string().min(2, 'Contact name must be at least 2 characters').max(80),
  designation: z.string().max(80).optional().nullable(),
  email: z.string().email('Valid email address required'),
  phone: z.string().max(30).optional().nullable(),
  contactType: z.string().default('HIRING_MANAGER'),
  isPrimary: z.boolean().default(false),
});

export const UpdateClientContactSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  designation: z.string().max(80).optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional().nullable(),
  contactType: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export type UpdateClientContactInput = z.infer<typeof UpdateClientContactSchema>;

export const ArchiveClientSchema = z.object({
  reason: z.string().min(3, 'Archive reason is required (minimum 3 characters)').max(300),
});

export type ArchiveClientInput = z.infer<typeof ArchiveClientSchema>;

export const RestoreClientSchema = z.object({
  reason: z.string().max(300).optional().nullable(),
});

export type RestoreClientInput = z.infer<typeof RestoreClientSchema>;

export const VerifyClientDocumentSchema = z.object({
  isVerified: z.boolean(),
});

export type VerifyClientDocumentInput = z.infer<typeof VerifyClientDocumentSchema>;

// ============================================================================
// 4. DATA TRANSFER OBJECTS (STRICT ROLE SERIALIZATION & LEAK PREVENTION)
// ============================================================================

/**
 * Standard Client Summary DTO for table views and client-facing responses.
 * SECURITY: NEVER contains feePercentage, commercialTerms, paymentTerms, or relationshipNotes!
 */
export interface ClientSummaryDTO {
  id: string;
  code: string;
  legalName: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  status: ClientStatus;
  isArchived: boolean;
  archivedAt: string | null;
  archiveReason: string | null;
  nextStep: string | null;
  primaryContact: {
    id: string;
    name: string;
    email: string;
    designation: string | null;
  } | null;
  openJobsCount: number;
  relationshipOwner: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Explicit Internal-Only Commercial Terms DTO.
 * Restricted strictly to ADMIN or recruiters with recruiterViewInternalFees grant.
 */
export interface ClientCommercialDTO {
  clientId: string;
  commercialTerms: string | null;
  feePercentage: number | null;
  paymentTerms: string | null;
  relationshipNotes: string | null;
  updatedAt: string;
}

/**
 * Detailed Client DTO for Client Record Header and Overview tab.
 * Does NOT contain internal commercial fields.
 */
export interface ClientDetailDTO {
  id: string;
  code: string;
  legalName: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  status: ClientStatus;
  isArchived: boolean;
  archivedAt: string | null;
  archiveReason: string | null;
  nextStep: string | null;
  relationshipOwner: {
    id: string;
    name: string;
    email: string;
  } | null;
  openJobsCount: number;
  contactsCount: number;
  documentsCount: number;
  meetingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientContactDTO {
  id: string;
  clientId: string;
  name: string;
  designation: string | null;
  email: string;
  phone: string | null;
  contactType: string;
  isPrimary: boolean;
  hasPortalAccess: boolean;
  portalUserId: string | null;
  portalUserStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientJobDTO {
  id: string;
  code: string;
  title: string;
  status: string;
  openings: number;
  candidateCount: number;
  owner: {
    id: string;
    name: string;
    email: string;
  } | null;
  hiringManager: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDocumentDTO {
  id: string;
  clientId: string;
  fileName: string;
  storageKey: string | null;
  storageBucket: string;
  documentType: string;
  version: number;
  fileSize: number;
  mimeType: string;
  checksum: string | null;
  isVerified: boolean;
  verifiedBy: {
    id: string;
    name: string;
  } | null;
  verifiedAt: string | null;
  uploadedBy: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientMeetingDTO {
  id: string;
  clientId: string;
  title: string;
  meetingType: string;
  status: string;
  scheduledAt: string;
  participants: string[];
  notes: string | null;
  organizer: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
}

export interface ClientActivityDTO {
  id: string;
  type: 'MEETING' | 'AUDIT_LOG' | 'DOCUMENT_UPLOAD' | 'DOCUMENT_VERIFIED';
  title: string;
  description: string | null;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    email?: string;
  } | null;
  metadata?: Record<string, any>;
}

export interface ClientCRMStatsDTO {
  activeCount: number;
  prospectCount: number;
  meetingsCount: number;
}
