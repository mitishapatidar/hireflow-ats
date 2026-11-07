'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  CampaignChannel,
  CampaignStatus,
  RecipientDeliveryStatus,
  ExclusionReason,
  CreateCampaignDraftSchema,
  UpdateCampaignDraftSchema,
  ScheduleCampaignSchema,
  SendTestCampaignSchema,
  UnsubscribeSchema,
  CreateCampaignDraftInput,
  UpdateCampaignDraftInput,
  ScheduleCampaignInput,
  SendTestCampaignInput,
  UnsubscribeInput,
  evaluateRecipientEligibility,
  validateSmsDltCompliance,
  calculateSmsSegments,
  replaceMergeFields,
  MockEmailProvider,
  MockSMSProvider,
} from '@hireflow/shared';

// Helper: Staff Auth Guard
function assertInternalStaff(user: any) {
  if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    throw new Error('Forbidden: Client and Candidate roles cannot manage communication campaigns.');
  }
}

// -------------------------------------------------------------
// 1. GET /api/campaigns (List Campaigns)
// -------------------------------------------------------------
export async function getCampaignsAction(params: {
  channel?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const channel = params.channel && params.channel !== 'ALL' ? (params.channel as CampaignChannel) : undefined;
    const status = params.status && params.status !== 'ALL' ? (params.status as CampaignStatus) : undefined;
    const search = params.search ? params.search.trim() : undefined;
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = {
      organizationId: user!.organizationId,
    };

    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          template: { select: { id: true, title: true, category: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ]);

    // Aggregate overall metrics for dashboard
    const [totalDelivered, activeCount] = await Promise.all([
      prisma.campaign.aggregate({
        where: { organizationId: user!.organizationId },
        _sum: { deliveredCount: true },
      }),
      prisma.campaign.count({
        where: {
          organizationId: user!.organizationId,
          status: { in: [CampaignStatus.PROCESSING, CampaignStatus.SCHEDULED] },
        },
      }),
    ]);

    return {
      success: true,
      data: campaigns.map((c) => ({
        ...c,
        dltSenderId: c.dltHeaderId,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalDelivered: totalDelivered._sum.deliveredCount || 0,
        activeCount,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to list campaigns' };
  }
}

// -------------------------------------------------------------
// 2. GET /api/campaigns/:id (Campaign Detail)
// -------------------------------------------------------------
export async function getCampaignAction(id: string) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user!.organizationId },
      include: {
        template: { select: { id: true, title: true, category: true, body: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    const [pendingCount, deliveredCount, failedCount, totalRecipients] = await Promise.all([
      prisma.campaignRecipient.count({ where: { campaignId: id, status: RecipientDeliveryStatus.PENDING } }),
      prisma.campaignRecipient.count({ where: { campaignId: id, status: RecipientDeliveryStatus.DELIVERED } }),
      prisma.campaignRecipient.count({ where: { campaignId: id, status: RecipientDeliveryStatus.FAILED } }),
      prisma.campaignRecipient.count({ where: { campaignId: id } }),
    ]);

    return {
      success: true,
      data: {
        ...campaign,
        dltSenderId: campaign.dltHeaderId,
        liveMetrics: {
          totalRecipients,
          pendingCount,
          deliveredCount,
          failedCount,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch campaign' };
  }
}

// -------------------------------------------------------------
// 3. POST /api/campaigns (Create Campaign Draft)
// -------------------------------------------------------------
export async function createCampaignDraftAction(input: CreateCampaignDraftInput) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const parseResult = CreateCampaignDraftSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Validation failed', details: parseResult.error.flatten() };
    }

    const data = parseResult.data;

    if (data.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: data.templateId, organizationId: user!.organizationId },
      });
      if (!template) {
        return { success: false, error: 'Selected communication template not found' };
      }
    }

    const campaignName = data.name || data.title || 'Untitled Campaign';
    const campaignBody = data.body || data.bodyHtml || data.bodyText || '';

    // DLT check for SMS
    if (data.channel === CampaignChannel.SMS && (data.dltSenderId || data.dltHeaderId || data.dltTemplateId)) {
      const dltCheck = validateSmsDltCompliance({
        dltSenderId: data.dltSenderId || data.dltHeaderId,
        dltTemplateId: data.dltTemplateId,
        dltEntityId: data.dltEntityId,
      });
      if (!dltCheck.isCompliant) {
        return { success: false, error: dltCheck.error || 'TRAI DLT validation failed for SMS campaign' };
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: user!.organizationId,
        createdById: user!.id,
        name: campaignName,
        channel: data.channel,
        subject: data.subject,
        body: campaignBody,
        senderIdentity: data.senderIdentity,
        replyTo: data.replyTo,
        templateId: data.templateId,
        dltHeaderId: data.dltHeaderId || data.dltSenderId,
        dltTemplateId: data.dltTemplateId,
        audienceFilters: (data.audienceFilters || data.audienceFilter as any) || Prisma.JsonNull,
        status: CampaignStatus.DRAFT,
      },
      include: {
        template: { select: { id: true, title: true, category: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user!.id,
        action: 'CAMPAIGN_DRAFT_CREATED',
        entity: 'campaign',
        entityId: campaign.id,
        after: { name: campaign.name, channel: campaign.channel },
        ipAddress: '127.0.0.1',
      },
    });

    revalidatePath('/communications/campaigns');
    return {
      success: true,
      data: {
        ...campaign,
        dltSenderId: campaign.dltHeaderId,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create campaign draft' };
  }
}

// -------------------------------------------------------------
// 4. PATCH /api/campaigns/:id (Update Campaign Draft)
// -------------------------------------------------------------
export async function updateCampaignDraftAction(id: string, input: UpdateCampaignDraftInput) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const existing = await prisma.campaign.findFirst({
      where: { id, organizationId: user!.organizationId },
    });

    if (!existing) {
      return { success: false, error: 'Campaign not found' };
    }

    if (existing.status !== CampaignStatus.DRAFT && existing.status !== CampaignStatus.SCHEDULED) {
      return {
        success: false,
        error: `Cannot modify campaign in ${existing.status} status. Only DRAFT or SCHEDULED campaigns can be edited.`,
      };
    }

    const parseResult = UpdateCampaignDraftSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Validation failed', details: parseResult.error.flatten() };
    }

    const data = parseResult.data;

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: data.name || data.title || existing.name,
        channel: data.channel || existing.channel,
        subject: data.subject !== undefined ? data.subject : existing.subject,
        body: (data.body || data.bodyHtml || data.bodyText) ?? existing.body,
        senderIdentity: data.senderIdentity !== undefined ? data.senderIdentity : existing.senderIdentity,
        replyTo: data.replyTo !== undefined ? data.replyTo : existing.replyTo,
        templateId: data.templateId !== undefined ? data.templateId : existing.templateId,
        dltHeaderId: data.dltHeaderId || data.dltSenderId || existing.dltHeaderId,
        dltTemplateId: data.dltTemplateId !== undefined ? data.dltTemplateId : existing.dltTemplateId,
        audienceFilters: (data.audienceFilters || data.audienceFilter) !== undefined
          ? ((data.audienceFilters || data.audienceFilter) as any)
          : existing.audienceFilters,
        scheduledAt: data.scheduledAt !== undefined ? (data.scheduledAt ? new Date(data.scheduledAt) : null) : existing.scheduledAt,
      },
      include: {
        template: { select: { id: true, title: true, category: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    revalidatePath(`/communications/campaigns/${id}`);
    revalidatePath('/communications/campaigns');
    return {
      success: true,
      data: {
        ...updated,
        dltSenderId: updated.dltHeaderId,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update campaign draft' };
  }
}

// -------------------------------------------------------------
// 5. POST /api/campaigns/:id/audience (Calculate & Save Audience)
// -------------------------------------------------------------
export async function calculateAudienceAction(
  idOrParams:
    | string
    | {
        campaignId?: string;
        channel?: CampaignChannel;
        filters?: any;
        audienceFilter?: any;
        saveRecipients?: boolean;
      },
  params: { audienceFilter?: any; saveRecipients?: boolean } = {}
) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const campaignId = typeof idOrParams === 'string' ? idOrParams : idOrParams.campaignId;
    let channel: CampaignChannel =
      typeof idOrParams === 'object' && idOrParams.channel ? idOrParams.channel : CampaignChannel.EMAIL;
    let filter =
      typeof idOrParams === 'object'
        ? idOrParams.filters || idOrParams.audienceFilter || {}
        : params.audienceFilter || {};
    const saveRecipients =
      typeof idOrParams === 'object'
        ? Boolean(idOrParams.saveRecipients)
        : Boolean(params.saveRecipients);

    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, organizationId: user!.organizationId },
      });
      if (campaign) {
        channel = (campaign.channel as CampaignChannel) || channel;
        if (Object.keys(filter).length === 0 && campaign.audienceFilters) {
          filter = campaign.audienceFilters;
        }
      }
    }

    const whereClause: Prisma.CandidateWhereInput = {
      organizationId: user!.organizationId,
      isArchived: false,
    };

    if (filter.candidateStatus && Array.isArray(filter.candidateStatus) && filter.candidateStatus.length > 0) {
      whereClause.applications = {
        some: { status: { in: filter.candidateStatus } },
      };
    }

    if (filter.jobIds && Array.isArray(filter.jobIds) && filter.jobIds.length > 0) {
      whereClause.applications = {
        ...(whereClause.applications || {}),
        some: { jobId: { in: filter.jobIds } },
      };
    }

    if (filter.clientIds && Array.isArray(filter.clientIds) && filter.clientIds.length > 0) {
      whereClause.applications = {
        ...(whereClause.applications || {}),
        some: { job: { clientId: { in: filter.clientIds } } },
      };
    }

    if (filter.tags && Array.isArray(filter.tags) && filter.tags.length > 0) {
      whereClause.tags = { some: { name: { in: filter.tags } } };
    }

    if (filter.skills && Array.isArray(filter.skills) && filter.skills.length > 0) {
      whereClause.skills = { hasSome: filter.skills };
    }

    if (filter.location && typeof filter.location === 'string' && filter.location.trim().length > 0) {
      whereClause.location = { contains: filter.location.trim(), mode: 'insensitive' };
    }

    if (filter.noticePeriod && typeof filter.noticePeriod === 'string') {
      whereClause.noticePeriod = { contains: filter.noticePeriod, mode: 'insensitive' };
    }

    if (filter.search && typeof filter.search === 'string' && filter.search.trim().length > 0) {
      const q = filter.search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const candidates = await prisma.candidate.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailMarketingOptIn: true,
        smsOptIn: true,
        unsubscribeToken: true,
      },
      take: 2000,
    });

    const eligibleList: any[] = [];
    const excludedList: any[] = [];
    const exclusionBreakdown: Record<string, number> = {
      [ExclusionReason.NO_EMAIL_CONSENT]: 0,
      [ExclusionReason.NO_SMS_CONSENT]: 0,
      [ExclusionReason.OPTED_OUT]: 0,
      [ExclusionReason.INVALID_FORMAT]: 0,
      [ExclusionReason.MISSING_CONTACT]: 0,
      [ExclusionReason.UNAUTHORIZED_SCOPE]: 0,
      [ExclusionReason.SUPPRESSED]: 0,
      UNSUBSCRIBED: 0,
    };

    for (const cand of candidates) {
      const evalResult = evaluateRecipientEligibility(
        {
          id: cand.id,
          name: cand.name,
          email: cand.email,
          phone: cand.phone,
          emailMarketingOptIn: cand.emailMarketingOptIn,
          smsOptIn: cand.smsOptIn,
        },
        channel as CampaignChannel,
        user!.id,
        user!.role
      );

      if (evalResult.isEligible) {
        eligibleList.push({
          candidateId: cand.id,
          name: cand.name,
          email: cand.email,
          phone: cand.phone,
        });
      } else {
        const reason = evalResult.exclusionReason || ExclusionReason.OPTED_OUT;
        exclusionBreakdown[reason] = (exclusionBreakdown[reason] || 0) + 1;
        if (reason === ExclusionReason.OPTED_OUT) {
          exclusionBreakdown.UNSUBSCRIBED = (exclusionBreakdown.UNSUBSCRIBED || 0) + 1;
        }
        excludedList.push({
          candidateId: cand.id,
          name: cand.name,
          email: cand.email,
          phone: cand.phone,
          reason,
        });
      }
    }

    if (saveRecipients && campaignId) {
      await prisma.$transaction(async (tx) => {
        await tx.campaignRecipient.deleteMany({
          where: { campaignId, status: RecipientDeliveryStatus.PENDING },
        });

        if (eligibleList.length > 0) {
          await tx.campaignRecipient.createMany({
            data: eligibleList.map((rec) => ({
              campaignId,
              candidateId: rec.candidateId,
              recipient: rec.email || rec.phone || '',
              recipientName: rec.name,
              status: RecipientDeliveryStatus.PENDING,
            })),
            skipDuplicates: true,
          });
        }

        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            totalAudience: eligibleList.length,
            eligibleCount: eligibleList.length,
            excludedCount: excludedList.length,
            audienceFilters: filter,
          },
        });
      });
    }

    return {
      success: true,
      data: {
        totalEvaluated: candidates.length,
        eligibleCount: eligibleList.length,
        excludedCount: excludedList.length,
        exclusionBreakdown,
        sampleEligible: eligibleList.slice(0, 10),
        sampleExcluded: excludedList.slice(0, 10),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to calculate audience' };
  }
}

// -------------------------------------------------------------
// 6. POST /api/campaigns/:id/schedule (Schedule or Send Immediately)
// -------------------------------------------------------------
export async function scheduleCampaignAction(id: string, input: ScheduleCampaignInput) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user!.organizationId },
      include: {
        recipients: { where: { status: RecipientDeliveryStatus.PENDING } },
      },
    });

    if (!campaign) return { success: false, error: 'Campaign not found' };

    if (campaign.status === CampaignStatus.PROCESSING || campaign.status === CampaignStatus.COMPLETED) {
      return {
        success: false,
        error: `Campaign has already been dispatched (current status: ${campaign.status}).`,
      };
    }

    const parseResult = ScheduleCampaignSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Validation failed', details: parseResult.error.flatten() };
    }

    const { scheduledAt, sendNow } = parseResult.data;

    if (campaign.recipients.length === 0) {
      return {
        success: false,
        error: 'Cannot schedule campaign with 0 eligible recipients. Please calculate and save audience first.',
      };
    }

    if (campaign.channel === CampaignChannel.SMS) {
      const dltCheck = validateSmsDltCompliance({
        dltHeaderId: campaign.dltHeaderId,
        dltTemplateId: campaign.dltTemplateId,
      });
      if (!dltCheck.isCompliant) {
        return { success: false, error: dltCheck.error || 'TRAI DLT validation failed for SMS campaign' };
      }
    }

    if (sendNow) {
      // Direct mock dispatch in Server Action context
      await prisma.campaign.update({
        where: { id },
        data: {
          status: CampaignStatus.PROCESSING,
          startedAt: new Date(),
        },
      });

      // Dispatch batch
      const pendingRecipients = await prisma.campaignRecipient.findMany({
        where: { campaignId: id, status: RecipientDeliveryStatus.PENDING },
        include: { candidate: true },
      });

      let dispatchedCount = 0;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hireflow.aureva.internal';

      for (const rec of pendingRecipients) {
        if (!rec.candidate) continue;

        const mergeContext = {
          first_name: rec.candidate.name ? rec.candidate.name.split(' ')[0] : 'Candidate',
          client: 'Aureva Capital',
          date: new Date().toLocaleDateString('en-IN'),
          time: '10:00 AM IST',
          recruiter_name: user!.name || 'Talent Acquisition Team',
        };

        const rendered = replaceMergeFields(campaign.body, mergeContext).text;

        if (campaign.channel === CampaignChannel.EMAIL) {
          const unsubscribeUrl = `${baseUrl}/unsubscribe/${rec.candidate.unsubscribeToken || rec.candidate.id}`;
          const finalHtml = `${rendered}
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E6E8F0; font-size: 11px; color: #6B7490; font-family: sans-serif;">
  <p>You received this message because you are registered with Aureva Capital.</p>
  <p><a href="${unsubscribeUrl}" style="color: #5B49D6; text-decoration: underline;">Unsubscribe from marketing emails</a></p>
</div>`;

          const emailRes = MockEmailProvider.sendEmail({
            to: rec.candidate.email,
            subject: campaign.subject || campaign.name,
            bodyHtml: finalHtml,
          });

          await prisma.campaignRecipient.update({
            where: { id: rec.id },
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
            to: rec.candidate.phone || rec.recipient,
            messageText: rendered,
          });

          await prisma.campaignRecipient.update({
            where: { id: rec.id },
            data: {
              status: RecipientDeliveryStatus.DELIVERED,
              providerMessageId: smsRes.providerMessageId,
              sentAt: new Date(),
              deliveredAt: new Date(),
            },
          });
          dispatchedCount++;
        }
      }

      await prisma.campaign.update({
        where: { id },
        data: {
          sentCount: dispatchedCount,
          deliveredCount: dispatchedCount,
          status: CampaignStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: user!.id,
          action: 'CAMPAIGN_DISPATCH_COMPLETED',
          entity: 'campaign',
          entityId: id,
          after: { dispatchedCount },
          ipAddress: '127.0.0.1',
        },
      });

      revalidatePath(`/communications/campaigns/${id}`);
      revalidatePath('/communications/campaigns');
      return {
        success: true,
        message: `Campaign dispatched to ${dispatchedCount} recipient(s) in Demo Mode.`,
      };
    } else {
      const scheduledDate = new Date(scheduledAt!);
      const updated = await prisma.campaign.update({
        where: { id },
        data: {
          status: CampaignStatus.SCHEDULED,
          scheduledAt: scheduledDate,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: user!.id,
          action: 'CAMPAIGN_SCHEDULED',
          entity: 'campaign',
          entityId: id,
          after: { scheduledAt: scheduledDate.toISOString() },
          ipAddress: '127.0.0.1',
        },
      });

      revalidatePath(`/communications/campaigns/${id}`);
      revalidatePath('/communications/campaigns');
      return {
        success: true,
        message: `Campaign scheduled for ${scheduledDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST).`,
        data: updated,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to schedule campaign' };
  }
}

// -------------------------------------------------------------
// 7. POST /api/campaigns/:id/cancel (Cancel Campaign)
// -------------------------------------------------------------
export async function cancelCampaignAction(id: string) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user!.organizationId },
    });

    if (!campaign) return { success: false, error: 'Campaign not found' };

    if (campaign.status === CampaignStatus.COMPLETED) {
      return { success: false, error: 'Cannot cancel an already completed campaign.' };
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED, cancelledAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user!.id,
        action: 'CAMPAIGN_CANCELLED',
        entity: 'campaign',
        entityId: id,
        ipAddress: '127.0.0.1',
      },
    });

    revalidatePath(`/communications/campaigns/${id}`);
    revalidatePath('/communications/campaigns');
    return { success: true, message: 'Campaign has been cancelled.', data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel campaign' };
  }
}

// -------------------------------------------------------------
// 8. POST /api/campaigns/:id/retry (Retry Failed Recipients)
// -------------------------------------------------------------
export async function retryCampaignAction(id: string) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user!.organizationId },
    });

    if (!campaign) return { success: false, error: 'Campaign not found' };

    const failedRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: id, status: RecipientDeliveryStatus.FAILED },
      include: { candidate: true },
    });

    if (failedRecipients.length === 0) {
      return { success: true, message: 'No failed recipients found to retry.', retriedCount: 0 };
    }

    const eligibleForRetryIds: string[] = [];
    for (const fr of failedRecipients) {
      if (!fr.candidate) continue;
      const eligibility = evaluateRecipientEligibility(
        {
          id: fr.candidate.id,
          name: fr.candidate.name,
          email: fr.candidate.email,
          phone: fr.candidate.phone,
          emailMarketingOptIn: fr.candidate.emailMarketingOptIn,
          smsOptIn: fr.candidate.smsOptIn,
        },
        campaign.channel as CampaignChannel,
        user!.id,
        user!.role
      );
      if (eligibility.isEligible) {
        eligibleForRetryIds.push(fr.id);
      }
    }

    if (eligibleForRetryIds.length === 0) {
      return {
        success: false,
        error: 'None of the failed recipients currently have valid opt-in consent for retry.',
      };
    }

    await prisma.campaignRecipient.updateMany({
      where: { id: { in: eligibleForRetryIds } },
      data: {
        status: RecipientDeliveryStatus.PENDING,
        errorMessage: null,
      },
    });

    revalidatePath(`/communications/campaigns/${id}`);
    return {
      success: true,
      message: `Reset ${eligibleForRetryIds.length} recipient(s) for retry.`,
      retriedCount: eligibleForRetryIds.length,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to retry recipients' };
  }
}

// -------------------------------------------------------------
// 9. GET /api/campaigns/:id/recipients (Delivery Logs)
// -------------------------------------------------------------
export async function getCampaignRecipientsAction(
  id: string,
  params: { status?: string; page?: number; limit?: number; search?: string } = {}
) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const status = params.status && params.status !== 'ALL' ? (params.status as RecipientDeliveryStatus) : undefined;
    const search = params.search ? params.search.trim() : undefined;
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignRecipientWhereInput = {
      campaignId: id,
    };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { recipient: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { candidate: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [recipients, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where,
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              emailMarketingOptIn: true,
              smsOptIn: true,
            },
          },
        },
        orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.campaignRecipient.count({ where }),
    ]);

    return {
      success: true,
      data: recipients.map((r) => ({
        id: r.id,
        candidateId: r.candidateId,
        candidateName: r.candidate?.name || r.recipientName || 'Unknown Candidate',
        recipient: r.recipient,
        email: r.candidate?.email || (r.recipient.includes('@') ? r.recipient : null),
        phone: r.candidate?.phone || (!r.recipient.includes('@') ? r.recipient : null),
        status: r.status,
        deliveryStatus: r.status,
        failureReason: r.errorMessage || r.exclusionReason,
        providerMessageId: r.providerMessageId,
        sentAt: r.sentAt?.toISOString() || null,
        deliveredAt: r.deliveredAt?.toISOString() || null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch recipients' };
  }
}

// -------------------------------------------------------------
// 10. POST /api/campaigns/test-send (Test Send)
// -------------------------------------------------------------
export async function sendTestCampaignAction(input: SendTestCampaignInput) {
  try {
    const user = await getCurrentUser();
    assertInternalStaff(user);

    const parseResult = SendTestCampaignSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: 'Validation failed', details: parseResult.error.flatten() };
    }

    const { channel, recipient, subject, body, bodyHtml, bodyText } = parseResult.data as any;
    const content = body || bodyHtml || bodyText || '';

    const mergeContext = {
      first_name: 'Test Candidate',
      client: 'Aureva Capital',
      date: new Date().toLocaleDateString('en-IN'),
      time: '11:00 AM IST',
      recruiter_name: user!.name || 'Senior Recruiter',
    };

    if (channel === CampaignChannel.EMAIL) {
      const rendered = replaceMergeFields(content, mergeContext).text;
      const testEmailHtml = `<div style="padding: 12px; background: #EEEBFB; border-radius: 6px; margin-bottom: 16px; font-size: 12px; color: #5B49D6; font-weight: bold;">
  [TEST CAMPAIGN PREVIEW] — Delivered to ${recipient}
</div>
${rendered}`;

      const res = MockEmailProvider.sendEmail({
        to: recipient,
        subject: `[TEST] ${subject || 'Campaign Preview'}`,
        bodyHtml: testEmailHtml,
      });

      return {
        success: true,
        data: res,
        message: `Test email dispatched to ${recipient} (Demo mode)`,
      };
    } else {
      const rendered = replaceMergeFields(content, mergeContext).text;
      const res = MockSMSProvider.sendSMS({
        to: recipient,
        messageText: `[TEST] ${rendered}`,
      });

      const segmentInfo = calculateSmsSegments(rendered);

      return {
        success: true,
        data: {
          ...res,
          segmentInfo,
        },
        message: `Test SMS dispatched to ${recipient} (Demo mode)`,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send test message' };
  }
}

// -------------------------------------------------------------
// 11. Public Unsubscribe Actions
// -------------------------------------------------------------
export async function getPublicUnsubscribeCandidateAction(token: string) {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: {
        OR: [{ unsubscribeToken: token }, { id: token }],
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailMarketingOptIn: true,
        emailMarketingOptOutAt: true,
        organization: { select: { name: true } },
      },
    });

    if (!candidate) {
      return { success: false, error: 'Invalid or expired unsubscribe link.' };
    }

    return {
      success: true,
      data: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        emailMarketingOptIn: candidate.emailMarketingOptIn,
        isSubscribed: candidate.emailMarketingOptIn,
        optedOutAt: candidate.emailMarketingOptOutAt?.toISOString() || null,
        organizationName: candidate.organization?.name || 'Aureva Capital',
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to verify unsubscribe link' };
  }
}

export async function unsubscribeCandidateAction(
  tokenOrInput: string | (UnsubscribeInput & { token?: string }),
  maybeInput?: UnsubscribeInput
) {
  try {
    const token = typeof tokenOrInput === 'string' ? tokenOrInput : tokenOrInput.token || '';
    const rawInput = typeof tokenOrInput === 'string' ? maybeInput || {} : tokenOrInput;

    const parseResult = UnsubscribeSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: 'Validation failed', details: parseResult.error.flatten() };
    }

    const { feedback, channel } = parseResult.data;

    const candidate = await prisma.candidate.findFirst({
      where: {
        OR: [{ unsubscribeToken: token }, { id: token }],
      },
    });

    if (!candidate) {
      return { success: false, error: 'Invalid or expired unsubscribe token.' };
    }

    const updateData: Prisma.CandidateUpdateInput = {};
    if (!channel || channel === CampaignChannel.EMAIL) {
      updateData.emailMarketingOptIn = false;
      updateData.emailMarketingOptOutAt = new Date();
    }
    if (channel === CampaignChannel.SMS) {
      updateData.smsOptIn = false;
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        actorId: candidate.id,
        action: 'CANDIDATE_UNSUBSCRIBED',
        entity: 'candidate',
        entityId: candidate.id,
        after: {
          channel: channel || CampaignChannel.EMAIL,
          feedback: feedback || null,
          unsubscribedAt: new Date().toISOString(),
        },
        ipAddress: '127.0.0.1',
      },
    });

    return {
      success: true,
      message: 'You have been successfully unsubscribed. You will not receive further marketing communications.',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to process unsubscribe' };
  }
}

// Named Aliases
export const retryFailedRecipientsAction = retryCampaignAction;
export const calculateCampaignAudienceAction = calculateAudienceAction;
