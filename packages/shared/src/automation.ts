import { z } from 'zod';
import { SUPPORTED_MERGE_FIELDS, SupportedMergeField } from './communications';

// ==========================================
// 1. TASK ENUMS, SCHEMAS & TYPES
// ==========================================

export enum TaskPriorityEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatusEnum {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const TaskRelatedEntityEnum = z.enum([
  'CANDIDATE',
  'JOB',
  'CLIENT',
  'INTERVIEW',
  'APPLICATION',
  'SUBMISSION',
  'APPROVAL',
]);

export type TaskRelatedEntity = z.infer<typeof TaskRelatedEntityEnum>;

export const CreateTaskSchema = z.object({
  title: z.string().min(2, 'Task title must be at least 2 characters').max(200),
  description: z.string().max(2000).optional().nullable(),
  assignedToId: z.string().min(1, 'Valid assignee ID is required'),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  priority: z.nativeEnum(TaskPriorityEnum).default(TaskPriorityEnum.MEDIUM),
  relatedEntity: TaskRelatedEntityEnum.optional().nullable(),
  relatedEntityId: z.string().optional().nullable(),
  reminderAt: z.string().datetime({ offset: true }).optional().nullable(),
  creatorNotes: z.string().max(1000).optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  assignedToId: z.string().min(1).optional(),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  priority: z.nativeEnum(TaskPriorityEnum).optional(),
  status: z.nativeEnum(TaskStatusEnum).optional(),
  relatedEntity: TaskRelatedEntityEnum.optional().nullable(),
  relatedEntityId: z.string().optional().nullable(),
  reminderAt: z.string().datetime({ offset: true }).optional().nullable(),
  creatorNotes: z.string().max(1000).optional().nullable(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const SnoozeTaskSchema = z.object({
  snoozedUntil: z.string().datetime({ offset: true }),
  notes: z.string().max(500).optional().nullable(),
});

export type SnoozeTaskInput = z.infer<typeof SnoozeTaskSchema>;

// ==========================================
// 2. NOTIFICATION SCHEMAS & PREFERENCES
// ==========================================

export enum NotificationCategoryEnum {
  INTERVIEW = 'INTERVIEW',
  APPROVAL = 'APPROVAL',
  PARSE_REVIEW = 'PARSE_REVIEW',
  STAGE_CHANGE = 'STAGE_CHANGE',
  TASK = 'TASK',
  DIGEST = 'DIGEST',
  IMPORT = 'IMPORT',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannelEnum {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
}

export const UpdateNotificationPreferenceSchema = z.object({
  channel: z.nativeEnum(NotificationChannelEnum),
  enabled: z.boolean(),
  categories: z.record(z.string(), z.boolean()).optional().nullable(),
});

export type UpdateNotificationPreferenceInput = z.infer<typeof UpdateNotificationPreferenceSchema>;

// ==========================================
// 3. AUTOMATION RULE SCHEMAS
// ==========================================

export enum AutomationTriggerEnum {
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  TASK_DUE = 'TASK_DUE',
  CANDIDATE_STAGE_CHANGE = 'CANDIDATE_STAGE_CHANGE',
  DAILY_DIGEST_SCHEDULE = 'DAILY_DIGEST_SCHEDULE',
  EMAIL_RESUME_INGESTION = 'EMAIL_RESUME_INGESTION',
}

export enum AutomationRuleStatusEnum {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export const RecipientTypeEnum = z.enum([
  'ASSIGNED_RECRUITER',
  'RECRUITER_MANAGER',
  'ADMIN',
  'INTERVIEW_PANEL',
  'CANDIDATE',
  'CLIENT_CONTACT',
]);

export type RecipientType = z.infer<typeof RecipientTypeEnum>;

export const CreateAutomationRuleSchema = z.object({
  name: z.string().min(3, 'Rule name must be at least 3 characters').max(150),
  description: z.string().max(500).optional().nullable(),
  triggerEvent: z.nativeEnum(AutomationTriggerEnum),
  timing: z
    .object({
      type: z.enum(['IMMEDIATE', 'BEFORE_EVENT', 'AFTER_EVENT', 'SCHEDULED_CRON']),
      durationMinutes: z.number().int().min(0).optional(),
      cron: z.string().optional(),
      timezone: z.string().default('Asia/Kolkata'),
    })
    .optional()
    .nullable(),
  conditions: z.record(z.string(), z.any()).default({}),
  clientScope: z.string().optional().nullable(),
  recipients: z
    .array(
      z.object({
        type: RecipientTypeEnum,
        id: z.string().optional().nullable(),
      })
    )
    .min(1, 'At least one recipient target is required'),
  channels: z.array(z.nativeEnum(NotificationChannelEnum)).min(1, 'At least one channel is required'),
  templateId: z.string().optional().nullable(),
  templateSubject: z.string().max(200).optional().nullable(),
  templateBody: z.string().min(5, 'Template body is required').max(5000),
  status: z.nativeEnum(AutomationRuleStatusEnum).default(AutomationRuleStatusEnum.DRAFT),
});

export type CreateAutomationRuleInput = z.infer<typeof CreateAutomationRuleSchema>;

export const UpdateAutomationRuleSchema = CreateAutomationRuleSchema.partial();
export type UpdateAutomationRuleInput = z.infer<typeof UpdateAutomationRuleSchema>;

export const AutomationPreviewSchema = z.object({
  templateBody: z.string(),
  templateSubject: z.string().optional().nullable(),
  context: z.record(z.string(), z.string()),
  isCandidateFacing: z.boolean().default(false),
});

export type AutomationPreviewInput = z.infer<typeof AutomationPreviewSchema>;

// ==========================================
// 4. CANDIDATE PRIVACY & MERGE FIELDS
// ==========================================

export const CANDIDATE_SAFE_MERGE_FIELDS = new Set<string>([
  'first_name',
  'candidate_name',
  'client',
  'job_title',
  'round',
  'date',
  'time',
  'meeting_link',
  'recruiter_name',
]);

const FORBIDDEN_CANDIDATE_PATTERNS = [
  /\bmargin\b/i,
  /\bfee\b/i,
  /\bcommercial\b/i,
  /\binternal note\b/i,
  /\bdebrief\b/i,
  /\brating\b/i,
  /\bbilling\b/i,
  /\bmarkup\b/i,
  /\bpassword\b/i,
  /\bsecret\b/i,
];

/**
 * Replaces `{field}` placeholders in a template with validated values.
 * Enforces candidate privacy: strips internal notes, fee fields, and sensitive words if isCandidateFacing = true.
 */
export function replaceMergeFields(
  template: string,
  context: Record<string, string>,
  isCandidateFacing = false
): { text: string; missingFields: string[]; sanitized: boolean } {
  let sanitized = false;
  let text = template;
  const missingFields: string[] = [];

  // Match all {merge_field} patterns
  text = text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, fieldName) => {
    // Check if supported
    if (!SUPPORTED_MERGE_FIELDS.includes(fieldName as SupportedMergeField)) {
      missingFields.push(fieldName);
      return match;
    }

    // Candidate safety restriction
    if (isCandidateFacing && !CANDIDATE_SAFE_MERGE_FIELDS.has(fieldName)) {
      sanitized = true;
      return '';
    }

    const value = context[fieldName];
    if (value === undefined || value === null) {
      missingFields.push(fieldName);
      return match;
    }

    return value;
  });

  // Additional defense against sensitive internal content leaked in plain text for candidate-facing messages
  if (isCandidateFacing) {
    for (const pattern of FORBIDDEN_CANDIDATE_PATTERNS) {
      if (pattern.test(text)) {
        text = text.replace(pattern, '[REDACTED]');
        sanitized = true;
      }
    }
  }

  return { text, missingFields, sanitized };
}

// ==========================================
// 5. DETERMINISTIC IDEMPOTENCY KEY GENERATION
// ==========================================

export function generateAutomationIdempotencyKey(
  ruleId: string,
  ruleVersion: number,
  eventId: string,
  recipientId: string
): string {
  return `auto:${ruleId}:v${ruleVersion}:${eventId}:${recipientId}`;
}

export function generateTaskReminderIdempotencyKey(
  taskId: string,
  reminderType: string,
  scheduledTimeIso: string
): string {
  return `task:${taskId}:${reminderType}:${scheduledTimeIso.substring(0, 16)}`;
}

export function generateDigestIdempotencyKey(dateStr: string, userId: string): string {
  return `digest:${dateStr}:${userId}`;
}

// ==========================================
// 6. DEFAULT AUTOMATION RULES PRESETS
// ==========================================

export const STANDARD_AUTOMATION_RULE_PRESETS = [
  {
    name: 'Interview Reminder (24 Hours Prior)',
    description: 'Sends email & in-app reminder to interview participants 24h before scheduled interview.',
    triggerEvent: AutomationTriggerEnum.INTERVIEW_SCHEDULED,
    timing: { type: 'BEFORE_EVENT', durationMinutes: 1440, timezone: 'Asia/Kolkata' },
    conditions: { outcome: 'SCHEDULED' },
    recipients: [{ type: 'ASSIGNED_RECRUITER' }, { type: 'INTERVIEW_PANEL' }],
    channels: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
    templateSubject: 'Reminder: Interview with {candidate_name} in 24 hours',
    templateBody: 'Hello {first_name},\n\nThis is a reminder that you have an interview scheduled for {job_title} ({round}) on {date} at {time}.\n\nMeeting link: {meeting_link}\n\nBest regards,\nHireFlow Team',
    status: AutomationRuleStatusEnum.ACTIVE,
  },
  {
    name: 'Interview Reminder (30 Minutes Prior)',
    description: 'Urgent notification 30 minutes before interview begins.',
    triggerEvent: AutomationTriggerEnum.INTERVIEW_SCHEDULED,
    timing: { type: 'BEFORE_EVENT', durationMinutes: 30, timezone: 'Asia/Kolkata' },
    conditions: { outcome: 'SCHEDULED' },
    recipients: [{ type: 'ASSIGNED_RECRUITER' }, { type: 'INTERVIEW_PANEL' }],
    channels: [NotificationChannelEnum.IN_APP],
    templateSubject: 'Starting Soon: Interview with {candidate_name} in 30 minutes',
    templateBody: 'Upcoming interview with {candidate_name} starts at {time}. Link: {meeting_link}',
    status: AutomationRuleStatusEnum.ACTIVE,
  },
  {
    name: 'Task Follow-up Reminder (15 Minutes Prior)',
    description: 'Notifies assigned recruiter 15 minutes before task deadline.',
    triggerEvent: AutomationTriggerEnum.TASK_DUE,
    timing: { type: 'BEFORE_EVENT', durationMinutes: 15, timezone: 'Asia/Kolkata' },
    conditions: { status: 'PENDING' },
    recipients: [{ type: 'ASSIGNED_RECRUITER' }],
    channels: [NotificationChannelEnum.IN_APP],
    templateSubject: 'Task Due Soon: {task_title}',
    templateBody: 'Task "{task_title}" is due at {time}. Please ensure action is completed.',
    status: AutomationRuleStatusEnum.ACTIVE,
  },
  {
    name: 'Daily Pending-Action Report (08:30 IST)',
    description: 'Automated weekday morning briefing summarizing interviews, tasks due, and pending reviews.',
    triggerEvent: AutomationTriggerEnum.DAILY_DIGEST_SCHEDULE,
    timing: { type: 'SCHEDULED_CRON', cron: '30 8 * * 1-5', timezone: 'Asia/Kolkata' },
    conditions: {},
    recipients: [{ type: 'ASSIGNED_RECRUITER' }, { type: 'RECRUITER_MANAGER' }],
    channels: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
    templateSubject: 'HireFlow Morning Briefing — {date}',
    templateBody: 'Good morning {first_name},\n\nHere is your daily activity briefing for {date}.\nPlease check your tasks and today\'s scheduled interviews in HireFlow.',
    status: AutomationRuleStatusEnum.ACTIVE,
  },
  {
    name: 'Inbound Email Resume Review',
    description: 'Processes incoming CVs into the Pending Review queue without automatic record creation.',
    triggerEvent: AutomationTriggerEnum.EMAIL_RESUME_INGESTION,
    timing: { type: 'IMMEDIATE', timezone: 'Asia/Kolkata' },
    conditions: {},
    recipients: [{ type: 'ASSIGNED_RECRUITER' }, { type: 'ADMIN' }],
    channels: [NotificationChannelEnum.IN_APP],
    templateSubject: 'New Resume Ingested for Review: {candidate_name}',
    templateBody: 'A new resume was received via email for {candidate_name}. Please review in the Sourcing Workspace.',
    status: AutomationRuleStatusEnum.ACTIVE,
  },
];
