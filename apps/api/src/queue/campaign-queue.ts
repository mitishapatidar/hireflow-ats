/**
 * HireFlow ATS — Campaign Queue Manager
 *
 * Implements asynchronous batch dispatch of bulk Email and SMS campaigns.
 * Enforces per-candidate consent isolation, pre-delivery opt-out checks,
 * idempotency, retry mechanisms, and India TRAI DLT compliance.
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@hireflow/db';
import {
  CampaignChannel,
  CampaignStatus,
  RecipientDeliveryStatus,
  ExclusionReason,
  validateSmsDltCompliance,
  replaceMergeFields,
  MockEmailProvider,
  MockSMSProvider,
} from '@hireflow/shared';

export interface CampaignDispatchJobData {
  campaignId: string;
  organizationId: string;
  batchIndex?: number;
  recipientIds?: string[];
}

export const CAMPAIGN_QUEUE_NAME = 'campaign-dispatch';

export class CampaignQueueManager {
  private queue: Queue<CampaignDispatchJobData> | null = null;
  private worker: Worker<CampaignDispatchJobData> | null = null;
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

      this.queue = new Queue(CAMPAIGN_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 3600, count: 500 },
          removeOnFail: { age: 86400, count: 1000 },
        },
      });

      this.worker = new Worker(
        CAMPAIGN_QUEUE_NAME,
        async (job: Job<CampaignDispatchJobData>) => {
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

  public async dispatch(data: CampaignDispatchJobData): Promise<{ success: boolean; dispatchedCount: number }> {
    if (this.isConnected && this.queue) {
      try {
        await this.queue.add('dispatch-campaign', data);
        return { success: true, dispatchedCount: 0 };
      } catch {
        // Fall back to in-memory synchronous execution
        return await this.processJob(data);
      }
    }
    return await this.processJob(data);
  }

  public async processJob(data: CampaignDispatchJobData): Promise<{ success: boolean; dispatchedCount: number }> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
      include: {
        template: true,
        organization: true,
        recipients: {
          where: data.recipientIds && data.recipientIds.length > 0
            ? { id: { in: data.recipientIds } }
            : { status: 'PENDING' },
          include: {
            candidate: true,
          },
        },
      },
    });

    if (!campaign) {
      return { success: false, dispatchedCount: 0 };
    }

    // If campaign was cancelled, abort immediately
    if (campaign.status === CampaignStatus.CANCELLED) {
      return { success: false, dispatchedCount: 0 };
    }

    // Update status to PROCESSING
    if (campaign.status !== CampaignStatus.PROCESSING) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: CampaignStatus.PROCESSING,
          startedAt: campaign.startedAt || new Date(),
        },
      });
    }

    // Verify SMS DLT compliance if channel is SMS
    if (campaign.channel === CampaignChannel.SMS) {
      const dltCheck = validateSmsDltCompliance({
        dltHeaderId: campaign.dltHeaderId,
        dltTemplateId: campaign.dltTemplateId,
      });

      if (!dltCheck.isCompliant) {
        // Mark all pending recipients as failed due to missing DLT compliance
        await prisma.campaignRecipient.updateMany({
          where: {
            campaignId: campaign.id,
            status: 'PENDING',
          },
          data: {
            status: RecipientDeliveryStatus.FAILED,
            errorMessage: 'DLT_UNAPPROVED: Missing or invalid TRAI DLT credentials',
          },
        });

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CampaignStatus.FAILED,
            completedAt: new Date(),
          },
        });

        return { success: false, dispatchedCount: 0 };
      }
    }

    let dispatchedCount = 0;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hireflow.aureva.internal';

    for (const recipient of campaign.recipients) {
      // Idempotency check: skip already dispatched recipients
      if (recipient.status !== RecipientDeliveryStatus.PENDING) {
        continue;
      }

      const candidate = recipient.candidate;
      if (!candidate) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: RecipientDeliveryStatus.FAILED,
            errorMessage: 'Candidate record not found',
          },
        });
        continue;
      }

      // Pre-delivery fresh consent check
      if (campaign.channel === CampaignChannel.EMAIL) {
        if (!candidate.email) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientDeliveryStatus.FAILED,
              exclusionReason: ExclusionReason.MISSING_CONTACT,
              errorMessage: 'Candidate has no registered email address',
            },
          });
          continue;
        }

        if (candidate.emailMarketingOptIn === false) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientDeliveryStatus.FAILED,
              exclusionReason: ExclusionReason.OPTED_OUT,
              errorMessage: 'Candidate has unsubscribed from marketing emails',
            },
          });
          continue;
        }
      } else if (campaign.channel === CampaignChannel.SMS) {
        if (!candidate.phone) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientDeliveryStatus.FAILED,
              exclusionReason: ExclusionReason.MISSING_CONTACT,
              errorMessage: 'Candidate has no registered phone number',
            },
          });
          continue;
        }

        if (!candidate.smsOptIn) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientDeliveryStatus.FAILED,
              exclusionReason: ExclusionReason.NO_SMS_CONSENT,
              errorMessage: 'Candidate has not provided explicit SMS opt-in consent',
            },
          });
          continue;
        }
      }

      // Merge fields context
      const firstName = candidate.name ? candidate.name.split(' ')[0] : 'Candidate';
      const mergeContext = {
        first_name: firstName,
        client: campaign.organization?.name || 'Aureva Capital',
        date: new Date().toLocaleDateString('en-IN'),
        time: '10:00 AM IST',
        recruiter_name: 'Talent Acquisition Team',
      };

      const rawContent = campaign.body || campaign.template?.body || '';
      const rendered = replaceMergeFields(rawContent, mergeContext);

      // Perform dispatch via provider
      try {
        if (campaign.channel === CampaignChannel.EMAIL) {
          const unsubscribeUrl = `${baseUrl}/unsubscribe/${candidate.unsubscribeToken || candidate.id}`;
          const finalHtml = `${rendered.text}
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E6E8F0; font-size: 11px; color: #6B7490; font-family: sans-serif;">
  <p>You received this message because you are registered with ${campaign.organization?.name || 'Aureva Capital'}.</p>
  <p><a href="${unsubscribeUrl}" style="color: #5B49D6; text-decoration: underline;">Unsubscribe from marketing emails</a></p>
</div>`;

          const emailRes = MockEmailProvider.sendEmail({
            to: candidate.email,
            subject: campaign.subject || campaign.name,
            bodyHtml: finalHtml,
          });

          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientDeliveryStatus.DELIVERED,
              providerMessageId: emailRes.providerMessageId,
              sentAt: new Date(),
              deliveredAt: new Date(),
            },
          });
          dispatchedCount++;
        } else if (campaign.channel === CampaignChannel.SMS) {
          const smsRes = MockSMSProvider.sendSMS({
            to: candidate.phone || recipient.recipient,
            messageText: rendered.text,
          });

          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientDeliveryStatus.DELIVERED,
              providerMessageId: smsRes.providerMessageId,
              sentAt: new Date(),
              deliveredAt: new Date(),
            },
          });
          dispatchedCount++;
        }
      } catch (sendErr: any) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: RecipientDeliveryStatus.FAILED,
            errorMessage: sendErr?.message || 'Provider dispatch failure',
          },
        });
      }
    }

    // Check remaining pending recipients
    const remainingPending = await prisma.campaignRecipient.count({
      where: {
        campaignId: campaign.id,
        status: RecipientDeliveryStatus.PENDING,
      },
    });

    const [sentTotal, deliveredTotal, failedTotal] = await Promise.all([
      prisma.campaignRecipient.count({
        where: { campaignId: campaign.id, status: { in: [RecipientDeliveryStatus.SENT, RecipientDeliveryStatus.DELIVERED] } },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId: campaign.id, status: RecipientDeliveryStatus.DELIVERED },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId: campaign.id, status: RecipientDeliveryStatus.FAILED },
      }),
    ]);

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        sentCount: sentTotal,
        deliveredCount: deliveredTotal,
        failedCount: failedTotal,
        status: remainingPending === 0 ? CampaignStatus.COMPLETED : CampaignStatus.PROCESSING,
        completedAt: remainingPending === 0 ? new Date() : undefined,
      },
    });

    if (remainingPending === 0) {
      await prisma.auditLog.create({
        data: {
          actorId: campaign.createdById,
          action: 'CAMPAIGN_COMPLETED',
          entity: 'campaign',
          entityId: campaign.id,
          after: {
            campaignId: campaign.id,
            channel: campaign.channel,
            sentCount: sentTotal,
            deliveredCount: deliveredTotal,
            failedCount: failedTotal,
          },
          ipAddress: '127.0.0.1',
        },
      });
    }

    return { success: true, dispatchedCount };
  }

  public async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export const campaignQueue = new CampaignQueueManager();
