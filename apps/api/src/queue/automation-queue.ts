/**
 * HireFlow ATS — Automation Rules Engine & Queue Manager
 *
 * Implements admin-configurable automation rule execution.
 * Enforces client scoping, recipient resolution, candidate privacy,
 * deterministic idempotency keys, and execution log persistence.
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@hireflow/db';
import {
  AutomationTriggerEnum,
  NotificationChannelEnum,
  NotificationCategoryEnum,
  replaceMergeFields,
  generateAutomationIdempotencyKey,
} from '@hireflow/shared';
import { notificationQueue } from './notification-queue.js';

export interface AutomationEventPayload {
  organizationId: string;
  triggerEvent: AutomationTriggerEnum;
  eventId: string;
  relatedEntity?: string;
  relatedEntityId?: string;
  clientId?: string;
  context: Record<string, string>;
  assignedRecruiterId?: string;
  managerId?: string;
  candidateId?: string;
  panelUserIds?: string[];
  clientContactId?: string;
}

export const AUTOMATION_QUEUE_NAME = 'automation-rule-execution';

export class AutomationQueueManager {
  private queue: Queue<AutomationEventPayload> | null = null;
  private worker: Worker<AutomationEventPayload> | null = null;
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

      this.queue = new Queue(AUTOMATION_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: { age: 86400 },
        },
      });

      this.worker = new Worker(
        AUTOMATION_QUEUE_NAME,
        async (job: Job<AutomationEventPayload>) => {
          await this.processEvent(job.data);
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

  public async trigger(payload: AutomationEventPayload): Promise<{ triggered: boolean; executionCount: number }> {
    if (this.isConnected && this.queue) {
      try {
        await this.queue.add('execute-automation-event', payload);
        return { triggered: true, executionCount: 1 };
      } catch {
        // Fall back to direct execution
      }
    }
    return await this.processEvent(payload);
  }

  public async processEvent(payload: AutomationEventPayload): Promise<{ triggered: boolean; executionCount: number }> {
    // 1. Fetch matching active rules for this trigger
    const rules = await prisma.automationRule.findMany({
      where: {
        triggerEvent: payload.triggerEvent,
        status: 'ACTIVE',
        isActive: true,
        isArchived: false,
      },
    });

    let executionCount = 0;

    for (const rule of rules) {
      // 2. Strict Client Scope Validation: A rule configured for Client A must never trigger for Client B
      if (rule.clientScope && payload.clientId && rule.clientScope !== payload.clientId) {
        continue;
      }
      if (rule.clientScope && !payload.clientId) {
        // Rule requires a specific client, but event has no client context
        continue;
      }

      // 3. Resolve Target Recipients
      const recipientsList = Array.isArray(rule.recipients) ? (rule.recipients as any[]) : [];
      const channels = Array.isArray(rule.channels)
        ? (rule.channels as NotificationChannelEnum[])
        : [NotificationChannelEnum.IN_APP];

      const resolvedRecipientIds: Array<{ userId: string; isCandidate: boolean; email?: string; phone?: string }> = [];

      for (const target of recipientsList) {
        switch (target.type) {
          case 'ASSIGNED_RECRUITER':
            if (payload.assignedRecruiterId) {
              const u = await prisma.user.findUnique({ where: { id: payload.assignedRecruiterId } });
              if (u && !u.isArchived) {
                resolvedRecipientIds.push({ userId: u.id, isCandidate: false, email: u.email });
              }
            }
            break;
          case 'RECRUITER_MANAGER':
            if (payload.managerId) {
              const u = await prisma.user.findUnique({ where: { id: payload.managerId } });
              if (u && !u.isArchived) {
                resolvedRecipientIds.push({ userId: u.id, isCandidate: false, email: u.email });
              }
            }
            break;
          case 'ADMIN': {
            const admins = await prisma.user.findMany({
              where: { role: 'ADMIN', isArchived: false },
              take: 3,
            });
            for (const admin of admins) {
              resolvedRecipientIds.push({ userId: admin.id, isCandidate: false, email: admin.email });
            }
            break;
          }
          case 'INTERVIEW_PANEL':
            if (payload.panelUserIds?.length) {
              const panelists = await prisma.user.findMany({
                where: { id: { in: payload.panelUserIds }, isArchived: false },
              });
              for (const panelist of panelists) {
                resolvedRecipientIds.push({ userId: panelist.id, isCandidate: false, email: panelist.email });
              }
            }
            break;
          case 'CANDIDATE':
            if (payload.candidateId) {
              const cand = await prisma.candidate.findUnique({ where: { id: payload.candidateId } });
              if (cand && !cand.isArchived && cand.email) {
                resolvedRecipientIds.push({
                  userId: cand.id,
                  isCandidate: true,
                  email: cand.email,
                  phone: cand.phone || undefined,
                });
              }
            }
            break;
        }
      }

      // Deduplicate recipients
      const uniqueRecipients = Array.from(
        new Map(resolvedRecipientIds.map((r) => [r.userId, r])).values()
      );

      // 4. Execute Rule for each recipient with Idempotency
      for (const recipient of uniqueRecipients) {
        const idempotencyKey = generateAutomationIdempotencyKey(
          rule.id,
          rule.version,
          payload.eventId,
          recipient.userId
        );

        // Check idempotency in AutomationExecution
        const existingExecution = await prisma.automationExecution.findUnique({
          where: { idempotencyKey },
        });

        if (existingExecution && existingExecution.status === 'SUCCESS') {
          continue; // Already successfully processed
        }

        // Create or update execution log
        const execution = await prisma.automationExecution.upsert({
          where: { idempotencyKey },
          update: {
            status: 'PROCESSING',
            attemptCount: { increment: 1 },
          },
          create: {
            ruleId: rule.id,
            ruleVersion: rule.version,
            triggerEvent: payload.triggerEvent,
            relatedEntity: payload.relatedEntity,
            relatedEntityId: payload.relatedEntityId,
            recipientId: recipient.userId,
            recipientType: recipient.isCandidate ? 'CANDIDATE' : 'USER',
            channel: channels.join(','),
            status: 'PROCESSING',
            idempotencyKey,
          },
        });

        try {
          // 5. Merge fields with strict candidate-privacy sanitization
          const templateBody = rule.templateBody || 'Automated recruitment event occurred.';
          const templateSubject = rule.templateSubject || rule.name;

          const renderedSubject = replaceMergeFields(templateSubject, payload.context, recipient.isCandidate).text;
          const renderedBody = replaceMergeFields(templateBody, payload.context, recipient.isCandidate).text;

          // 6. Dispatch through Notification Queue
          await notificationQueue.dispatch({
            userId: recipient.userId,
            title: renderedSubject,
            message: renderedBody,
            category: NotificationCategoryEnum.SYSTEM,
            type: rule.triggerEvent,
            priority: 'NORMAL',
            channels,
            recipientEmail: recipient.email,
            recipientPhone: recipient.phone,
          });

          // 7. Mark execution successful
          await prisma.automationExecution.update({
            where: { id: execution.id },
            data: {
              status: 'SUCCESS',
              completedAt: new Date(),
            },
          });

          executionCount++;
        } catch (err: any) {
          await prisma.automationExecution.update({
            where: { id: execution.id },
            data: {
              status: 'FAILED',
              failureReason: err?.message || 'Execution error',
              completedAt: new Date(),
            },
          });
        }
      }
    }

    return { triggered: true, executionCount };
  }

  public async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export const automationQueue = new AutomationQueueManager();
