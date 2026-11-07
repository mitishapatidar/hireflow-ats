/**
 * HireFlow ATS — Daily Pending-Actions Digest Queue Manager
 *
 * Implements Monday–Friday 08:30 IST digest generation.
 * Generates role-scoped briefings for Recruiters, Managers, and Admins.
 * Enforces strict idempotent delivery (one digest per user per scheduled date).
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@hireflow/db';
import {
  NotificationCategoryEnum,
  NotificationChannelEnum,
  generateDigestIdempotencyKey,
} from '@hireflow/shared';
import { notificationQueue } from './notification-queue.js';

export interface DailyDigestJobData {
  userId: string;
  digestDate: string; // YYYY-MM-DD
  organizationId: string;
}

export interface DigestContentReport {
  date: string;
  userRole: string;
  todaysInterviewsCount: number;
  tasksDueTodayCount: number;
  overdueTasksCount: number;
  pendingApprovalsCount: number;
  pendingReviewsCount: number;
  items: Array<{
    type: 'INTERVIEW' | 'TASK' | 'APPROVAL' | 'REVIEW';
    title: string;
    details: string;
    linkUrl: string;
    priority?: string;
  }>;
}

export const DIGEST_QUEUE_NAME = 'daily-action-digest';

export class DigestQueueManager {
  private queue: Queue<DailyDigestJobData> | null = null;
  private worker: Worker<DailyDigestJobData> | null = null;
  private redisUrl: string;
  public isConnected = false;

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

      this.queue = new Queue(DIGEST_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: { age: 86400 },
        },
      });

      this.worker = new Worker(
        DIGEST_QUEUE_NAME,
        async (job: Job<DailyDigestJobData>) => {
          await this.generateAndSendDigest(job.data.userId, job.data.digestDate);
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
   * Generates digest report for a user, enforcing idempotency.
   */
  public async generateAndSendDigest(
    userId: string,
    digestDate: string
  ): Promise<{ success: boolean; skipped?: boolean; digestId?: string }> {
    // 1. Idempotency Check: check if DailyDigest already exists for this user and date
    const existing = await prisma.dailyDigest.findUnique({
      where: {
        userId_digestDate_channel: {
          userId,
          digestDate,
          channel: 'IN_APP',
        },
      },
    });

    if (existing) {
      return { success: true, skipped: true, digestId: existing.id };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isArchived) {
      return { success: false, skipped: true };
    }

    // 2. Compile role-scoped pending actions
    const todayStart = new Date(`${digestDate}T00:00:00.000Z`);
    const todayEnd = new Date(`${digestDate}T23:59:59.999Z`);

    const items: DigestContentReport['items'] = [];

    // A. Tasks Due Today & Overdue
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        isArchived: false,
      },
    });

    let dueToday = 0;
    let overdue = 0;
    const now = Date.now();

    for (const t of tasks) {
      if (t.dueDate) {
        const dueTime = new Date(t.dueDate).getTime();
        if (dueTime < now) {
          overdue++;
          items.push({
            type: 'TASK',
            title: `Overdue: ${t.title}`,
            details: `Was due on ${new Date(t.dueDate).toLocaleDateString('en-IN')}`,
            linkUrl: '/notifications?tab=tasks',
            priority: 'URGENT',
          });
        } else if (dueTime >= todayStart.getTime() && dueTime <= todayEnd.getTime()) {
          dueToday++;
          items.push({
            type: 'TASK',
            title: `Due Today: ${t.title}`,
            details: `Priority: ${t.priority}`,
            linkUrl: '/notifications?tab=tasks',
            priority: t.priority,
          });
        }
      }
    }

    // B. Today's Interviews
    const interviews = await prisma.interview.findMany({
      where: {
        scheduledAt: { gte: todayStart, lte: todayEnd },
        outcome: 'SCHEDULED',
        isArchived: false,
        OR: [
          { application: { candidate: { ownerId: userId } } },
          { panelMembers: { some: { userId } } },
        ],
      },
      include: {
        application: { include: { candidate: true, job: true } },
      },
    });

    for (const i of interviews) {
      items.push({
        type: 'INTERVIEW',
        title: `Interview: ${i.application.candidate.name}`,
        details: `${i.application.job.title} at ${new Date(i.scheduledAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}`,
        linkUrl: `/interviews`,
      });
    }

    // C. Pending Approvals (for Managers and Admins)
    let pendingApprovalsCount = 0;
    if (user.role === 'MANAGER' || user.role === 'ADMIN') {
      const pendingSubmissions = await prisma.submission.count({
        where: {
          approvalStatus: 'PENDING_MANAGER_APPROVAL',
        },
      });
      pendingApprovalsCount = pendingSubmissions;
      if (pendingSubmissions > 0) {
        items.push({
          type: 'APPROVAL',
          title: `${pendingSubmissions} Pending Client Submissions`,
          details: 'Action required in Approvals Center',
          linkUrl: '/approvals',
          priority: 'HIGH',
        });
      }
    }

    // 3. Construct Digest Report
    const report: DigestContentReport = {
      date: digestDate,
      userRole: user.role,
      todaysInterviewsCount: interviews.length,
      tasksDueTodayCount: dueToday,
      overdueTasksCount: overdue,
      pendingApprovalsCount,
      pendingReviewsCount: 0,
      items,
    };

    // 4. Save to DailyDigest table
    const digest = await prisma.dailyDigest.create({
      data: {
        userId,
        digestDate,
        channel: 'IN_APP',
        itemsCount: items.length,
        content: report as any,
        status: 'SENT',
      },
    });

    // 5. Send Notification
    await notificationQueue.dispatch({
      userId,
      title: `Daily Morning Briefing (${digestDate})`,
      message: `You have ${interviews.length} interviews, ${dueToday} tasks due today, and ${overdue} overdue actions.`,
      category: NotificationCategoryEnum.DIGEST,
      type: 'DAILY_DIGEST',
      linkUrl: '/notifications?tab=digest',
      priority: overdue > 0 ? 'HIGH' : 'NORMAL',
      metadata: {
        digestId: digest.id,
        digestDate,
        itemsCount: items.length,
      },
      channels: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
      recipientEmail: user.email,
    });

    return { success: true, digestId: digest.id };
  }

  public async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export const digestQueue = new DigestQueueManager();
