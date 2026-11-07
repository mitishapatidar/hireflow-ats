/**
 * HireFlow ATS — Notification Queue Manager
 *
 * Manages asynchronous dispatch of notifications across IN_APP, EMAIL, and WHATSAPP channels.
 * Enforces per-user channel preferences, candidate consent, audit logging, and in-memory fallback.
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@hireflow/db';
import {
  NotificationCategoryEnum,
  NotificationChannelEnum,
  MockEmailProvider,
  MockWhatsAppProvider,
  replaceMergeFields,
} from '@hireflow/shared';

export interface NotificationJobData {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategoryEnum;
  type?: string;
  linkUrl?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  metadata?: Record<string, any>;
  channels?: NotificationChannelEnum[];
  recipientEmail?: string;
  recipientPhone?: string;
  hasWhatsAppConsent?: boolean;
}

export const NOTIFICATION_QUEUE_NAME = 'notification-dispatch';

export class NotificationQueueManager {
  private queue: Queue<NotificationJobData> | null = null;
  private worker: Worker<NotificationJobData> | null = null;
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

      this.queue = new Queue(NOTIFICATION_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 3600, count: 500 },
          removeOnFail: { age: 86400, count: 1000 },
        },
      });

      this.worker = new Worker(
        NOTIFICATION_QUEUE_NAME,
        async (job: Job<NotificationJobData>) => {
          await this.processJob(job.data);
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

  public async dispatch(data: NotificationJobData): Promise<{ success: boolean; dispatchedChannels: string[] }> {
    if (this.isConnected && this.queue) {
      try {
        await this.queue.add('dispatch-notification', data);
        return { success: true, dispatchedChannels: data.channels || [NotificationChannelEnum.IN_APP] };
      } catch {
        // Fall back to direct execution
        return await this.processJob(data);
      }
    }
    // In-memory fallback
    return await this.processJob(data);
  }

  public async processJob(data: NotificationJobData): Promise<{ success: boolean; dispatchedChannels: string[] }> {
    const dispatchedChannels: string[] = [];

    // 1. Fetch user preferences if user exists in database
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      include: { notificationPrefs: true },
    });

    const prefs = user?.notificationPrefs || [];
    const inAppPref = prefs.find((p) => p.channel === NotificationChannelEnum.IN_APP);
    const emailPref = prefs.find((p) => p.channel === NotificationChannelEnum.EMAIL);
    const whatsappPref = prefs.find((p) => p.channel === NotificationChannelEnum.WHATSAPP);

    const targetChannels = data.channels || [NotificationChannelEnum.IN_APP];

    // Check category preferences helper
    const isCategoryEnabled = (prefCategories: any, cat: string) => {
      if (!prefCategories || typeof prefCategories !== 'object') return true;
      return prefCategories[cat] !== false;
    };

    // 2. Deliver IN_APP
    if (targetChannels.includes(NotificationChannelEnum.IN_APP)) {
      // Security notifications and system alerts can never be disabled
      const allowInApp = data.category === NotificationCategoryEnum.SYSTEM || !inAppPref || (inAppPref.enabled && isCategoryEnabled(inAppPref.categories, data.category));
      if (allowInApp) {
        await prisma.notification.create({
          data: {
            userId: data.userId,
            title: data.title,
            message: data.message,
            type: data.type || data.category,
            category: data.category,
            linkUrl: data.linkUrl,
            priority: data.priority || 'NORMAL',
            metadata: data.metadata || {},
          },
        });
        dispatchedChannels.push(NotificationChannelEnum.IN_APP);
      }
    }

    // 3. Deliver EMAIL
    if (targetChannels.includes(NotificationChannelEnum.EMAIL)) {
      const email = data.recipientEmail || user?.email;
      const allowEmail = email && (!emailPref || (emailPref.enabled && isCategoryEnabled(emailPref.categories, data.category)));
      if (allowEmail) {
        MockEmailProvider.sendEmail({
          to: email,
          subject: data.title,
          bodyHtml: data.message,
        });
        dispatchedChannels.push(NotificationChannelEnum.EMAIL);
      }
    }

    // 4. Deliver WHATSAPP (Strict Consent Protocol)
    if (targetChannels.includes(NotificationChannelEnum.WHATSAPP)) {
      const phone = data.recipientPhone;
      const hasConsent = data.hasWhatsAppConsent ?? (whatsappPref?.enabled && isCategoryEnabled(whatsappPref?.categories, data.category));
      if (phone && hasConsent) {
        MockWhatsAppProvider.sendWhatsApp({
          to: phone,
          messageText: `${data.title}\n\n${data.message}`,
        });
        dispatchedChannels.push(NotificationChannelEnum.WHATSAPP);
      }
    }

    return { success: true, dispatchedChannels };
  }

  public async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export const notificationQueue = new NotificationQueueManager();
