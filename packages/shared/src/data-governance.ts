/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { UserRole } from './roles';

// ==========================================
// 1. DATA GOVERNANCE ENTITIES & EXPORT CATALOGS
// ==========================================

export type ExportEntityType =
  | 'CANDIDATES'
  | 'JOBS'
  | 'CLIENTS'
  | 'APPLICATIONS'
  | 'SUBMISSIONS'
  | 'INTERVIEWS'
  | 'PLACEMENTS'
  | 'AUDIT_LOGS';

export interface ColumnDefinition {
  key: string;
  label: string;
  isDefault: boolean;
  isSensitive?: boolean; // Requires elevated permissions (e.g. salary)
}

export const EXPORT_ENTITY_CATALOG: Record<
  ExportEntityType,
  {
    label: string;
    description: string;
    columns: ColumnDefinition[];
  }
> = {
  CANDIDATES: {
    label: 'Candidates',
    description: 'Candidate talent profiles, contact details, skills, and current employment.',
    columns: [
      { key: 'code', label: 'Candidate Code', isDefault: true },
      { key: 'name', label: 'Full Name', isDefault: true },
      { key: 'email', label: 'Email Address', isDefault: true },
      { key: 'phone', label: 'Phone Number', isDefault: true },
      { key: 'currentTitle', label: 'Current Title', isDefault: true },
      { key: 'currentCompany', label: 'Current Company', isDefault: true },
      { key: 'experienceYears', label: 'Experience (Years)', isDefault: true },
      { key: 'location', label: 'Location', isDefault: true },
      { key: 'skills', label: 'Core Skills', isDefault: true },
      { key: 'noticePeriod', label: 'Notice Period', isDefault: true },
      { key: 'status', label: 'Status', isDefault: true },
      { key: 'ownerName', label: 'Recruiter Owner', isDefault: true },
      { key: 'createdAt', label: 'Profile Created Date', isDefault: true },
      // Sensitive fields (excluded by default, requires ADMIN or explicit grant)
      { key: 'currentSalary', label: 'Current Salary (INR)', isDefault: false, isSensitive: true },
      { key: 'expectedSalary', label: 'Expected Salary (INR)', isDefault: false, isSensitive: true },
    ],
  },
  JOBS: {
    label: 'Job Mandates',
    description: 'Active, paused, and closed hiring mandates across client accounts.',
    columns: [
      { key: 'code', label: 'Job Code', isDefault: true },
      { key: 'title', label: 'Job Title', isDefault: true },
      { key: 'clientName', label: 'Client Company', isDefault: true },
      { key: 'employmentType', label: 'Employment Type', isDefault: true },
      { key: 'openings', label: 'Openings', isDefault: true },
      { key: 'location', label: 'Location', isDefault: true },
      { key: 'status', label: 'Lifecycle Status', isDefault: true },
      { key: 'ownerName', label: 'Mandate Owner', isDefault: true },
      { key: 'createdAt', label: 'Opened Date', isDefault: true },
      // Sensitive salary bands
      { key: 'salaryMin', label: 'Minimum Budget Band', isDefault: false, isSensitive: true },
      { key: 'salaryMax', label: 'Maximum Budget Band', isDefault: false, isSensitive: true },
    ],
  },
  CLIENTS: {
    label: 'Client Companies',
    description: 'Corporate client accounts, relationship owners, and active engagement tiers.',
    columns: [
      { key: 'code', label: 'Client Code', isDefault: true },
      { key: 'legalName', label: 'Legal Company Name', isDefault: true },
      { key: 'industry', label: 'Industry', isDefault: true },
      { key: 'website', label: 'Website', isDefault: true },
      { key: 'location', label: 'Headquarters Location', isDefault: true },
      { key: 'status', label: 'Account Status', isDefault: true },
      { key: 'relationshipOwnerName', label: 'Relationship Lead', isDefault: true },
      { key: 'createdAt', label: 'Onboarded Date', isDefault: true },
    ],
  },
  APPLICATIONS: {
    label: 'Applications',
    description: 'Candidate applications across job mandates and active hiring pipelines.',
    columns: [
      { key: 'id', label: 'Application ID', isDefault: true },
      { key: 'candidateCode', label: 'Candidate Code', isDefault: true },
      { key: 'candidateName', label: 'Candidate Name', isDefault: true },
      { key: 'jobCode', label: 'Job Code', isDefault: true },
      { key: 'jobTitle', label: 'Job Title', isDefault: true },
      { key: 'clientName', label: 'Client Company', isDefault: true },
      { key: 'status', label: 'Current Pipeline Stage', isDefault: true },
      { key: 'appliedAt', label: 'Application Date', isDefault: true },
    ],
  },
  SUBMISSIONS: {
    label: 'Client Submissions',
    description: 'Formal candidate shortlists delivered to client hiring managers.',
    columns: [
      { key: 'code', label: 'Submission Code', isDefault: true },
      { key: 'candidateName', label: 'Candidate Name', isDefault: true },
      { key: 'jobTitle', label: 'Job Title', isDefault: true },
      { key: 'clientName', label: 'Client Name', isDefault: true },
      { key: 'approvalStatus', label: 'Approval Status', isDefault: true },
      { key: 'version', label: 'Profile Version', isDefault: true },
      { key: 'submittedByName', label: 'Submitted By', isDefault: true },
      { key: 'createdAt', label: 'Submission Date', isDefault: true },
    ],
  },
  INTERVIEWS: {
    label: 'Scheduled Interviews',
    description: 'Candidate interview schedules, panels, modes, and outcomes.',
    columns: [
      { key: 'id', label: 'Interview ID', isDefault: true },
      { key: 'candidateName', label: 'Candidate Name', isDefault: true },
      { key: 'jobTitle', label: 'Job Title', isDefault: true },
      { key: 'roundName', label: 'Evaluation Round', isDefault: true },
      { key: 'scheduledAt', label: 'Scheduled Time (UTC)', isDefault: true },
      { key: 'durationMinutes', label: 'Duration (Minutes)', isDefault: true },
      { key: 'mode', label: 'Interview Mode', isDefault: true },
      { key: 'status', label: 'Outcome Status', isDefault: true },
    ],
  },
  PLACEMENTS: {
    label: 'Offers & Placements',
    description: 'Accepted offers and successful candidate placements.',
    columns: [
      { key: 'id', label: 'Placement ID', isDefault: true },
      { key: 'candidateName', label: 'Candidate Name', isDefault: true },
      { key: 'jobTitle', label: 'Job Title', isDefault: true },
      { key: 'clientName', label: 'Client Name', isDefault: true },
      { key: 'recruiterName', label: 'Placing Recruiter', isDefault: true },
      { key: 'placementDate', label: 'Placement Date', isDefault: true },
      { key: 'offeredSalary', label: 'Offered Compensation', isDefault: false, isSensitive: true },
    ],
  },
  AUDIT_LOGS: {
    label: 'Audit Trail Records',
    description: 'System-wide compliance audit log records with actor attribution.',
    columns: [
      { key: 'createdAt', label: 'Timestamp (UTC)', isDefault: true },
      { key: 'actorName', label: 'Actor Name', isDefault: true },
      { key: 'actorRole', label: 'Actor Role', isDefault: true },
      { key: 'action', label: 'Action Performed', isDefault: true },
      { key: 'entity', label: 'Entity Type', isDefault: true },
      { key: 'entityId', label: 'Entity Identifier', isDefault: true },
      { key: 'ipAddress', label: 'Client IP Address', isDefault: false, isSensitive: true },
    ],
  },
};

// Forbidden Fields that must NEVER be exported under any circumstance
export const FORBIDDEN_EXPORT_FIELDS = new Set([
  'notes',
  'internalNotes',
  'feePercentage',
  'commercialTerms',
  'recruiterMargin',
  'passwordHash',
  'tokenHash',
  'storageKey',
  'fileUrl',
  'otpHashed',
  'challengeHash',
]);

// ==========================================
// 2. CSV EXPORT & FORMULA INJECTION DEFENSE
// ==========================================

/**
 * Sanitizes a cell string to prevent Spreadsheet Formula Injection (CSV Injection).
 * If a cell begins with '=', '+', '-', '@', '\t', or '\r', prefix with a single quote (').
 */
export function sanitizeForCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Check for dangerous formula trigger prefixes
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes by doubling them
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string from headers and row objects.
 */
export function generateCsvString(headers: { key: string; label: string }[], rows: Record<string, any>[]): string {
  const headerLine = headers.map((h) => sanitizeForCsv(h.label)).join(',');
  const rowLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key];
        if (Array.isArray(val)) {
          return sanitizeForCsv(val.join('; '));
        }
        if (val instanceof Date) {
          return sanitizeForCsv(val.toISOString());
        }
        return sanitizeForCsv(val);
      })
      .join(',')
  );

  return [headerLine, ...rowLines].join('\r\n');
}

// ==========================================
// 3. AUDIT TRAIL SENSITIVE SECRET SCRUBBER
// ==========================================

const SENSITIVE_KEY_REGEX = /password|token|otp|secret|cookie|hash|auth|salt|key|bearer/i;

/**
 * Recursively redacts sensitive credentials and authentication secrets from audit log before/after payloads.
 */
export function redactAuditSecrets(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactAuditSecrets);
  }

  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      cleaned[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      cleaned[k] = redactAuditSecrets(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

// ==========================================
// 4. CUSTOM FIELDS VALIDATION ENGINE
// ==========================================

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'URL' | 'SELECT' | 'MULTI_SELECT';
export type CustomFieldVisibility = 'INTERNAL_ONLY' | 'CLIENT_PROFILE_INCLUDED';
export type CustomFieldEntityType = 'CANDIDATE' | 'JOB' | 'CLIENT';

export interface CustomFieldValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: any;
}

/**
 * Validates a custom field value against its definition and rules.
 */
export function validateCustomFieldValue(
  value: any,
  definition: {
    fieldType: string;
    isRequired?: boolean;
    options?: string[];
    validationRules?: {
      minLength?: number;
      maxLength?: number;
      minValue?: number;
      maxValue?: number;
      minDate?: string;
      maxDate?: string;
      pattern?: string;
      maxItems?: number;
    } | null;
  }
): CustomFieldValidationResult {
  const rules = definition.validationRules || {};

  // Check required
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    if (definition.isRequired) {
      return { isValid: false, error: 'This field is required.' };
    }
    return { isValid: true, sanitizedValue: null };
  }

  switch (definition.fieldType as CustomFieldType) {
    case 'TEXT': {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a text string.' };
      }
      const trimmed = value.trim();
      if (rules.minLength !== undefined && trimmed.length < rules.minLength) {
        return { isValid: false, error: `Must be at least ${rules.minLength} characters.` };
      }
      if (rules.maxLength !== undefined && trimmed.length > rules.maxLength) {
        return { isValid: false, error: `Must be at most ${rules.maxLength} characters.` };
      }
      if (rules.pattern) {
        try {
          const reg = new RegExp(rules.pattern);
          if (!reg.test(trimmed)) {
            return { isValid: false, error: 'Value does not match required format pattern.' };
          }
        } catch {
          // ignore bad regex pattern
        }
      }
      return { isValid: true, sanitizedValue: trimmed };
    }

    case 'NUMBER': {
      const num = Number(value);
      if (isNaN(num)) {
        return { isValid: false, error: 'Must be a valid number.' };
      }
      if (rules.minValue !== undefined && num < rules.minValue) {
        return { isValid: false, error: `Value must be greater than or equal to ${rules.minValue}.` };
      }
      if (rules.maxValue !== undefined && num > rules.maxValue) {
        return { isValid: false, error: `Value must be less than or equal to ${rules.maxValue}.` };
      }
      return { isValid: true, sanitizedValue: num };
    }

    case 'DATE': {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return { isValid: false, error: 'Must be a valid date.' };
      }
      if (rules.minDate && d < new Date(rules.minDate)) {
        return { isValid: false, error: `Date cannot be earlier than ${rules.minDate}.` };
      }
      if (rules.maxDate && d > new Date(rules.maxDate)) {
        return { isValid: false, error: `Date cannot be later than ${rules.maxDate}.` };
      }
      return { isValid: true, sanitizedValue: d.toISOString().split('T')[0] };
    }

    case 'URL': {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a valid URL string.' };
      }
      const trimmed = value.trim();
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { isValid: false, error: 'Only http: and https: protocols are permitted.' };
        }
        return { isValid: true, sanitizedValue: parsed.toString() };
      } catch {
        return { isValid: false, error: 'Invalid URL format.' };
      }
    }

    case 'SELECT': {
      const allowed = definition.options || [];
      if (!allowed.includes(String(value))) {
        return { isValid: false, error: `Value must be one of: ${allowed.join(', ')}.` };
      }
      return { isValid: true, sanitizedValue: String(value) };
    }

    case 'MULTI_SELECT': {
      if (!Array.isArray(value)) {
        return { isValid: false, error: 'Value must be an array of selected options.' };
      }
      const allowed = definition.options || [];
      const invalid = value.filter((v) => !allowed.includes(String(v)));
      if (invalid.length > 0) {
        return { isValid: false, error: `Invalid options selected: ${invalid.join(', ')}.` };
      }
      if (rules.maxItems !== undefined && value.length > rules.maxItems) {
        return { isValid: false, error: `Cannot select more than ${rules.maxItems} options.` };
      }
      return { isValid: true, sanitizedValue: value.map(String) };
    }

    default:
      return { isValid: true, sanitizedValue: value };
  }
}

// Zod Schemas for Custom Field Administration
export const CreateCustomFieldDefinitionSchema = z.object({
  entityType: z.enum(['CANDIDATE', 'JOB', 'CLIENT']),
  fieldName: z.string().min(2).max(100),
  fieldKey: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Field key must contain only lowercase letters, numbers, and underscores (snake_case)'),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'URL', 'SELECT', 'MULTI_SELECT']),
  description: z.string().max(300).optional(),
  options: z.array(z.string().min(1)).default([]),
  isRequired: z.boolean().default(false),
  visibility: z.enum(['INTERNAL_ONLY', 'CLIENT_PROFILE_INCLUDED']).default('INTERNAL_ONLY'),
  validationRules: z
    .object({
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().min(1).optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      minDate: z.string().optional(),
      maxDate: z.string().optional(),
      pattern: z.string().optional(),
      maxItems: z.number().int().min(1).optional(),
    })
    .optional(),
  defaultValue: z.any().optional(),
  displayOrder: z.number().int().default(0),
});
export type CreateCustomFieldDefinitionInput = z.infer<typeof CreateCustomFieldDefinitionSchema>;

export const UpdateCustomFieldDefinitionSchema = CreateCustomFieldDefinitionSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCustomFieldDefinitionInput = z.infer<typeof UpdateCustomFieldDefinitionSchema>;

// Required-per-Client Custom Field Rule Schema
export const SetClientCustomFieldRuleSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  fieldDefinitionId: z.string().min(1, 'Field Definition ID is required'),
  isRequired: z.boolean().default(true),
  workflowVersion: z.number().int().default(1),
});
export type SetClientCustomFieldRuleInput = z.infer<typeof SetClientCustomFieldRuleSchema>;

// ==========================================
// 5. DOWNLOAD POLICY & ASIA/KOLKATA DAY BOUNDS
// ==========================================

export const DEFAULT_DAILY_DOWNLOAD_LIMITS: Record<UserRole, number> = {
  [UserRole.RECRUITER]: 50,
  [UserRole.MANAGER]: 100,
  [UserRole.CLIENT]: 25,
  [UserRole.ADMIN]: 500,
  [UserRole.CANDIDATE]: 0,
};

/**
 * Returns the exact UTC Date objects corresponding to the start and end of the current
 * calendar day in Indian Standard Time (Asia/Kolkata, UTC+5:30).
 */
export function getKolkataDayBounds(now: Date = new Date()): { startUtc: Date; endUtc: Date } {
  // Asia/Kolkata is UTC + 5h30m (330 minutes)
  const offsetMs = (5 * 60 + 30) * 60 * 1000;
  const kolkataTime = new Date(now.getTime() + offsetMs);

  const year = kolkataTime.getUTCFullYear();
  const month = kolkataTime.getUTCMonth();
  const date = kolkataTime.getUTCDate();

  // Midnight start in Kolkata -> convert back to UTC
  const startKolkataUtc = Date.UTC(year, month, date, 0, 0, 0, 0);
  const startUtc = new Date(startKolkataUtc - offsetMs);

  // 23:59:59.999 in Kolkata -> convert back to UTC
  const endKolkataUtc = Date.UTC(year, month, date, 23, 59, 59, 999);
  const endUtc = new Date(endKolkataUtc - offsetMs);

  return { startUtc, endUtc };
}

/**
 * Calculates download usage and remaining quota.
 */
export function calculateDownloadUsage(params: {
  role: UserRole;
  configuredLimit?: number | null;
  downloadsUsedToday: number;
}): {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  isExceeded: boolean;
} {
  const dailyLimit = params.configuredLimit ?? DEFAULT_DAILY_DOWNLOAD_LIMITS[params.role] ?? 50;
  const usedToday = Math.max(0, params.downloadsUsedToday);
  const remaining = Math.max(0, dailyLimit - usedToday);
  const isExceeded = usedToday >= dailyLimit;

  return {
    dailyLimit,
    usedToday,
    remaining,
    isExceeded,
  };
}

// ==========================================
// 6. ZOD SCHEMAS FOR SCOPED EXPORTS & ARCHIVE
// ==========================================

export const CreateExportRequestSchema = z.object({
  entityType: z.enum([
    'CANDIDATES',
    'JOBS',
    'CLIENTS',
    'APPLICATIONS',
    'SUBMISSIONS',
    'INTERVIEWS',
    'PLACEMENTS',
    'AUDIT_LOGS',
  ]),
  format: z.enum(['CSV', 'XLSX']).default('CSV'),
  selectedColumns: z.array(z.string()).min(1, 'At least one column must be selected for export'),
  filters: z
    .object({
      clientId: z.string().optional(),
      jobId: z.string().optional(),
      status: z.string().optional(),
      dateRange: z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          dateField: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});
export type CreateExportRequestInput = z.infer<typeof CreateExportRequestSchema>;

export const RestoreArchivedCandidateSchema = z.object({
  reason: z.string().min(5, 'A clear justification is mandatory to restore an archived candidate record'),
});
export type RestoreArchivedCandidateInput = z.infer<typeof RestoreArchivedCandidateSchema>;

export const UpdateDownloadPolicySchema = z.object({
  role: z.enum(['RECRUITER', 'MANAGER', 'CLIENT', 'ADMIN']),
  dailyCvLimit: z.number().int().min(0).max(5000),
  requireWatermark: z.boolean().default(true),
  allowOriginalDownload: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type UpdateDownloadPolicyInput = z.infer<typeof UpdateDownloadPolicySchema>;
