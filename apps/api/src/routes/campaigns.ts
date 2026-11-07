/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
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
  evaluateRecipientEligibility,
  validateSmsDltCompliance,
  calculateSmsSegments,
  replaceMergeFields,
  generateUnsubscribeToken,
  MockEmailProvider,
  MockSMSProvider,
} from '@hireflow/shared';
import { campaignQueue } from '../queue/campaign-queue.js';

export const campaignRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Guard: Internal Staff (Admin, Manager, Recruiter)
  function verifyInternalStaff(user: any) {
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      const err: any = new Error('Access denied: Client and Candidate roles cannot access campaigns');
      err.statusCode = 403;
      throw err;
    }
  }

  // -------------------------------------------------------------
  // 1. GET /api/campaigns (List Campaigns)
  // -------------------------------------------------------------
  server.get('/', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const query = request.query as any;
    const channel = query.channel && query.channel !== 'ALL' ? (query.channel as CampaignChannel) : undefined;
    const status = query.status && query.status !== 'ALL' ? (query.status as CampaignStatus) : undefined;
    const search = query.search ? String(query.search).trim() : undefined;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = {
      organizationId: user.organizationId,
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

    return reply.send({
      success: true,
      data: campaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // -------------------------------------------------------------
  // 2. POST /api/campaigns (Create Campaign Draft)
  // -------------------------------------------------------------
  server.post('/', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parseResult = CreateCampaignDraftSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const input = parseResult.data;

    // Verify template if provided
    if (input.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: input.templateId, organizationId: user.organizationId },
      });
      if (!template) {
        return reply.status(404).send({ success: false, error: 'Selected communication template not found' });
      }
    }

    // TRAI DLT validation if SMS
    if (input.channel === CampaignChannel.SMS && (input.dltSenderId || input.dltTemplateId || input.dltHeaderId)) {
      const dltCheck = validateSmsDltCompliance({
        dltSenderId: input.dltSenderId || input.dltHeaderId,
        dltTemplateId: input.dltTemplateId,
        dltEntityId: input.dltEntityId,
      });
      if (!dltCheck.isCompliant) {
        return reply.status(400).send({
          success: false,
          error: dltCheck.error || 'TRAI DLT validation failed for SMS campaign',
        });
      }
    }

    const campaignName = input.name || input.title || 'Untitled Campaign';
    const campaignBody = input.body || input.bodyHtml || input.bodyText || '';
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        name: campaignName,
        channel: input.channel,
        subject: input.subject,
        body: campaignBody,
        senderIdentity: input.senderIdentity,
        replyTo: input.replyTo,
        templateId: input.templateId,
        dltHeaderId: input.dltHeaderId || input.dltSenderId,
        dltTemplateId: input.dltTemplateId,
        audienceFilters: (input.audienceFilters || input.audienceFilter as any) || Prisma.JsonNull,
        status: CampaignStatus.DRAFT,
      },
      include: {
        template: { select: { id: true, title: true, category: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CAMPAIGN_DRAFT_CREATED',
        entity: 'campaign',
        entityId: campaign.id,
        after: {
          name: campaign.name,
          channel: campaign.channel,
        },
        ipAddress: '127.0.0.1',
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        ...campaign,
        dltSenderId: campaign.dltHeaderId,
      },
    });
  });

  // -------------------------------------------------------------
  // 3. POST /api/campaigns/test-send (Send Test Message)
  // -------------------------------------------------------------
  server.post('/test-send', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parseResult = SendTestCampaignSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const { channel, recipient, subject, bodyHtml, bodyText, body } = parseResult.data as any;
    const content = body || bodyHtml || bodyText || '';

    const mergeContext = {
      first_name: 'Test Candidate',
      client: 'Aureva Capital',
      date: new Date().toLocaleDateString('en-IN'),
      time: '11:00 AM IST',
      recruiter_name: user.name || 'Senior Recruiter',
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

      return reply.send({
        success: true,
        data: res,
        message: `Test email sent to ${recipient} (Demo mode)`,
      });
    } else {
      const rendered = replaceMergeFields(content, mergeContext).text;
      const res = MockSMSProvider.sendSMS({
        to: recipient,
        messageText: `[TEST] ${rendered}`,
      });

      const segmentInfo = calculateSmsSegments(rendered);

      return reply.send({
        success: true,
        data: {
          ...res,
          segmentInfo,
        },
        message: `Test SMS sent to ${recipient} (Demo mode)`,
      });
    }
  });

  // -------------------------------------------------------------
  // 4. GET /api/campaigns/:id (Campaign Details)
  // -------------------------------------------------------------
  server.get('/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        template: { select: { id: true, title: true, category: true, body: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'Campaign not found' });
    }

    // Delivery stats breakdown
    const [pendingCount, deliveredCount, failedCount, totalRecipients] = await Promise.all([
      prisma.campaignRecipient.count({ where: { campaignId: id, status: RecipientDeliveryStatus.PENDING } }),
      prisma.campaignRecipient.count({ where: { campaignId: id, status: RecipientDeliveryStatus.DELIVERED } }),
      prisma.campaignRecipient.count({ where: { campaignId: id, status: RecipientDeliveryStatus.FAILED } }),
      prisma.campaignRecipient.count({ where: { campaignId: id } }),
    ]);

    return reply.send({
      success: true,
      data: {
        ...campaign,
        liveMetrics: {
          totalRecipients,
          pendingCount,
          deliveredCount,
          failedCount,
        },
      },
    });
  });

  // -------------------------------------------------------------
  // 5. PATCH /api/campaigns/:id (Update Campaign Draft)
  // -------------------------------------------------------------
  server.patch('/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const existing = await prisma.campaign.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Campaign not found' });
    }

    if (existing.status !== CampaignStatus.DRAFT && existing.status !== CampaignStatus.SCHEDULED) {
      return reply.status(400).send({
        success: false,
        error: `Cannot modify campaign in ${existing.status} status. Only DRAFT or SCHEDULED campaigns can be edited.`,
      });
    }

    const parseResult = UpdateCampaignDraftSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const input = parseResult.data;

    // Check template if updating template
    if (input.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: input.templateId, organizationId: user.organizationId },
      });
      if (!template) {
        return reply.status(404).send({ success: false, error: 'Selected communication template not found' });
      }
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name || input.title || existing.name,
        channel: input.channel || existing.channel,
        subject: input.subject !== undefined ? input.subject : existing.subject,
        body: (input.body || input.bodyHtml || input.bodyText) ?? existing.body,
        senderIdentity: input.senderIdentity !== undefined ? input.senderIdentity : existing.senderIdentity,
        replyTo: input.replyTo !== undefined ? input.replyTo : existing.replyTo,
        templateId: input.templateId !== undefined ? input.templateId : existing.templateId,
        dltHeaderId: input.dltHeaderId || input.dltSenderId || existing.dltHeaderId,
        dltTemplateId: input.dltTemplateId !== undefined ? input.dltTemplateId : existing.dltTemplateId,
        audienceFilters: (input.audienceFilters || input.audienceFilter) !== undefined
          ? ((input.audienceFilters || input.audienceFilter) as any)
          : existing.audienceFilters,
        scheduledAt: input.scheduledAt !== undefined ? (input.scheduledAt ? new Date(input.scheduledAt) : null) : existing.scheduledAt,
      },
      include: {
        template: { select: { id: true, title: true, category: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return reply.send({
      success: true,
      data: updated,
    });
  });

  // -------------------------------------------------------------
  // 6. POST /api/campaigns/:id/audience (Audience Calculation & Recipient Validation)
  // -------------------------------------------------------------
  server.post('/:id/audience', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'Campaign not found' });
    }

    const body = (request.body as any) || {};
    const filter = ((body.audienceFilter || campaign.audienceFilters || {}) as any);
    const saveRecipients = Boolean(body.saveRecipients);

    // Build Prisma query based on audience filter
    const whereClause: Prisma.CandidateWhereInput = {
      organizationId: user.organizationId,
      isArchived: false,
    };

    if (filter.candidateStatus && Array.isArray(filter.candidateStatus) && filter.candidateStatus.length > 0) {
      whereClause.applications = {
        some: {
          status: { in: filter.candidateStatus },
        },
      };
    }

    if (filter.jobIds && Array.isArray(filter.jobIds) && filter.jobIds.length > 0) {
      whereClause.applications = {
        ...(whereClause.applications || {}),
        some: {
          jobId: { in: filter.jobIds },
        },
      };
    }

    if (filter.clientIds && Array.isArray(filter.clientIds) && filter.clientIds.length > 0) {
      whereClause.applications = {
        ...(whereClause.applications || {}),
        some: {
          job: { clientId: { in: filter.clientIds } },
        },
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

    // Query candidates
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
        campaign.channel as CampaignChannel,
        user.id,
        user.role
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

    // If requested, persist recipients and update campaign counters
    if (saveRecipients) {
      await prisma.$transaction(async (tx) => {
        // Delete pending/draft recipients for this campaign
        await tx.campaignRecipient.deleteMany({
          where: { campaignId: id, status: RecipientDeliveryStatus.PENDING },
        });

        // Insert eligible recipients
        if (eligibleList.length > 0) {
          await tx.campaignRecipient.createMany({
            data: eligibleList.map((rec) => ({
              campaignId: id,
              candidateId: rec.candidateId,
              recipient: rec.email || rec.phone || '',
              recipientName: rec.name,
              status: RecipientDeliveryStatus.PENDING,
            })),
            skipDuplicates: true,
          });
        }

        // Update campaign
        await tx.campaign.update({
          where: { id },
          data: {
            totalAudience: eligibleList.length,
            eligibleCount: eligibleList.length,
            excludedCount: excludedList.length,
            audienceFilters: filter,
          },
        });
      });
    }

    return reply.send({
      success: true,
      data: {
        totalEvaluated: candidates.length,
        eligibleCount: eligibleList.length,
        excludedCount: excludedList.length,
        exclusionBreakdown,
        sampleEligible: eligibleList.slice(0, 10),
        sampleExcluded: excludedList.slice(0, 10),
      },
    });
  });

  // -------------------------------------------------------------
  // 7. POST /api/campaigns/:id/schedule (Schedule or Send Immediately)
  // -------------------------------------------------------------
  server.post('/:id/schedule', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        recipients: { where: { status: RecipientDeliveryStatus.PENDING } },
      },
    });

    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'Campaign not found' });
    }

    if (campaign.status === CampaignStatus.PROCESSING || campaign.status === CampaignStatus.COMPLETED) {
      return reply.status(400).send({
        success: false,
        error: `Campaign has already been dispatched (current status: ${campaign.status}).`,
      });
    }

    const parseResult = ScheduleCampaignSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const { scheduledAt, sendNow } = parseResult.data;

    // Check recipients exist
    const pendingRecipientCount = campaign.recipients.length;
    if (pendingRecipientCount === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Cannot schedule campaign with 0 eligible recipients. Please calculate and save audience first.',
      });
    }

    // Verify DLT if SMS
    if (campaign.channel === CampaignChannel.SMS) {
      const dltCheck = validateSmsDltCompliance({
        dltSenderId: campaign.dltHeaderId,
        dltTemplateId: campaign.dltTemplateId,
        dltEntityId: undefined,
      });
      if (!dltCheck.isCompliant) {
        return reply.status(400).send({
          success: false,
          error: dltCheck.error || 'TRAI DLT validation failed for SMS campaign',
        });
      }
    }

    if (sendNow) {
      const updated = await prisma.campaign.update({
        where: { id },
        data: {
          status: CampaignStatus.PROCESSING,
          startedAt: new Date(),
        },
      });

      // Trigger dispatch asynchronously
      campaignQueue.dispatch({
        campaignId: id,
        organizationId: user.organizationId,
      }).catch((err) => {
        server.log.error(err, 'Failed to dispatch campaign queue job');
      });

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CAMPAIGN_DISPATCH_STARTED',
          entity: 'campaign',
          entityId: id,
          after: {
            name: campaign.name,
            channel: campaign.channel,
            recipientCount: pendingRecipientCount,
          },
          ipAddress: '127.0.0.1',
        },
      });

      return reply.send({
        success: true,
        data: updated,
        message: `Campaign dispatch started for ${pendingRecipientCount} recipients.`,
      });
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
          actorId: user.id,
          action: 'CAMPAIGN_SCHEDULED',
          entity: 'campaign',
          entityId: id,
          after: {
            name: campaign.name,
            channel: campaign.channel,
            scheduledAt: scheduledDate.toISOString(),
          },
          ipAddress: '127.0.0.1',
        },
      });

      return reply.send({
        success: true,
        data: updated,
        message: `Campaign scheduled for ${scheduledDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST).`,
      });
    }
  });

  // -------------------------------------------------------------
  // 8. POST /api/campaigns/:id/cancel (Cancel Scheduled Campaign)
  // -------------------------------------------------------------
  server.post('/:id/cancel', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'Campaign not found' });
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      return reply.status(400).send({
        success: false,
        error: 'Cannot cancel an already completed campaign.',
      });
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.CANCELLED,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CAMPAIGN_CANCELLED',
        entity: 'campaign',
        entityId: id,
        ipAddress: '127.0.0.1',
      },
    });

    return reply.send({
      success: true,
      data: updated,
      message: 'Campaign has been cancelled.',
    });
  });

  // -------------------------------------------------------------
  // 9. POST /api/campaigns/:id/retry (Retry Failed Recipients)
  // -------------------------------------------------------------
  server.post('/:id/retry', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'Campaign not found' });
    }

    // Find failed recipients
    const failedRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: id, status: RecipientDeliveryStatus.FAILED },
      include: { candidate: true },
    });

    if (failedRecipients.length === 0) {
      return reply.send({
        success: true,
        message: 'No failed recipients found to retry.',
        retriedCount: 0,
      });
    }

    // Re-verify consent before allowing retry
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
        user.id,
        user.role
      );
      if (eligibility.isEligible) {
        eligibleForRetryIds.push(fr.id);
      }
    }

    if (eligibleForRetryIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'None of the failed recipients currently have valid opt-in consent for retry.',
      });
    }

    // Reset eligible to PENDING
    await prisma.campaignRecipient.updateMany({
      where: { id: { in: eligibleForRetryIds } },
      data: {
        status: RecipientDeliveryStatus.PENDING,
        errorMessage: null,
      },
    });

    await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.PROCESSING,
      },
    });

    // Trigger queue job for the retried recipient IDs
    campaignQueue.dispatch({
      campaignId: id,
      organizationId: user.organizationId,
      recipientIds: eligibleForRetryIds,
    }).catch((err) => {
      server.log.error(err, 'Failed to dispatch retry campaign queue job');
    });

    return reply.send({
      success: true,
      message: `Retrying delivery for ${eligibleForRetryIds.length} recipients with valid consent.`,
      retriedCount: eligibleForRetryIds.length,
    });
  });

  // -------------------------------------------------------------
  // 10. GET /api/campaigns/:id/recipients (Paginated Delivery Logs)
  // -------------------------------------------------------------
  server.get('/:id/recipients', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };
    const query = request.query as any;
    const status = query.status && query.status !== 'ALL' ? (query.status as RecipientDeliveryStatus) : undefined;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignRecipientWhereInput = {
      campaignId: id,
    };
    if (status) where.status = status;

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

    return reply.send({
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
    });
  });
};

// =============================================================
// PUBLIC UNSUBSCRIBE ROUTES PLUGIN
// =============================================================
export const publicUnsubscribeRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------
  // GET /api/public/unsubscribe/:token (Verify Unsubscribe Token)
  // -------------------------------------------------------------
  server.get('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

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
      return reply.status(404).send({
        success: false,
        error: 'Invalid or expired unsubscribe link.',
      });
    }

    return reply.send({
      success: true,
      data: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        isSubscribed: candidate.emailMarketingOptIn,
        optedOutAt: candidate.emailMarketingOptOutAt?.toISOString() || null,
        organizationName: candidate.organization?.name || 'Aureva Capital',
      },
    });
  });

  // -------------------------------------------------------------
  // POST /api/public/unsubscribe/:token (Process Opt-Out)
  // -------------------------------------------------------------
  server.post('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const parseResult = UnsubscribeSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const { feedback, channel } = parseResult.data;

    const candidate = await prisma.candidate.findFirst({
      where: {
        OR: [{ unsubscribeToken: token }, { id: token }],
      },
    });

    if (!candidate) {
      return reply.status(404).send({
        success: false,
        error: 'Invalid or expired unsubscribe token.',
      });
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

    // Record audit log
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
        ipAddress: request.ip || '127.0.0.1',
      },
    });

    return reply.send({
      success: true,
      message: 'You have been successfully unsubscribed. You will not receive marketing communications from us.',
    });
  });
};
