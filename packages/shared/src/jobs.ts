import { z } from 'zod';
import { UserRole } from './roles';

// ==========================================
// 1. ENUMS & CONSTANTS
// ==========================================

export enum JobStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
}

export enum InterviewType {
  SCREENING = 'SCREENING',
  TECHNICAL = 'TECHNICAL',
  HIRING_MANAGER = 'HIRING_MANAGER',
  CULTURE_FIT = 'CULTURE_FIT',
  EXECUTIVE = 'EXECUTIVE',
  VIDEO = 'VIDEO',
  IN_PERSON = 'IN_PERSON',
}

export enum JobClosingReason {
  POSITION_FILLED = 'POSITION_FILLED',
  BUDGET_CANCELLED = 'BUDGET_CANCELLED',
  ROLE_WITHDRAWN = 'ROLE_WITHDRAWN',
  HIRED_INTERNALLY = 'HIRED_INTERNALLY',
  OTHER = 'OTHER',
}

export enum JobPauseReason {
  CLIENT_HOLD = 'CLIENT_HOLD',
  BUDGET_REVIEW = 'BUDGET_REVIEW',
  PRIORITY_SHIFT = 'PRIORITY_SHIFT',
  OTHER = 'OTHER',
}

export enum ReassignmentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// ==========================================
// 2. CODE GENERATION
// ==========================================

/**
 * Generate the next sequential job code (e.g. J-201 ... J-209, J-210)
 * Scans existing codes for highest integer >= 200 and increments.
 */
export function generateJobCode(existingCodes: string[]): string {
  let maxNumber = 200;
  const pattern = /^J-(\d+)$/i;

  for (const code of existingCodes) {
    if (!code) continue;
    const match = code.trim().match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return `J-${maxNumber + 1}`;
}

// ==========================================
// 3. STATE MACHINE & VALIDATION
// ==========================================

export interface JobStateTransitionResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether a job can transition from currentStatus to targetStatus.
 * Default Phase 1 flag: requireJobApproval = false (direct activation allowed).
 */
export function isValidJobStatusTransition(
  currentStatus: JobStatus,
  targetStatus: JobStatus,
  requireJobApproval = false
): JobStateTransitionResult {
  if (currentStatus === targetStatus) {
    return { valid: false, reason: `Job is already in status ${currentStatus}` };
  }

  switch (currentStatus) {
    case JobStatus.DRAFT:
      if (requireJobApproval) {
        if (targetStatus === JobStatus.PENDING_APPROVAL) return { valid: true };
        return {
          valid: false,
          reason: 'Job approval is required before activating. Submit to PENDING_APPROVAL.',
        };
      } else {
        if (targetStatus === JobStatus.ACTIVE || targetStatus === JobStatus.PENDING_APPROVAL) {
          return { valid: true };
        }
        return { valid: false, reason: `Cannot transition directly from DRAFT to ${targetStatus}` };
      }

    case JobStatus.PENDING_APPROVAL:
      if (targetStatus === JobStatus.ACTIVE || targetStatus === JobStatus.DRAFT) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `PENDING_APPROVAL jobs can only be approved to ACTIVE or returned to DRAFT`,
      };

    case JobStatus.ACTIVE:
      if (targetStatus === JobStatus.PAUSED || targetStatus === JobStatus.CLOSED) {
        return { valid: true };
      }
      return { valid: false, reason: `ACTIVE jobs can only transition to PAUSED or CLOSED` };

    case JobStatus.PAUSED:
      if (targetStatus === JobStatus.ACTIVE || targetStatus === JobStatus.CLOSED) {
        return { valid: true };
      }
      return { valid: false, reason: `PAUSED jobs can only be resumed to ACTIVE or CLOSED` };

    case JobStatus.CLOSED:
      if (targetStatus === JobStatus.ACTIVE || targetStatus === JobStatus.DRAFT) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `CLOSED jobs can only be reopened to ACTIVE or returned to DRAFT`,
      };

    default:
      return { valid: false, reason: `Unknown status ${currentStatus}` };
  }
}

/**
 * Server-side application submission guard:
 * Only ACTIVE jobs can accept candidate applications/submissions.
 * PAUSED and CLOSED jobs strictly reject submissions.
 */
export function canJobAcceptApplications(status: JobStatus): boolean {
  return status === JobStatus.ACTIVE;
}

// ==========================================
// 4. "FILLED THIS MONTH" DATE RANGE HELPER
// ==========================================

/**
 * Calculates start and end timestamps in UTC for the current calendar month in a given time zone.
 * Default time zone: Asia/Kolkata (Aureva Capital tenant default).
 */
export function getCurrentMonthDateRange(timeZone = 'Asia/Kolkata'): {
  startUtc: Date;
  endUtc: Date;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const yearStr = parts.find((p) => p.type === 'year')?.value || `${now.getFullYear()}`;
  const monthStr = parts.find((p) => p.type === 'month')?.value || `${now.getMonth() + 1}`.padStart(2, '0');

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Month starts at day 1 00:00:00 local time
  // For Asia/Kolkata (UTC+5:30), offset is -330 minutes
  const startLocal = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  // Month ends at last day 23:59:59.999 local time
  const endLocal = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Determine timezone offset in minutes
  const tzOffsetMinutes = getTimezoneOffsetMinutes(timeZone, now);
  const startUtc = new Date(startLocal.getTime() - tzOffsetMinutes * 60 * 1000);
  const endUtc = new Date(endLocal.getTime() - tzOffsetMinutes * 60 * 1000);

  return { startUtc, endUtc };
}

function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const dString = date.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
    const match = dString.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 330; // fallback to +5:30 (India)
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 60 + minutes);
  } catch {
    return 330;
  }
}

// ==========================================
// 5. ZOD SCHEMAS FOR VALIDATION
// ==========================================

export const CreateJobInputSchema = z
  .object({
    title: z.string().min(2, 'Job title must be at least 2 characters').max(100),
    clientId: z.string().min(1, 'Valid client ID is required'),
    hiringManagerContactId: z.string().min(1).optional().nullable(),
    ownerId: z.string().min(1).optional().nullable(),
    openings: z.coerce.number().int().min(1, 'Openings must be at least 1').default(1),
    location: z.string().max(100).optional().nullable(),
    employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
    salaryMin: z.coerce.number().min(0).optional().nullable(),
    salaryMax: z.coerce.number().min(0).optional().nullable(),
    description: z.string().optional().nullable(),
    requirements: z.string().optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
    assignedRecruiterIds: z.array(z.string().min(1)).default([]),
    initialRounds: z
      .array(
        z.object({
          name: z.string().min(2),
          roundOrder: z.number().int().min(1),
          interviewType: z.string().default('VIDEO'),
          durationMinutes: z.number().int().default(45),
          description: z.string().optional().nullable(),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    {
      message: 'Maximum salary must be greater than or equal to minimum salary',
      path: ['salaryMax'],
    }
  );

export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

export const UpdateJobInputSchema = z
  .object({
    title: z.string().min(2).max(100).optional(),
    hiringManagerContactId: z.string().min(1).optional().nullable(),
    ownerId: z.string().min(1).optional().nullable(),
    openings: z.coerce.number().int().min(1).optional(),
    location: z.string().max(100).optional().nullable(),
    employmentType: z.nativeEnum(EmploymentType).optional(),
    salaryMin: z.coerce.number().min(0).optional().nullable(),
    salaryMax: z.coerce.number().min(0).optional().nullable(),
    description: z.string().optional().nullable(),
    requirements: z.string().optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    {
      message: 'Maximum salary must be greater than or equal to minimum salary',
      path: ['salaryMax'],
    }
  );

export type UpdateJobInput = z.infer<typeof UpdateJobInputSchema>;

export const TransitionJobStatusSchema = z.object({
  targetStatus: z.nativeEnum(JobStatus),
  reason: z.string().optional(),
  closingNote: z.string().optional(),
  note: z.string().optional(),
});

export type TransitionJobStatusInput = z.infer<typeof TransitionJobStatusSchema>;

export const CreateJobRoundSchema = z.object({
  name: z.string().min(2, 'Round name must be at least 2 characters'),
  roundOrder: z.coerce.number().int().min(1),
  interviewType: z.string().default('VIDEO'),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(45),
  panelMembers: z.array(z.string()).default([]),
  description: z.string().optional().nullable(),
});

export type CreateJobRoundInput = z.infer<typeof CreateJobRoundSchema>;

export const UpdateJobRoundSchema = z.object({
  name: z.string().min(2).optional(),
  interviewType: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(240).optional(),
  panelMembers: z.array(z.string()).optional(),
  description: z.string().optional().nullable(),
});

export type UpdateJobRoundInput = z.infer<typeof UpdateJobRoundSchema>;

export const ReorderJobRoundsSchema = z.object({
  roundIds: z.array(z.string().min(1)).min(1, 'At least one round required'),
});

export type ReorderJobRoundsInput = z.infer<typeof ReorderJobRoundsSchema>;

export const CreateReassignmentRequestSchema = z.object({
  targetRecruiterId: z.string().min(1).optional().nullable(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

export type CreateReassignmentRequestInput = z.infer<typeof CreateReassignmentRequestSchema>;

export const ReviewReassignmentRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().optional(),
});

export type ReviewReassignmentRequestInput = z.infer<typeof ReviewReassignmentRequestSchema>;

export const JobQueryFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(JobStatus).optional(),
  clientId: z.string().optional(),
  ownerId: z.string().optional(),
  location: z.string().optional(),
  includeArchived: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'title', 'code', 'deadline', 'openings']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type JobQueryFilters = z.infer<typeof JobQueryFiltersSchema>;

// ==========================================
// 6. DTOs & SERIALIZATION (ANTI-LEAK)
// ==========================================

export interface SerializedJobRoundDto {
  id: string;
  name: string;
  roundOrder: number;
  interviewType: string;
  durationMinutes: number;
  panelMembers: string[];
  description?: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface SerializedJobAssignmentDto {
  id: string;
  recruiterId: string;
  recruiterName: string;
  recruiterEmail: string;
  assignedById: string;
  assignedByName?: string;
  status: string;
  createdAt: string;
}

export interface SerializedJobStatusHistoryDto {
  id: string;
  previousStatus?: JobStatus | null;
  newStatus: JobStatus;
  changedById: string;
  changedByName?: string;
  reason?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface SerializedJobReassignmentRequestDto {
  id: string;
  jobId: string;
  requestingRecruiterId: string;
  requestingRecruiterName: string;
  targetRecruiterId?: string | null;
  targetRecruiterName?: string | null;
  reason: string;
  status: string;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
}

export interface SerializedJobDto {
  id: string;
  code: string;
  title: string;
  clientId: string;
  clientName: string;
  clientCode?: string;
  description?: string | null;
  requirements?: string | null;
  employmentType: string;
  ownerId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  hiringManagerContactId?: string | null;
  hiringManagerName?: string | null;
  hiringManagerEmail?: string | null;
  openings: number;
  location?: string | null;
  deadline?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  status: JobStatus;
  closingReason?: string | null;
  closingNote?: string | null;
  pauseReason?: string | null;
  resumeReason?: string | null;
  reopenReason?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  candidateCount?: number;
  rounds?: SerializedJobRoundDto[];
  assignments?: SerializedJobAssignmentDto[];
  statusHistories?: SerializedJobStatusHistoryDto[];
  reassignmentRequests?: SerializedJobReassignmentRequestDto[];
}

/**
 * Anti-leak serializer for Job records.
 * Ensures internal recruiter margin terms, commercial fee terms, or restricted internal fields
 * are never leaked to Client or Candidate roles.
 */
export function serializeJob(
  job: any,
  viewerRole: UserRole = UserRole.RECRUITER
): SerializedJobDto {
  const isInternal =
    viewerRole === UserRole.ADMIN ||
    viewerRole === UserRole.MANAGER ||
    viewerRole === UserRole.RECRUITER;

  return {
    id: job.id,
    code: job.code,
    title: job.title,
    clientId: job.clientId,
    clientName: job.client?.legalName || job.clientName || 'Unknown Client',
    clientCode: job.client?.code || job.clientCode,
    description: job.description ?? null,
    requirements: job.requirements ?? null,
    employmentType: job.employmentType || 'FULL_TIME',
    ownerId: job.ownerId ?? null,
    ownerName: job.owner?.name ?? null,
    ownerEmail: isInternal ? job.owner?.email ?? null : null,
    hiringManagerContactId: job.hiringManagerContactId ?? null,
    hiringManagerName: job.hiringManagerContact?.name ?? null,
    hiringManagerEmail: isInternal ? job.hiringManagerContact?.email ?? null : null,
    openings: job.openings,
    location: job.location ?? null,
    deadline: job.deadline ? new Date(job.deadline).toISOString() : null,
    salaryMin: job.salaryMin != null ? Number(job.salaryMin) : null,
    salaryMax: job.salaryMax != null ? Number(job.salaryMax) : null,
    status: job.status as JobStatus,
    closingReason: job.closingReason ?? null,
    closingNote: isInternal ? job.closingNote ?? null : null,
    pauseReason: job.pauseReason ?? null,
    resumeReason: isInternal ? job.resumeReason ?? null : null,
    reopenReason: isInternal ? job.reopenReason ?? null : null,
    isArchived: job.isArchived ?? false,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
    candidateCount: job._count?.applications ?? (job.applications ? job.applications.length : 0),
    rounds: job.rounds
      ? job.rounds.map((r: any) => ({
          id: r.id,
          name: r.name,
          roundOrder: r.roundOrder,
          interviewType: r.interviewType || 'VIDEO',
          durationMinutes: r.durationMinutes || 45,
          panelMembers: r.panelMembers || [],
          description: r.description ?? null,
          isArchived: r.isArchived ?? false,
          createdAt: new Date(r.createdAt).toISOString(),
        }))
      : undefined,
    assignments: isInternal && job.assignments
      ? job.assignments.map((a: any) => ({
          id: a.id,
          recruiterId: a.recruiterId,
          recruiterName: a.recruiter?.name || 'Unknown Recruiter',
          recruiterEmail: a.recruiter?.email || '',
          assignedById: a.assignedById,
          assignedByName: a.assignedBy?.name,
          status: a.status,
          createdAt: new Date(a.createdAt).toISOString(),
        }))
      : undefined,
    statusHistories: isInternal && job.statusHistories
      ? job.statusHistories.map((h: any) => ({
          id: h.id,
          previousStatus: h.previousStatus as JobStatus | null,
          newStatus: h.newStatus as JobStatus,
          changedById: h.changedById,
          changedByName: h.changedByName || h.user?.name,
          reason: h.reason ?? null,
          note: h.note ?? null,
          createdAt: new Date(h.createdAt).toISOString(),
        }))
      : undefined,
    reassignmentRequests: isInternal && job.reassignmentRequests
      ? job.reassignmentRequests.map((req: any) => ({
          id: req.id,
          jobId: req.jobId,
          requestingRecruiterId: req.requestingRecruiterId,
          requestingRecruiterName: req.requestingRecruiter?.name || 'Unknown',
          targetRecruiterId: req.targetRecruiterId ?? null,
          targetRecruiterName: req.targetRecruiter?.name ?? null,
          reason: req.reason,
          status: req.status,
          reviewedById: req.reviewedById ?? null,
          reviewedByName: req.reviewedBy?.name ?? null,
          reviewedAt: req.reviewedAt ? new Date(req.reviewedAt).toISOString() : null,
          reviewNotes: req.reviewNotes ?? null,
          createdAt: new Date(req.createdAt).toISOString(),
        }))
      : undefined,
  };
}
