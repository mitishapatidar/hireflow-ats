/**
 * HireFlow ATS — Task Reminder Queue Manager
 *
 * Handles delayed task reminders (15 min prior, at due time, overdue).
 * Verifies live database task status at execution time to guarantee:
 * - Completed tasks never receive reminders.
 * - Snoozed tasks cancel or replace previous scheduled reminders.
 * - Deterministic idempotency prevents duplicate notifications.
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@hireflow/db';
import {
  NotificationCategoryEnum,
  NotificationChannelEnum,
  generateTaskReminderIdempotencyKey,
} from '@hireflow/shared';
import { notificationQueue } from './notification-queue.js';

export interface TaskReminderJobData {
  taskId: string;
  reminderType: '15_MIN_BEFORE' | 'AT_DUE' | 'OVERDUE';
  scheduledTimeIso: string;
}

export const TASK_REMINDER_QUEUE_NAME = 'task-reminders';

export class TaskReminderQueueManager {
  private queue: Queue<TaskReminderJobData> | null = null;
  private worker: Worker<TaskReminderJobData> | null = null;
  private redisUrl: string;
  public isConnected = false;
  // In-memory fallback timers for offline Redis environments
  private inMemoryTimers = new Map<string, NodeJS.Timeout>();

  constructor(redisUrl?: string) {
    this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.initQueue();
  }

  private initQueue() {
    try {
      const parsedUrl = new URL(this.redisUrl);
      const connection = {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || '6379', 10),
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 500,
        retryStrategy: () => null,
      };

      this.queue = new Queue(TASK_REMINDER_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: { age: 86400 },
        },
      });

      this.worker = new Worker(
        TASK_REMINDER_QUEUE_NAME,
        async (job: Job<TaskReminderJobData>) => {
          await this.processReminder(job.data);
        },
        { connection }
      );

      this.queue.on('error', () => {
        this.isConnected = false;
      });
      this.worker.on('error', () => {
        this.isConnected = false;
      });
      this.isConnected = true;
    } catch {
      this.isConnected = false;
    }
  }

  /**
   * Schedule a reminder at a specific timestamp.
   */
  public async scheduleReminder(
    taskId: string,
    reminderType: '15_MIN_BEFORE' | 'AT_DUE' | 'OVERDUE',
    triggerAt: Date
  ): Promise<{ scheduled: boolean; delayMs: number }> {
    const delayMs = Math.max(0, triggerAt.getTime() - Date.now());
    const scheduledTimeIso = triggerAt.toISOString();
    const idempotencyKey = generateTaskReminderIdempotencyKey(taskId, reminderType, scheduledTimeIso);

    // Cancel any existing in-memory timer for this task & reminder type
    this.cancelReminder(taskId);

    if (this.isConnected && this.queue) {
      try {
        await this.queue.add(
          'send-task-reminder',
          { taskId, reminderType, scheduledTimeIso },
          { delay: delayMs, jobId: idempotencyKey }
        );
        return { scheduled: true, delayMs };
      } catch {
        // Fall through to in-memory timer
      }
    }

    // In-memory fallback
    if (delayMs > 0 && delayMs < 2147483647) {
      const timer = setTimeout(async () => {
        await this.processReminder({ taskId, reminderType, scheduledTimeIso });
        this.inMemoryTimers.delete(taskId);
      }, delayMs);
      this.inMemoryTimers.set(taskId, timer);
      return { scheduled: true, delayMs };
    } else if (delayMs === 0) {
      await this.processReminder({ taskId, reminderType, scheduledTimeIso });
      return { scheduled: true, delayMs: 0 };
    }

    return { scheduled: false, delayMs };
  }

  /**
   * Cancels scheduled reminders for a task when completed or snoozed.
   */
  public cancelReminder(taskId: string): void {
    const timer = this.inMemoryTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.inMemoryTimers.delete(taskId);
    }
  }

  /**
   * Live execution check against the database before dispatching.
   */
  public async processReminder(data: TaskReminderJobData): Promise<{ dispatched: boolean; reason?: string }> {
    const task = await prisma.task.findUnique({
      where: { id: data.taskId },
      include: { assignedTo: true },
    });

    if (!task) {
      return { dispatched: false, reason: 'Task not found' };
    }

    if (task.isArchived) {
      return { dispatched: false, reason: 'Task is archived' };
    }

    // Commandment: Completed or Cancelled tasks must never receive reminders
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      return { dispatched: false, reason: `Task status is ${task.status}` };
    }

    // If task was snoozed into the future, suppress this reminder
    if (task.snoozedUntil && new Date(task.snoozedUntil).getTime() > Date.now()) {
      return { dispatched: false, reason: 'Task was snoozed to a future time' };
    }

    // Dispatch notification
    let title = `Follow-up Due: ${task.title}`;
    let message = `Task "${task.title}" is due soon. Priority: ${task.priority}`;
    if (data.reminderType === 'OVERDUE') {
      title = `Overdue Follow-up: ${task.title}`;
      message = `Task "${task.title}" is past due. Please complete or snooze this action.`;
    }

    await notificationQueue.dispatch({
      userId: task.assignedToId,
      title,
      message,
      category: NotificationCategoryEnum.TASK,
      type: 'TASK_REMINDER',
      linkUrl: `/notifications?tab=tasks`,
      priority: task.priority === 'URGENT' || data.reminderType === 'OVERDUE' ? 'HIGH' : 'NORMAL',
      metadata: {
        taskId: task.id,
        relatedEntity: task.relatedEntity,
        relatedEntityId: task.relatedEntityId,
        reminderType: data.reminderType,
      },
      channels: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
      recipientEmail: task.assignedTo.email,
    });

    return { dispatched: true };
  }

  public async close(): Promise<void> {
    for (const timer of this.inMemoryTimers.values()) {
      clearTimeout(timer);
    }
    this.inMemoryTimers.clear();
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export const taskReminderQueue = new TaskReminderQueueManager();
