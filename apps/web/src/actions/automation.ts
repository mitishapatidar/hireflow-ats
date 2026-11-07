'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  CreateAutomationRuleSchema,
  CreateAutomationRuleInput,
  UpdateAutomationRuleSchema,
  UpdateAutomationRuleInput,
  AutomationPreviewSchema,
  AutomationPreviewInput,
  replaceMergeFields,
  STANDARD_AUTOMATION_RULE_PRESETS,
} from '@hireflow/shared';

async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) {
    throw new Error('Forbidden: Automation rules configuration is restricted to system Administrators.');
  }
  return user;
}

export async function getAutomationRulesAction() {
  await requireAdminUser();

  let rules = await prisma.automationRule.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: 'desc' },
  });

  // Seed standard presets if empty
  if (rules.length === 0) {
    for (const preset of STANDARD_AUTOMATION_RULE_PRESETS) {
      await prisma.automationRule.create({
        data: {
          name: preset.name,
          description: preset.description,
          triggerEvent: preset.triggerEvent,
          timing: preset.timing as any,
          conditions: preset.conditions as any,
          actions: {},
          recipients: preset.recipients as any,
          channels: preset.channels as any,
          templateSubject: preset.templateSubject,
          templateBody: preset.templateBody,
          status: preset.status,
          isActive: preset.status === 'ACTIVE',
        },
      });
    }

    rules = await prisma.automationRule.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  return { success: true, rules };
}

export async function createAutomationRuleAction(data: CreateAutomationRuleInput) {
  const user = await requireAdminUser();
  const validated = CreateAutomationRuleSchema.parse(data);

  const rule = await prisma.automationRule.create({
    data: {
      name: validated.name,
      description: validated.description,
      triggerEvent: validated.triggerEvent,
      timing: validated.timing as any,
      conditions: validated.conditions as any,
      actions: {},
      clientScope: validated.clientScope,
      recipients: validated.recipients as any,
      channels: validated.channels as any,
      templateId: validated.templateId,
      templateSubject: validated.templateSubject,
      templateBody: validated.templateBody,
      status: validated.status,
      isActive: validated.status === 'ACTIVE',
      createdById: user.id,
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'AUTOMATION_RULE_CREATED',
        entity: 'AUTOMATION_RULE',
        entityId: rule.id,
        after: { name: rule.name, triggerEvent: rule.triggerEvent },
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath('/admin/automation');
  return { success: true, rule };
}

export async function updateAutomationRuleAction(id: string, data: UpdateAutomationRuleInput) {
  const user = await requireAdminUser();
  const validated = UpdateAutomationRuleSchema.parse(data);

  const existing = await prisma.automationRule.findUnique({ where: { id } });
  if (!existing || existing.isArchived) {
    return { success: false, error: 'Automation rule not found' };
  }

  const updated = await prisma.automationRule.update({
    where: { id },
    data: {
      name: validated.name,
      description: validated.description,
      triggerEvent: validated.triggerEvent,
      timing: validated.timing as any,
      conditions: validated.conditions as any,
      clientScope: validated.clientScope,
      recipients: validated.recipients as any,
      channels: validated.channels as any,
      templateId: validated.templateId,
      templateSubject: validated.templateSubject,
      templateBody: validated.templateBody,
      status: validated.status,
      isActive: validated.status ? validated.status === 'ACTIVE' : undefined,
      version: { increment: 1 },
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'AUTOMATION_RULE_UPDATED',
        entity: 'AUTOMATION_RULE',
        entityId: id,
        after: { version: updated.version, name: updated.name },
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath('/admin/automation');
  return { success: true, rule: updated };
}

export async function activateAutomationRuleAction(id: string) {
  const user = await requireAdminUser();

  const updated = await prisma.automationRule.update({
    where: { id },
    data: { status: 'ACTIVE', isActive: true },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'AUTOMATION_RULE_ACTIVATED',
        entity: 'AUTOMATION_RULE',
        entityId: id,
        after: { status: 'ACTIVE' },
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath('/admin/automation');
  return { success: true, rule: updated };
}

export async function pauseAutomationRuleAction(id: string) {
  const user = await requireAdminUser();

  const updated = await prisma.automationRule.update({
    where: { id },
    data: { status: 'PAUSED', isActive: false },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'AUTOMATION_RULE_PAUSED',
        entity: 'AUTOMATION_RULE',
        entityId: id,
        after: { status: 'PAUSED' },
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath('/admin/automation');
  return { success: true, rule: updated };
}

export async function previewAutomationTemplateAction(data: AutomationPreviewInput) {
  await requireAdminUser();
  const validated = AutomationPreviewSchema.parse(data);

  const bodyResult = replaceMergeFields(validated.templateBody, validated.context, validated.isCandidateFacing);
  const subjectResult = validated.templateSubject
    ? replaceMergeFields(validated.templateSubject, validated.context, validated.isCandidateFacing)
    : { text: '', missingFields: [], sanitized: false };

  return {
    success: true,
    renderedSubject: subjectResult.text,
    renderedBody: bodyResult.text,
    missingFields: Array.from(new Set([...bodyResult.missingFields, ...subjectResult.missingFields])),
    sanitized: bodyResult.sanitized || subjectResult.sanitized,
  };
}

export async function getAutomationExecutionsAction(limit = 20, offset = 0) {
  await requireAdminUser();

  const [items, totalCount] = await Promise.all([
    prisma.automationExecution.findMany({
      include: {
        rule: { select: { id: true, name: true, triggerEvent: true } },
      },
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.automationExecution.count(),
  ]);

  return { success: true, items, totalCount };
}
