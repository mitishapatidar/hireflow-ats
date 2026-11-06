'use server';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-useless-escape, prefer-const */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
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
  serializeThreadSafe,
  SendEmailSchema,
  SendWhatsAppSchema,
  SendSMSSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  UpdateTeamSignatureSchema,
} from '@hireflow/shared';

function canAccessCommunications(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.RECRUITER;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Get Communications Inbox (Threads + Stats)
// ─────────────────────────────────────────────────────────────────────────────
export async function getCommunicationsInboxAction(
  channel?: string,
  search?: string,
  page: number = 1,
  limit: number = 20
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized: Internal team access only' };
    }

    const activeChannel = channel && channel !== 'ALL' ? (channel as MessageChannel) : undefined;
    const skip = (Math.max(1, page) - 1) * limit;

    const whereClause: Prisma.ThreadWhereInput = {
      isArchived: false,
      ...(activeChannel ? { channel: activeChannel } : {}),
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
      latestMessage: th.messages[0]
        ? {
            ...th.messages[0],
            sentAt: th.messages[0].sentAt.toISOString(),
          }
        : null,
      whatsappOptIn: th.candidate?.whatsappOptIn ?? true,
      smsOptIn: th.candidate?.smsOptIn ?? false,
    }));

    return {
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
    };
  } catch (error: any) {
    console.error('getCommunicationsInboxAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch inbox' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get Thread Details & Messages
// ─────────────────────────────────────────────────────────────────────────────
export async function getThreadDetailsAction(threadId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
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
      return { success: false, error: 'Thread not found' };
    }

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

    return {
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
    };
  } catch (error: any) {
    console.error('getThreadDetailsAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch thread' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Send or Draft Email
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmailAction(rawData: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = SendEmailSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { candidateId, jobId, subject, bodyHtml, templateId, attachments, saveAsDraft } = parsed.data;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
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

    const finalHtml = bodyHtml.includes('Aureva Capital Private Limited')
      ? bodyHtml
      : `${bodyHtml}<br/><br/>${renderedSig}`;

    const providerResult = saveAsDraft
      ? { providerMessageId: null, deliveryStatus: MessageDeliveryStatus.DRAFT, isMock: true, label: 'Saved as draft' }
      : MockEmailProvider.sendEmail({
          to: candidate.email,
          subject,
          bodyHtml: finalHtml,
        });

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

    revalidatePath('/communications');
    return {
      success: true,
      data: {
        messageId: result.message.id,
        threadId: result.thread.id,
        deliveryStatus: result.message.deliveryStatus,
      },
    };
  } catch (error: any) {
    console.error('sendEmailAction error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Send WhatsApp Message
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWhatsAppAction(rawData: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = SendWhatsAppSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { candidateId, jobId, messageText, templateId } = parsed.data;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate || !candidate.phone) {
      return { success: false, error: 'Candidate phone number not found' };
    }

    const lastInboundMsg = await prisma.message.findFirst({
      where: {
        thread: { candidateId, channel: MessageChannel.WHATSAPP },
        direction: MessageDirection.INBOUND,
      },
      orderBy: { sentAt: 'desc' },
    });

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
      return { success: false, error: validation.error };
    }

    const providerResult = MockWhatsAppProvider.sendWhatsApp({
      to: candidate.phone,
      messageText,
      templateId: templateId || undefined,
    });

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

    revalidatePath('/communications');
    return {
      success: true,
      data: {
        messageId: result.message.id,
        threadId: result.thread.id,
        providerMessageId: result.message.providerMessageId,
      },
    };
  } catch (error: any) {
    console.error('sendWhatsAppAction error:', error);
    return { success: false, error: error.message || 'Failed to send WhatsApp message' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Send SMS
// ─────────────────────────────────────────────────────────────────────────────
export async function sendSMSAction(rawData: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = SendSMSSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { candidateId, messageText } = parsed.data;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate || !candidate.phone) {
      return { success: false, error: 'Candidate phone number not found' };
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

    revalidatePath('/communications');
    return {
      success: true,
      data: {
        messageId: result.message.id,
        threadId: result.thread.id,
      },
    };
  } catch (error: any) {
    console.error('sendSMSAction error:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Mark Thread Read
// ─────────────────────────────────────────────────────────────────────────────
export async function markThreadReadAction(threadId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.$transaction([
      prisma.thread.update({
        where: { id: threadId },
        data: { unreadCount: 0 },
      }),
      prisma.message.updateMany({
        where: {
          threadId,
          direction: MessageDirection.INBOUND,
          deliveryStatus: { not: MessageDeliveryStatus.READ },
        },
        data: { deliveryStatus: MessageDeliveryStatus.READ },
      }),
    ]);

    revalidatePath('/communications');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Get Candidate Timeline Activities
// ─────────────────────────────────────────────────────────────────────────────
export async function getCandidateTimelineAction(candidateId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const activities = await prisma.candidateActivity.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      success: true,
      data: activities.map((act) => ({
        id: act.id,
        type: act.type,
        channel: act.channel,
        direction: act.direction,
        title: act.title,
        description: act.description,
        metadata: act.metadata,
        createdAt: act.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Template Library Actions
// ─────────────────────────────────────────────────────────────────────────────
export async function getTemplatesAction(channel?: string, category?: string, status?: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const activeChannel = channel && channel !== 'ALL' ? (channel as MessageChannel) : undefined;
    const templates = await prisma.template.findMany({
      where: {
        ...(activeChannel ? { channel: activeChannel } : {}),
        ...(category && category !== 'ALL' ? { category } : {}),
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });

    return {
      success: true,
      data: templates.map((t) => ({
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
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createTemplateAction(rawData: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = CreateTemplateSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { title, channel, category, subject, body, providerTemplateId, language } = parsed.data;

    const combined = `${subject || ''} ${body}`;
    const matches = combined.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g) || [];
    const variables = Array.from(
      new Set(matches.map((m) => m.replace(/[{}]/g, '').trim().toLowerCase()))
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

    revalidatePath('/communications/templates');
    return { success: true, data: template };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateTemplateAction(id: string, rawData: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = UpdateTemplateSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const updated = await prisma.template.update({
      where: { id },
      data: parsed.data,
    });

    revalidatePath('/communications/templates');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function previewTemplateAction(templateId: string, candidateId?: string, customContext?: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const candidateContext: any = {
      first_name: 'Aditya',
      client: 'Barclays Global Tech',
      round: 'Technical Architecture Round',
      date: 'Thursday, 12 Nov 2026',
      time: '03:30 PM IST',
      meeting_link: 'https://meet.google.com/hfw-demo-live',
      recruiter_name: user.name || 'Pooja Verma',
    };

    if (candidateId) {
      const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
      if (candidate) {
        candidateContext.first_name = candidate.name.split(' ')[0];
      }
    }

    const context = { ...candidateContext, ...(customContext || {}) };

    const renderedSubject = template.subject
      ? renderMergeFields(template.subject, context, false)
      : null;
    const renderedBody = renderMergeFields(template.body, context, template.channel === MessageChannel.EMAIL);

    return {
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
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Corporate Team Signature Actions
// ─────────────────────────────────────────────────────────────────────────────
export async function getTeamSignatureAction() {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

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

    return {
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
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateTeamSignatureAction(rawData: any) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.ADMIN) {
      return { success: false, error: 'Forbidden: Only organization administrators can modify the corporate signature' };
    }

    const parsed = UpdateTeamSignatureSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
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

    revalidatePath('/communications/templates');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Integrations Status Action
// ─────────────────────────────────────────────────────────────────────────────
export async function getIntegrationsAction() {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessCommunications(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

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

    return {
      success: true,
      data: {
        integrations,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
