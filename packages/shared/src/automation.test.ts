import { describe, it, expect } from 'vitest';
import {
  replaceMergeFields,
  generateAutomationIdempotencyKey,
  generateTaskReminderIdempotencyKey,
  generateDigestIdempotencyKey,
  CreateTaskSchema,
  SnoozeTaskSchema,
  CreateAutomationRuleSchema,
  AutomationTriggerEnum,
  NotificationChannelEnum,
  RecipientTypeEnum,
  TaskPriorityEnum,
} from './automation';

describe('Prompt 24: Automation, Notifications & Tasks Shared Utilities', () => {
  describe('replaceMergeFields and Candidate Privacy', () => {
    it('correctly replaces all supported merge fields for internal messages', () => {
      const template = 'Task {task_title} is due on {due_date} for candidate {candidate_name} regarding job {job_title}.';
      const context = {
        task_title: 'Prepare Offer Letter',
        due_date: '10 Nov 2026',
        candidate_name: 'Priya Sharma',
        job_title: 'Full Stack Engineer',
      };

      const result = replaceMergeFields(template, context, false);
      expect(result.text).toBe('Task Prepare Offer Letter is due on 10 Nov 2026 for candidate Priya Sharma regarding job Full Stack Engineer.');
      expect(result.missingFields).toHaveLength(0);
      expect(result.sanitized).toBe(false);
    });

    it('reports missing or unsupported merge fields', () => {
      const template = 'Hello {first_name}, your score is {custom_unsupported_field}.';
      const context = {
        first_name: 'Aarav',
      };

      const result = replaceMergeFields(template, context, false);
      expect(result.missingFields).toContain('custom_unsupported_field');
      expect(result.text).toContain('Hello Aarav');
    });

    it('strictly sanitizes candidate-facing messages by stripping non-whitelisted fields and sensitive keywords', () => {
      const template = 'Dear {candidate_name}, our agency margin is 15% and the commercial fee is high. Interview round is {round}. Task: {task_title}';
      const context = {
        candidate_name: 'Rohan Mehta',
        round: 'Technical Interview',
        task_title: 'Internal Recruiter Task',
      };

      const result = replaceMergeFields(template, context, true);
      expect(result.sanitized).toBe(true);
      expect(result.text).not.toContain('margin');
      expect(result.text).not.toContain('fee');
      expect(result.text).toContain('[REDACTED]');
      // Non-whitelisted field in candidate mode ({task_title}) should be stripped
      expect(result.text).not.toContain('Internal Recruiter Task');
      expect(result.text).toContain('Dear Rohan Mehta');
      expect(result.text).toContain('Technical Interview');
    });
  });

  describe('Deterministic Idempotency Key Generation', () => {
    it('generates consistent automation execution idempotency keys', () => {
      const key1 = generateAutomationIdempotencyKey('rule-1', 2, 'evt-99', 'user-45');
      const key2 = generateAutomationIdempotencyKey('rule-1', 2, 'evt-99', 'user-45');
      expect(key1).toBe('auto:rule-1:v2:evt-99:user-45');
      expect(key1).toBe(key2);
    });

    it('generates consistent task reminder idempotency keys', () => {
      const isoTime = '2026-11-08T09:30:00.000Z';
      const key = generateTaskReminderIdempotencyKey('task-100', '15_MIN_BEFORE', isoTime);
      expect(key).toBe('task:task-100:15_MIN_BEFORE:2026-11-08T09:30');
    });

    it('generates consistent daily digest idempotency keys', () => {
      const key = generateDigestIdempotencyKey('2026-11-07', 'user-123');
      expect(key).toBe('digest:2026-11-07:user-123');
    });
  });

  describe('Zod Schema Validations', () => {
    it('validates a valid task creation input', () => {
      const valid = {
        title: 'Follow up with hiring manager',
        description: 'Discuss technical evaluation scores',
        assignedToId: '11111111-1111-1111-1111-111111111111',
        dueDate: '2026-11-10T14:00:00.000Z',
        priority: TaskPriorityEnum.HIGH,
        relatedEntity: 'INTERVIEW',
        relatedEntityId: '22222222-2222-2222-2222-222222222222',
      };

      const parsed = CreateTaskSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid assignee ID or too short title', () => {
      const invalid = {
        title: 'A', // too short
        assignedToId: 'not-a-uuid',
      };

      const parsed = CreateTaskSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('validates a snooze task request with ISO datetime', () => {
      const valid = {
        snoozedUntil: '2026-11-11T09:00:00.000Z',
        notes: 'Candidate is travelling till Wednesday',
      };

      const parsed = SnoozeTaskSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('validates complete automation rule schema', () => {
      const valid = {
        name: 'Interview 24h Reminder',
        description: 'Sends email reminder',
        triggerEvent: AutomationTriggerEnum.INTERVIEW_SCHEDULED,
        timing: {
          type: 'BEFORE_EVENT',
          durationMinutes: 1440,
          timezone: 'Asia/Kolkata',
        },
        conditions: { outcome: 'SCHEDULED' },
        recipients: [{ type: RecipientTypeEnum.Values.ASSIGNED_RECRUITER }],
        channels: [NotificationChannelEnum.EMAIL, NotificationChannelEnum.IN_APP],
        templateSubject: 'Upcoming Interview: {candidate_name}',
        templateBody: 'Hello {first_name}, interview is on {date} at {time}.',
      };

      const parsed = CreateAutomationRuleSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });
  });
});
