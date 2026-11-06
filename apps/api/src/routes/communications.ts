/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  MessageChannel,
  MessageDirection,
  MessageDeliveryStatus,
  TemplateCategory,
  TemplateStatus,
  ProviderApprovalState,
  ConnectionState,
  IntegrationProvider,
  renderMergeFields,
  renderTeamSignature,
  getDefaultSharedSignatureHtml,
  isWithinWhatsApp24hWindow,
  validateWhatsAppSend,
  MockEmailProvider,
  MockWhatsAppProvider,
  MockSMSProvider,
  verifyWhatsAppWebhookSignature,
  serializeThreadSafe,
  SendEmailSchema,
  SendWhatsAppSchema,
  SendSMSSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  UpdateTeamSignatureSchema,
} from '@hireflow/shared';

export const communicationRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Write Audit Log
  async function logCommAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log communications audit log');
    }
  }

  // Guard: Restrict to Internal Users (Recruiter, Manager, Admin)
  function verifyInternalStaff(user: any) {
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      const err: any = new Error('Access denied: Client and Candidate roles cannot access internal candidate communications');
      err.statusCode = 403;
      throw err;
    }
  }

  // Guard: Restrict to Admin
  function verifyAdmin(user: any) {
    if (!user || user.role !== UserRole.ADMIN) {
      const err: any = new Error('Access denied: Only organization administrators can modify shared corporate signatures');
      err.statusCode = 403;
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // 1. GET /threads — Candidate Communications Inbox
  // -------------------------------------------------------------------------
  server.get('/threads', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const query = request.query as any;
    const channel = query.channel && query.channel !== 'ALL' ? (query.channel as MessageChannel) : undefined;
    const search = query.search ? String(query.search).trim() : undefined;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ThreadWhereInput = {
      isArchived: false,
      ...(channel ? { channel } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              {
                candidate: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, threads, emailUnreadCount, whatsappUnreadCount] = await Promise.all([
      prisma.thread.count({ where: whereClause }),
      prisma.thread.findMany({
        where: whereClause,
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              currentTitle: true,
              currentCompany: true,
              whatsappOptIn: true,
              smsOptIn: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              code: true,
            },
          },
          assignedRecruiter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            select: {
              id: true,
              body: true,
              direction: true,
              deliveryStatus: true,
              sentAt: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.thread.aggregate({
        where: { channel: MessageChannel.EMAIL, isArchived: false },
        _sum: { unreadCount: true },
      }),
      prisma.thread.aggregate({
        where: { channel: MessageChannel.WHATSAPP, isArchived: false },
        _sum: { unreadCount: true },
      }),
    ]);

    const items = threads.map((th) => ({
      ...serializeThreadSafe(th),
      assignedRecruiter: th.assignedRecruiter,
      latestMessage: th.messages[0] || null,
      whatsappOptIn: th.candidate?.whatsappOptIn ?? true,
      smsOptIn: th.candidate?.smsOptIn ?? false,
    }));

    return reply.send({
      success: true,
      data: {
        threads: items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          emailUnread: emailUnreadCount._sum.unreadCount || 0,
          whatsappUnread: whatsappUnreadCount._sum.unreadCount || 0,
          totalThreads: total,
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // 2. GET /threads/:id — Thread Details with Messages
  // -------------------------------------------------------------------------
  server.get('/threads/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const thread = await prisma.thread.findUnique({
      where: { id },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            currentTitle: true,
            currentCompany: true,
            location: true,
            whatsappOptIn: true,
            smsOptIn: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            code: true,
            location: true,
          },
        },
        assignedRecruiter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
          include: {
            template: {
              select: {
                id: true,
                title: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!thread) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Communication thread not found' },
      });
    }

    // Check last inbound message date for WhatsApp 24h window
    let lastInboundAt: Date | null = null;
    if (thread.channel === MessageChannel.WHATSAPP) {
      const lastInbound = thread.messages
        .filter((m) => m.direction === MessageDirection.INBOUND)
        .slice(-1)[0];
      if (lastInbound) {
        lastInboundAt = lastInbound.sentAt;
      }
    }

    const is24hWindowActive = isWithinWhatsApp24hWindow(lastInboundAt);

    return reply.send({
      success: true,
      data: {
        thread: serializeThreadSafe(thread),
        assignedRecruiter: thread.assignedRecruiter,
        candidateDetails: thread.candidate,
        messages: thread.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          channel: m.channel,
          sender: m.sender,
          recipient: m.recipient,
          body: m.body,
          deliveryStatus: m.deliveryStatus,
          errorMessage: m.errorMessage,
          attachments: m.attachments,
          sentAt: m.sentAt.toISOString(),
          providerMessageId: m.providerMessageId,
          isMock: true,
          demoNotice: 'Demo mode — live delivery connects in production OAuth setup',
          template: m.template,
        })),
        whatsAppPolicy: {
          lastInboundAt: lastInboundAt ? lastInboundAt.toISOString() : null,
          isWithin24hWindow: is24hWindowActive,
          optIn: thread.candidate?.whatsappOptIn ?? true,
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // 3. POST /email/send — Send or Draft Candidate Email
  // -------------------------------------------------------------------------
  server.post('/email/send', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parsed = SendEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const { candidateId, jobId, subject, bodyHtml, templateId, attachments, saveAsDraft } = parsed.data;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Candidate not found' },
      });
    }

    // Resolve Shared Team Signature
    const teamSig = await prisma.teamSignature.findFirst({
      where: { isDefault: true },
    });

    const rawSigHtml = teamSig?.signatureHtml || getDefaultSharedSignatureHtml();
    const renderedSig = renderTeamSignature(rawSigHtml, {
      name: user.name || 'Recruitment Team',
      designation: teamSig?.designation || 'Talent Acquisition Partner',
      organizationName: teamSig?.companyName || 'Aureva Capital',
      email: user.email,
      phone: teamSig?.phone || null,
      logoUrl: teamSig?.logoUrl || null,
    });

    // Append signature if not present
    const finalHtml = bodyHtml.includes('Aureva Capital Private Limited')
      ? bodyHtml
      : `${bodyHtml}<br/><br/>${renderedSig}`;

    // Execute send (mock or draft)
    const providerResult = saveAsDraft
      ? { providerMessageId: null, deliveryStatus: MessageDeliveryStatus.DRAFT, isMock: true, label: 'Saved as draft' }
      : MockEmailProvider.sendEmail({
          to: candidate.email,
          subject,
          bodyHtml: finalHtml,
        });

    // Atomic DB write: find/create Thread, insert Message, create CandidateActivity
    const result = await prisma.$transaction(async (tx) => {
      let thread = await tx.thread.findFirst({
        where: {
          candidateId,
          channel: MessageChannel.EMAIL,
          isArchived: false,
        },
      });

      if (!thread) {
        thread = await tx.thread.create({
          data: {
            channel: MessageChannel.EMAIL,
            subject,
            candidateId,
            jobId: jobId || undefined,
            assignedRecruiterId: user.id,
            unreadCount: 0,
            lastMessageAt: new Date(),
            createdById: user.id,
          },
        });
      } else {
        thread = await tx.thread.update({
          where: { id: thread.id },
          data: {
            subject,
            jobId: jobId || thread.jobId,
            lastMessageAt: new Date(),
          },
        });
      }

      const message = await tx.message.create({
        data: {
          threadId: thread.id,
          channel: MessageChannel.EMAIL,
          direction: MessageDirection.OUTBOUND,
          status: saveAsDraft ? 'DRAFT' : 'SENT',
          deliveryStatus: providerResult.deliveryStatus,
          sender: user.email,
          recipient: candidate.email,
          body: finalHtml,
          providerMessageId: providerResult.providerMessageId,
          templateId: templateId || undefined,
          attachments: (attachments as any) || Prisma.JsonNull,
          metadata: {
            isMock: providerResult.isMock,
            label: providerResult.label,
          },
          createdById: user.id,
        },
      });

      if (!saveAsDraft) {
        await tx.candidateActivity.create({
          data: {
            candidateId,
            type: 'EMAIL_SENT',
            channel: MessageChannel.EMAIL,
            direction: MessageDirection.OUTBOUND,
            title: `Email: ${subject}`,
            description: `Sent to ${candidate.email} by ${user.name || user.email}`,
            actorId: user.id,
            metadata: {
              threadId: thread.id,
              messageId: message.id,
              providerMessageId: providerResult.providerMessageId,
            },
          },
        });
      }

      return { thread, message };
    });

    await logCommAudit(user.id, saveAsDraft ? 'DRAFT_EMAIL' : 'SEND_EMAIL', 'message', result.message.id, null, {
      candidateId,
      recipient: candidate.email,
      deliveryStatus: providerResult.deliveryStatus,
    });

    return reply.status(201).send({
      success: true,
      data: {
        message: {
          id: result.message.id,
          threadId: result.thread.id,
          deliveryStatus: result.message.deliveryStatus,
          sentAt: result.message.sentAt.toISOString(),
          providerMessageId: result.message.providerMessageId,
          isMock: true,
          demoNotice: providerResult.label,
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // 4. POST /whatsapp/send — Send Candidate WhatsApp Message
  // -------------------------------------------------------------------------
  server.post('/whatsapp/send', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parsed = SendWhatsAppSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const { candidateId, jobId, messageText, templateId } = parsed.data;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Candidate not found' },
      });
    }

    if (!candidate.phone) {
      return reply.code(400).send({
        success: false,
        error: { code: 'MISSING_PHONE', message: 'Candidate does not have a phone number recorded' },
      });
    }

    // Check last inbound WhatsApp message for 24-hour customer service window
    const lastInboundMsg = await prisma.message.findFirst({
      where: {
        thread: { candidateId, channel: MessageChannel.WHATSAPP },
        direction: MessageDirection.INBOUND,
      },
      orderBy: { sentAt: 'desc' },
    });

    // Check template if templateId passed
    let template: any = null;
    if (templateId) {
      template = await prisma.template.findUnique({ where: { id: templateId } });
    }

    const validation = validateWhatsAppSend({
      optIn: candidate.whatsappOptIn ?? true,
      isTemplate: Boolean(templateId),
      isTemplateApproved: template?.providerApprovalState === ProviderApprovalState.APPROVED,
      lastInboundAt: lastInboundMsg?.sentAt,
    });

    if (!validation.allowed) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'WHATSAPP_POLICY_VIOLATION',
          message: validation.error || 'WhatsApp message cannot be sent due to policy violation',
        },
      });
    }

    // Send via Mock WhatsApp Provider (strictly plain text, NO email corporate signature appended!)
    const providerResult = MockWhatsAppProvider.sendWhatsApp({
      to: candidate.phone,
      messageText,
      templateId: templateId || undefined,
    });

    // Atomic DB write
    const result = await prisma.$transaction(async (tx) => {
      let thread = await tx.thread.findFirst({
        where: {
          candidateId,
          channel: MessageChannel.WHATSAPP,
          isArchived: false,
        },
      });

      if (!thread) {
        thread = await tx.thread.create({
          data: {
            channel: MessageChannel.WHATSAPP,
            subject: 'WhatsApp Conversation',
            candidateId,
            jobId: jobId || undefined,
            assignedRecruiterId: user.id,
            unreadCount: 0,
            lastMessageAt: new Date(),
            createdById: user.id,
          },
        });
      } else {
        thread = await tx.thread.update({
          where: { id: thread.id },
          data: {
            jobId: jobId || thread.jobId,
            lastMessageAt: new Date(),
          },
        });
      }

      const message = await tx.message.create({
        data: {
          threadId: thread.id,
          channel: MessageChannel.WHATSAPP,
          direction: MessageDirection.OUTBOUND,
          status: 'SENT',
          deliveryStatus: MessageDeliveryStatus.SENT,
          sender: 'Aureva ATS WhatsApp',
          recipient: candidate.phone!,
          body: messageText,
          providerMessageId: providerResult.providerMessageId,
          templateId: templateId || undefined,
          metadata: {
            isMock: providerResult.isMock,
            label: providerResult.label,
          },
          createdById: user.id,
        },
      });

      await tx.candidateActivity.create({
        data: {
          candidateId,
          type: 'WHATSAPP_SENT',
          channel: MessageChannel.WHATSAPP,
          direction: MessageDirection.OUTBOUND,
          title: 'WhatsApp Message Sent',
          description: `Sent to ${candidate.phone} by ${user.name || user.email}`,
          actorId: user.id,
          metadata: {
            threadId: thread.id,
            messageId: message.id,
            providerMessageId: providerResult.providerMessageId,
          },
        },
      });

      return { thread, message };
    });

    await logCommAudit(user.id, 'SEND_WHATSAPP', 'message', result.message.id, null, {
      candidateId,
      recipient: candidate.phone,
      providerMessageId: providerResult.providerMessageId,
    });

    return reply.status(201).send({
      success: true,
      data: {
        message: {
          id: result.message.id,
          threadId: result.thread.id,
          deliveryStatus: result.message.deliveryStatus,
          sentAt: result.message.sentAt.toISOString(),
          providerMessageId: result.message.providerMessageId,
          isMock: true,
          demoNotice: providerResult.label,
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // 5. POST /sms/send — Send Candidate SMS
  // -------------------------------------------------------------------------
  server.post('/sms/send', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parsed = SendSMSSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const { candidateId, messageText } = parsed.data;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate || !candidate.phone) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_CANDIDATE', message: 'Candidate or candidate phone number not found' },
      });
    }

    const providerResult = MockSMSProvider.sendSMS({
      to: candidate.phone,
      messageText,
    });

    const result = await prisma.$transaction(async (tx) => {
      let thread = await tx.thread.findFirst({
        where: {
          candidateId,
          channel: MessageChannel.SMS,
          isArchived: false,
        },
      });

      if (!thread) {
        thread = await tx.thread.create({
          data: {
            channel: MessageChannel.SMS,
            subject: 'SMS Alerts',
            candidateId,
            assignedRecruiterId: user.id,
            lastMessageAt: new Date(),
            createdById: user.id,
          },
        });
      }

      const message = await tx.message.create({
        data: {
          threadId: thread.id,
          channel: MessageChannel.SMS,
          direction: MessageDirection.OUTBOUND,
          status: 'SENT',
          deliveryStatus: MessageDeliveryStatus.SENT,
          sender: 'Aureva ATS SMS',
          recipient: candidate.phone!,
          body: messageText,
          providerMessageId: providerResult.providerMessageId,
          metadata: {
            isMock: providerResult.isMock,
            label: providerResult.label,
          },
          createdById: user.id,
        },
      });

      await tx.candidateActivity.create({
        data: {
          candidateId,
          type: 'SMS_SENT',
          channel: MessageChannel.SMS,
          direction: MessageDirection.OUTBOUND,
          title: 'SMS Alert Sent',
          description: `Sent to ${candidate.phone}`,
          actorId: user.id,
        },
      });

      return { thread, message };
    });

    return reply.status(201).send({
      success: true,
      data: {
        message: {
          id: result.message.id,
          threadId: result.thread.id,
          providerMessageId: result.message.providerMessageId,
          isMock: true,
          demoNotice: providerResult.label,
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // 6. PATCH /threads/:id/read — Mark Thread Messages as Read
  // -------------------------------------------------------------------------
  server.patch('/threads/:id/read', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    await prisma.$transaction([
      prisma.thread.update({
        where: { id },
        data: { unreadCount: 0 },
      }),
      prisma.message.updateMany({
        where: {
          threadId: id,
          direction: MessageDirection.INBOUND,
          deliveryStatus: { not: MessageDeliveryStatus.READ },
        },
        data: { deliveryStatus: MessageDeliveryStatus.READ },
      }),
    ]);

    return reply.send({ success: true, message: 'Thread marked as read' });
  });

  // -------------------------------------------------------------------------
  // 7. GET /timeline/:candidateId — Candidate Timeline Activities
  // -------------------------------------------------------------------------
  server.get('/timeline/:candidateId', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { candidateId } = request.params as { candidateId: string };

    const activities = await prisma.candidateActivity.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send({
      success: true,
      data: {
        activities: activities.map((act) => ({
          id: act.id,
          type: act.type,
          channel: act.channel,
          direction: act.direction,
          title: act.title,
          description: act.description,
          metadata: act.metadata,
          createdAt: act.createdAt.toISOString(),
        })),
      },
    });
  });

  // -------------------------------------------------------------------------
  // 8. GET /templates — Template Library
  // -------------------------------------------------------------------------
  server.get('/templates', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const query = request.query as any;
    const channel = query.channel && query.channel !== 'ALL' ? (query.channel as MessageChannel) : undefined;
    const category = query.category && query.category !== 'ALL' ? (query.category as string) : undefined;
    const status = query.status && query.status !== 'ALL' ? (query.status as string) : undefined;

    const templates = await prisma.template.findMany({
      where: {
        ...(channel ? { channel } : {}),
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });

    return reply.send({
      success: true,
      data: {
        templates: templates.map((t) => ({
          id: t.id,
          title: t.title,
          channel: t.channel,
          category: t.category,
          subject: t.subject,
          body: t.body,
          variables: t.variables,
          status: t.status,
          providerApprovalState: t.providerApprovalState,
          providerTemplateId: t.providerTemplateId,
          language: t.language,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  });

  // -------------------------------------------------------------------------
  // 9. POST /templates — Create Template
  // -------------------------------------------------------------------------
  server.post('/templates', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parsed = CreateTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const { title, channel, category, subject, body, providerTemplateId, language } = parsed.data;

    // Detect variables in body and subject
    const combined = `${subject || ''} ${body}`;
    const matches = combined.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g) || [];
    const variables = Array.from(
      new Set(matches.map((m) => m.replace(/[\{\}\s]/g, '').toLowerCase()))
    );

    const template = await prisma.template.create({
      data: {
        title,
        channel,
        category,
        subject: channel === MessageChannel.EMAIL ? subject : null,
        body,
        variables,
        status: TemplateStatus.PUBLISHED,
        providerApprovalState:
          channel === MessageChannel.WHATSAPP ? ProviderApprovalState.APPROVED : ProviderApprovalState.DRAFT,
        providerTemplateId: providerTemplateId || null,
        language,
        createdById: user.id,
      },
    });

    await logCommAudit(user.id, 'CREATE_TEMPLATE', 'template', template.id, null, {
      title,
      channel,
      category,
    });

    return reply.status(201).send({
      success: true,
      data: { template },
    });
  });

  // -------------------------------------------------------------------------
  // 10. PATCH /templates/:id — Update Template
  // -------------------------------------------------------------------------
  server.patch('/templates/:id', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };

    const parsed = UpdateTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const existing = await prisma.template.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
    }

    const updated = await prisma.template.update({
      where: { id },
      data: parsed.data,
    });

    await logCommAudit(user.id, 'UPDATE_TEMPLATE', 'template', id, existing, updated);

    return reply.send({
      success: true,
      data: { template: updated },
    });
  });

  // -------------------------------------------------------------------------
  // 11. POST /templates/:id/preview — Test Merge-Field Rendering
  // -------------------------------------------------------------------------
  server.post('/templates/:id/preview', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};

    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
    }

    let candidateContext: any = {
      first_name: 'Aditya',
      client: 'Barclays Global Tech',
      round: 'Technical Architecture Round',
      date: 'Thursday, 12 Nov 2026',
      time: '03:30 PM IST',
      meeting_link: 'https://meet.google.com/hfw-demo-live',
      recruiter_name: user.name || 'Pooja Verma',
    };

    if (body.candidateId) {
      const candidate = await prisma.candidate.findUnique({ where: { id: body.candidateId } });
      if (candidate) {
        candidateContext.first_name = candidate.name.split(' ')[0];
      }
    }

    const context = { ...candidateContext, ...(body.customContext || {}) };

    const renderedSubject = template.subject
      ? renderMergeFields(template.subject, context, false)
      : null;
    const renderedBody = renderMergeFields(template.body, context, template.channel === MessageChannel.EMAIL);

    return reply.send({
      success: true,
      data: {
        renderedSubject: renderedSubject?.rendered || null,
        renderedBody: renderedBody.rendered,
        missingFields: [
          ...(renderedSubject?.missingFields || []),
          ...renderedBody.missingFields,
        ],
        hasWarnings: (renderedSubject?.hasWarnings || false) || renderedBody.hasWarnings,
      },
    });
  });

  // -------------------------------------------------------------------------
  // 12. GET /signature — Shared Corporate Team Signature
  // -------------------------------------------------------------------------
  server.get('/signature', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const sig = await prisma.teamSignature.findFirst({
      where: { isDefault: true },
    });

    const signatureHtml = sig?.signatureHtml || getDefaultSharedSignatureHtml();
    const previewRendered = renderTeamSignature(signatureHtml, {
      name: user.name || 'Sample Recruiter',
      designation: sig?.designation || 'Lead Talent Partner',
      organizationName: sig?.companyName || 'Aureva Capital',
      email: user.email,
      phone: sig?.phone || '+91 98765 43210',
      logoUrl: sig?.logoUrl || null,
    });

    return reply.send({
      success: true,
      data: {
        signatureHtml,
        designation: sig?.designation || 'Talent Acquisition Partner',
        companyName: sig?.companyName || 'Aureva Capital',
        phone: sig?.phone || null,
        logoUrl: sig?.logoUrl || null,
        previewRendered,
        canEdit: user.role === UserRole.ADMIN,
      },
    });
  });

  // -------------------------------------------------------------------------
  // 13. PUT /signature — Admin-Only Signature Editor
  // -------------------------------------------------------------------------
  server.put('/signature', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyAdmin(user);

    const parsed = UpdateTeamSignatureSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message, details: parsed.error.issues },
      });
    }

    const { signatureHtml, designation, companyName, phone, logoUrl } = parsed.data;

    const existing = await prisma.teamSignature.findFirst({
      where: { isDefault: true },
    });

    let updated;
    if (existing) {
      updated = await prisma.teamSignature.update({
        where: { id: existing.id },
        data: {
          signatureHtml,
          designation,
          companyName,
          phone,
          logoUrl,
        },
      });
    } else {
      updated = await prisma.teamSignature.create({
        data: {
          userId: user.id,
          signatureHtml,
          designation,
          companyName,
          phone,
          logoUrl,
          isDefault: true,
          createdById: user.id,
        },
      });
    }

    await logCommAudit(user.id, 'UPDATE_TEAM_SIGNATURE', 'teamSignature', updated.id, existing, updated);

    return reply.send({
      success: true,
      data: {
        signature: updated,
      },
    });
  });

  // -------------------------------------------------------------------------
  // 14. GET /integrations — Integration Settings & Connection Status
  // -------------------------------------------------------------------------
  server.get('/integrations', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const integrations = [
      {
        provider: IntegrationProvider.GMAIL,
        name: 'Google Workspace / Gmail',
        description: 'Send and sync recruiter emails directly via Google Workspace OAuth 2.0.',
        connectionState: ConnectionState.DEMO_MODE,
        statusBadge: 'Demo mode',
        statusColor: 'purple',
        email: user.email,
        lastRefreshedAt: new Date().toISOString(),
        requiredScopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly',
        ],
        reviewPermissions: [
          'Send emails on your behalf to candidates and clients',
          'Sync incoming candidate email replies into ATS communication threads',
          'Store encrypted OAuth tokens in Supabase using AES-256-GCM',
        ],
      },
      {
        provider: IntegrationProvider.OUTLOOK,
        name: 'Microsoft 365 / Outlook',
        description: 'Connect corporate Outlook mailboxes via Microsoft Graph API.',
        connectionState: ConnectionState.DEMO_MODE,
        statusBadge: 'Demo mode',
        statusColor: 'purple',
        email: null,
        lastRefreshedAt: null,
        requiredScopes: ['Mail.Send', 'Mail.ReadWrite', 'offline_access'],
        reviewPermissions: [
          'Send candidate interview invites through corporate Microsoft 365 mailbox',
          'Sync calendar availability and candidate correspondence',
        ],
      },
      {
        provider: IntegrationProvider.WHATSAPP,
        name: 'Meta WhatsApp Business Cloud API',
        description: 'Enterprise WhatsApp candidate messaging with Meta-approved templates.',
        connectionState: ConnectionState.READY,
        statusBadge: 'Ready',
        statusColor: 'green',
        accountIdentifier: '+91 80 4123 4567 (Aureva Verified)',
        lastRefreshedAt: new Date().toISOString(),
        requiredScopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
        reviewPermissions: [
          'Send template notifications outside 24-hour window',
          'Two-way conversational messaging within 24-hour candidate reply window',
          'Candidate opt-in enforcement and compliance reporting',
        ],
      },
      {
        provider: IntegrationProvider.SMS,
        name: 'SMS Gateway (India DLT & Twilio)',
        description: 'Critical candidate interview alerts and one-time reminders.',
        connectionState: ConnectionState.SETUP_REQUIRED,
        statusBadge: 'Setup required',
        statusColor: 'amber',
        accountIdentifier: 'DLT Entity ID Pending',
        lastRefreshedAt: null,
        requiredScopes: ['sms.outbound'],
        reviewPermissions: [
          'India TRAI DLT approved template SMS dispatch',
          'International fallback via Twilio Programmable SMS',
        ],
      },
    ];

    return reply.send({
      success: true,
      data: {
        integrations,
      },
    });
  });

  // -------------------------------------------------------------------------
  // 15. POST /webhooks/whatsapp — Meta WhatsApp Cloud API Webhook
  // -------------------------------------------------------------------------
  server.post('/webhooks/whatsapp', async (request, reply) => {
    const rawBody = JSON.stringify(request.body || {});
    const sigHeader = (request.headers['x-hub-signature-256'] as string) || '';
    const secret = process.env.WHATSAPP_APP_SECRET || 'dev_whatsapp_secret';

    // Verify HMAC if header provided
    if (sigHeader && !verifyWhatsAppWebhookSignature(rawBody, sigHeader, secret)) {
      return reply.code(401).send({ error: 'Invalid webhook signature' });
    }

    const payload = (request.body as any) || {};

    // Process delivery status updates idempotently
    if (payload.statuses && Array.isArray(payload.statuses)) {
      for (const item of payload.statuses) {
        const providerMessageId = item.id;
        const status = item.status?.toUpperCase();

        let mappedStatus: MessageDeliveryStatus | null = null;
        if (status === 'SENT') mappedStatus = MessageDeliveryStatus.SENT;
        else if (status === 'DELIVERED') mappedStatus = MessageDeliveryStatus.DELIVERED;
        else if (status === 'READ') mappedStatus = MessageDeliveryStatus.READ;
        else if (status === 'FAILED') mappedStatus = MessageDeliveryStatus.FAILED;

        if (mappedStatus && providerMessageId) {
          await prisma.message.updateMany({
            where: { providerMessageId },
            data: {
              deliveryStatus: mappedStatus,
              errorMessage: item.errors ? JSON.stringify(item.errors) : undefined,
            },
          });
        }
      }
    }

    return reply.send({ status: 'success', received: true });
  });

  // -------------------------------------------------------------------------
  // 16. POST /webhooks/sms — SMS Delivery Webhook
  // -------------------------------------------------------------------------
  server.post('/webhooks/sms', async (request, reply) => {
    const payload = (request.body as any) || {};
    const { MessageSid, MessageStatus } = payload;

    if (MessageSid && MessageStatus) {
      let mapped = MessageDeliveryStatus.SENT;
      if (MessageStatus === 'delivered') mapped = MessageDeliveryStatus.DELIVERED;
      else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') mapped = MessageDeliveryStatus.FAILED;

      await prisma.message.updateMany({
        where: { providerMessageId: MessageSid },
        data: { deliveryStatus: mapped },
      });
    }

    return reply.send({ status: 'success' });
  });
};
