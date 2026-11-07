/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  generateSecureToken,
  hashToken,
  SESSION_COOKIE_NAME,
  NotificationCategoryEnum,
  NotificationChannelEnum,
  AutomationTriggerEnum,
  TaskPriorityEnum,
} from '@hireflow/shared';
import { taskReminderQueue } from '../queue/task-reminder-queue.js';
import { automationQueue } from '../queue/automation-queue.js';
import { digestQueue } from '../queue/digest-queue.js';

describe('Prompt 24: Notifications, Follow-up Tasks & Automation Rules API Tests', { timeout: 40000 }, () => {
  let app: any;
  let adminCookie: string;
  let recruiterCookie: string;
  let recruiter2Cookie: string;

  let adminUser: any;
  let recruiterUser: any;
  let recruiterUser2: any;

  const cleanupSessionTokens: string[] = [];
  const cleanupNotificationIds: string[] = [];
  const cleanupTaskIds: string[] = [];
  const cleanupRuleIds: string[] = [];
  const cleanupDigestIds: string[] = [];

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN, isArchived: false },
    });

    recruiterUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.RECRUITER, isArchived: false },
    });

    const otherRecruiter = await prisma.user.findFirst({
      where: { role: UserRole.RECRUITER, id: { not: recruiterUser.id }, isArchived: false },
    });

    recruiterUser2 = otherRecruiter || adminUser;

    // Helper: Create valid session
    const createSession = async (user: any) => {
      const rawToken = generateSecureToken();
      cleanupSessionTokens.push(rawToken);
      const hashed = hashToken(rawToken);

      await prisma.session.create({
        data: {
          tokenHash: hashed,
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return `${SESSION_COOKIE_NAME}=${rawToken}`;
    };

    adminCookie = await createSession(adminUser);
    recruiterCookie = await createSession(recruiterUser);
    recruiter2Cookie = await createSession(recruiterUser2);
  });

  afterAll(async () => {
    // Cleanup sessions
    for (const t of cleanupSessionTokens) {
      const hashed = hashToken(t);
      await prisma.session.deleteMany({ where: { tokenHash: hashed } });
    }

    // Cleanup notifications
    if (cleanupNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: cleanupNotificationIds } },
      });
    }

    // Cleanup tasks
    if (cleanupTaskIds.length > 0) {
      await prisma.task.deleteMany({
        where: { id: { in: cleanupTaskIds } },
      });
    }

    // Cleanup rules & executions
    if (cleanupRuleIds.length > 0) {
      await prisma.automationExecution.deleteMany({
        where: { ruleId: { in: cleanupRuleIds } },
      });
      await prisma.automationRule.deleteMany({
        where: { id: { in: cleanupRuleIds } },
      });
    }

    // Cleanup digests
    if (cleanupDigestIds.length > 0) {
      await prisma.dailyDigest.deleteMany({
        where: { id: { in: cleanupDigestIds } },
      });
    }

    await app.close();
  });

  // ==========================================
  // SECTION 1: NOTIFICATION CENTRE TESTS
  // ==========================================
  describe('Notification Centre Endpoints', () => {
    let testNotificationId: string;

    it('creates and fetches user notifications with groupings and unread count', async () => {
      // Create seed notification
      const n = await prisma.notification.create({
        data: {
          userId: recruiterUser.id,
          title: 'Interview Confirmed: Technical Round',
          message: 'David Sterling accepted the interview on Nov 10, 2:30 PM',
          category: NotificationCategoryEnum.INTERVIEW,
          type: 'INTERVIEW_CONFIRMED',
          linkUrl: '/interviews',
          priority: 'NORMAL',
        },
      });
      cleanupNotificationIds.push(n.id);
      testNotificationId = n.id;

      const res = await app.inject({
        method: 'GET',
        url: '/api/notifications?tab=all',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeGreaterThan(0);
      expect(body.data.unreadCount).toBeGreaterThanOrEqual(1);
      expect(body.data.grouped).toBeDefined();
      expect(body.data.grouped.today).toBeDefined();
    });

    it('marks a single notification as read', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/notifications/${testNotificationId}/read`,
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.readAt).not.toBeNull();
    });

    it('enforces cross-user isolation: User B cannot mark User A notification read', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/notifications/${testNotificationId}/read`,
        headers: { cookie: recruiter2Cookie },
      });

      // Recruiter 2 should get 404 because notification belongs to Recruiter 1
      if (recruiterUser2.id !== recruiterUser.id) {
        expect(res.statusCode).toBe(404);
      }
    });

    it('marks all unread notifications as read', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notifications/read-all',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });

    it('fetches and updates per-user channel preferences', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/notifications/preferences',
        headers: { cookie: recruiterCookie },
      });

      expect(getRes.statusCode).toBe(200);
      const getBody = JSON.parse(getRes.payload);
      expect(getBody.success).toBe(true);
      expect(getBody.data.length).toBe(3); // IN_APP, EMAIL, WHATSAPP

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/notifications/preferences',
        headers: { cookie: recruiterCookie },
        payload: {
          channel: NotificationChannelEnum.EMAIL,
          enabled: true,
          categories: { INTERVIEW: true, TASK: true, DIGEST: false },
        },
      });

      expect(putRes.statusCode).toBe(200);
      const putBody = JSON.parse(putRes.payload);
      expect(putBody.success).toBe(true);
      expect(putBody.data.enabled).toBe(true);
      expect(putBody.data.categories.DIGEST).toBe(false);
    });
  });

  // ==========================================
  // SECTION 2: FOLLOW-UP TASKS TESTS
  // ==========================================
  describe('Follow-up Tasks Endpoints', () => {
    let createdTaskId: string;

    it('allows a recruiter to create a task for themselves', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { cookie: recruiterCookie },
        payload: {
          title: 'Review submitted resume portfolio',
          description: 'Compare skills against senior frontend mandate',
          assignedToId: recruiterUser.id,
          dueDate: tomorrow,
          priority: TaskPriorityEnum.HIGH,
          relatedEntity: 'CANDIDATE',
          creatorNotes: 'High priority candidate',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      createdTaskId = body.data.id;
      cleanupTaskIds.push(createdTaskId);
    });

    it('rejects a recruiter trying to assign a task to another recruiter (HTTP 403)', async () => {
      if (recruiterUser2.id !== recruiterUser.id) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/tasks',
          headers: { cookie: recruiterCookie },
          payload: {
            title: 'Unauthorized delegation task',
            assignedToId: recruiterUser2.id,
            priority: TaskPriorityEnum.LOW,
          },
        });

        expect(res.statusCode).toBe(403);
      }
    });

    it('fetches tasks with due counts and filter support', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tasks?filter=all',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeGreaterThan(0);
      expect(body.data.counts).toBeDefined();
    });

    it('snoozes a task to a future datetime', async () => {
      const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${createdTaskId}/snooze`,
        headers: { cookie: recruiterCookie },
        payload: {
          snoozedUntil: nextWeek,
          notes: 'Candidate is travelling until next week',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.snoozedUntil).toBeDefined();
    });

    it('marks a task completed and cancels reminders', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${createdTaskId}/complete`,
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('COMPLETED');
      expect(body.data.completedAt).not.toBeNull();
    });

    it('guarantees completed tasks never receive reminders (processReminder returns false)', async () => {
      const result = await taskReminderQueue.processReminder({
        taskId: createdTaskId,
        reminderType: '15_MIN_BEFORE',
        scheduledTimeIso: new Date().toISOString(),
      });

      expect(result.dispatched).toBe(false);
      expect(result.reason).toContain('COMPLETED');
    });
  });

  // ==========================================
  // SECTION 3: AUTOMATION RULES & PREVIEW TESTS
  // ==========================================
  describe('Automation Rules Endpoints', () => {
    let createdRuleId: string;

    it('allows Admin to view rules and auto-seeds standard presets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/automation/rules',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('strictly forbids non-admin recruiters from accessing automation rules (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/automation/rules',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(403);
    });

    it('allows Admin to create a custom automation rule', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/automation/rules',
        headers: { cookie: adminCookie },
        payload: {
          name: 'Custom Job Offer Alert',
          description: 'Notifies manager when an offer is prepared',
          triggerEvent: AutomationTriggerEnum.TASK_DUE,
          timing: { type: 'IMMEDIATE', timezone: 'Asia/Kolkata' },
          conditions: { priority: 'HIGH' },
          recipients: [{ type: 'RECRUITER_MANAGER' }],
          channels: [NotificationChannelEnum.IN_APP],
          templateSubject: 'High Priority Task: {task_title}',
          templateBody: 'Please review task {task_title} due on {due_date}.',
          status: 'DRAFT',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.version).toBe(1);
      createdRuleId = body.data.id;
      cleanupRuleIds.push(createdRuleId);
    });

    it('increments version number when an automation rule is modified', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/automation/rules/${createdRuleId}`,
        headers: { cookie: adminCookie },
        payload: {
          description: 'Updated description for offer alert',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.version).toBe(2);
    });

    it('activates and pauses an automation rule', async () => {
      const actRes = await app.inject({
        method: 'POST',
        url: `/api/automation/rules/${createdRuleId}/activate`,
        headers: { cookie: adminCookie },
      });
      expect(actRes.statusCode).toBe(200);
      expect(JSON.parse(actRes.payload).data.status).toBe('ACTIVE');

      const pauseRes = await app.inject({
        method: 'POST',
        url: `/api/automation/rules/${createdRuleId}/pause`,
        headers: { cookie: adminCookie },
      });
      expect(pauseRes.statusCode).toBe(200);
      expect(JSON.parse(pauseRes.payload).data.status).toBe('PAUSED');
    });

    it('previews message templates with merge fields and verifies candidate privacy sanitization', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/automation/preview',
        headers: { cookie: adminCookie },
        payload: {
          templateSubject: 'Interview with {candidate_name} for {job_title}',
          templateBody: 'Hello {first_name}, our agency margin is 12% for {client}. Task: {task_title}',
          context: {
            candidate_name: 'Ananya Roy',
            job_title: 'Product Manager',
            first_name: 'Ananya',
            client: 'Acme Corp',
            task_title: 'Internal Review',
          },
          isCandidateFacing: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.sanitized).toBe(true);
      expect(body.data.renderedBody).not.toContain('margin');
      expect(body.data.renderedBody).toContain('[REDACTED]');
      // task_title is not candidate-safe so it should be stripped
      expect(body.data.renderedBody).not.toContain('Internal Review');
      expect(body.data.renderedSubject).toBe('Interview with Ananya Roy for Product Manager');
    });

    it('fetches execution logs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/automation/executions',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.items).toBeDefined();
    });

    it('fetches or generates today daily digest', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/automation/digests/today',
        headers: { cookie: recruiterCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.digestDate).toBeDefined();
      cleanupDigestIds.push(body.data.id);
    });
  });

  // ==========================================
  // SECTION 4: ENGINE & CLIENT ISOLATION TESTS
  // ==========================================
  describe('Client Scoping & Idempotency Rules', () => {
    it('enforces client isolation: Client A rule never executes for Client B event', async () => {
      // 1. Create rule specifically scoped to client-AAA
      const clientScopedRule = await prisma.automationRule.create({
        data: {
          name: 'Client AAA Exclusive Follow-up',
          triggerEvent: AutomationTriggerEnum.INTERVIEW_SCHEDULED,
          clientScope: '00000000-0000-0000-0000-000000000aaa',
          status: 'ACTIVE',
          isActive: true,
          recipients: [{ type: 'ASSIGNED_RECRUITER' }],
          channels: [NotificationChannelEnum.IN_APP],
          templateSubject: 'Client AAA Alert',
          templateBody: 'Exclusive update for Client AAA',
          conditions: {},
          actions: {},
        },
      });
      cleanupRuleIds.push(clientScopedRule.id);

      // 2. Trigger event for Client BBB
      const result = await automationQueue.processEvent({
        organizationId: 'org-1',
        triggerEvent: AutomationTriggerEnum.INTERVIEW_SCHEDULED,
        eventId: 'interview-bbb-999',
        clientId: '00000000-0000-0000-0000-000000000bbb', // Different client!
        context: { candidate_name: 'Test' },
        assignedRecruiterId: recruiterUser.id,
      });

      // The rule for AAA should NOT execute
      const executions = await prisma.automationExecution.findMany({
        where: { ruleId: clientScopedRule.id },
      });
      expect(executions).toHaveLength(0);
    });
  });
});
