'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@hireflow/db';
import { requireRole } from '@/lib/auth';
import { UserRole, UpdateSecurityPolicySchema } from '@hireflow/shared';

export interface SecurityPolicyActionResult {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  requiresReverification?: boolean;
}

export async function getSecurityPolicyAction() {
  const admin = await requireRole(UserRole.ADMIN);

  let policy = await prisma.securityPolicy.findUnique({
    where: { organizationId: admin.organizationId },
  });

  if (!policy) {
    policy = await prisma.securityPolicy.create({
      data: {
        organizationId: admin.organizationId,
        allowedAuthMethods: ['EMAIL_PASSWORD', 'GOOGLE'],
        allowedEmailDomains: ['hireflow.io', 'aurevacapital.com'],
        requireTwoStepVerification: true,
        otpDeliveryMethod: 'EMAIL',
        otpExpirySeconds: 300,
        otpResendCooldownSeconds: 30,
        otpMaxAttempts: 3,
        maxConcurrentSessions: 2,
        inactivityTimeoutMinutes: 30,
        warningBeforeExpiryMinutes: 5,
        sensitiveActionReverificationMinutes: 15,
      },
    });
  }

  // Also query recent audit logs for security policies
  const auditLogsRaw = await prisma.auditLog.findMany({
    where: {
      entity: 'SecurityPolicy',
      entityId: policy.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const actorIds = Array.from(new Set(auditLogsRaw.map((l) => l.actorId).filter(Boolean)));
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const auditLogs = auditLogsRaw.map((log) => ({
    ...log,
    actor: actorMap.get(log.actorId) || { id: log.actorId, name: 'System', email: 'system@hireflow.io' },
  }));

  // Query active sessions for the admin
  const activeSessions = await prisma.session.findMany({
    where: {
      userId: admin.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivityAt: 'desc' },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      createdAt: true,
      lastActivityAt: true,
    },
  });

  return {
    policy,
    auditLogs,
    activeSessions,
  };
}

export async function updateSecurityPolicyAction(
  prevState: SecurityPolicyActionResult | null,
  formData: FormData
): Promise<SecurityPolicyActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  // Check recent re-verification: required within sensitiveActionReverificationMinutes
  const currentSession = await prisma.session.findFirst({
    where: {
      userId: admin.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  const lastReverified = currentSession?.lastReverifiedAt ? new Date(currentSession.lastReverifiedAt).getTime() : 0;
  const reverifyWindowMs = 15 * 60 * 1000;

  if (Date.now() - lastReverified > reverifyWindowMs) {
    return {
      success: false,
      error: 'Recent password verification required before modifying security policies.',
      requiresReverification: true,
    };
  }

  const rawData: Record<string, unknown> = {
    allowedAuthMethods: formData.getAll('allowedAuthMethods') as string[],
    allowedEmailDomains: (formData.get('allowedEmailDomains') as string)
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    requireTwoStepVerification: formData.get('requireTwoStepVerification') === 'on',
    otpDeliveryMethod: formData.get('otpDeliveryMethod') || 'EMAIL',
    otpExpirySeconds: Number(formData.get('otpExpirySeconds') || 300),
    otpResendCooldownSeconds: Number(formData.get('otpResendCooldownSeconds') || 30),
    otpMaxAttempts: Number(formData.get('otpMaxAttempts') || 3),
    maxConcurrentSessions: Number(formData.get('maxConcurrentSessions') || 2),
    inactivityTimeoutMinutes: Number(formData.get('inactivityTimeoutMinutes') || 30),
    warningBeforeExpiryMinutes: Number(formData.get('warningBeforeExpiryMinutes') || 5),
    sensitiveActionReverificationMinutes: Number(formData.get('sensitiveActionReverificationMinutes') || 15),
    changeReason: (formData.get('changeReason') as string) || '',
  };

  const parseResult = UpdateSecurityPolicySchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please verify the security policy form inputs.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const data = parseResult.data;
  const currentPolicy = await prisma.securityPolicy.findUnique({
    where: { organizationId: admin.organizationId },
  });

  const updated = await prisma.securityPolicy.upsert({
    where: { organizationId: admin.organizationId },
    update: {
      allowedAuthMethods: data.allowedAuthMethods,
      allowedEmailDomains: data.allowedEmailDomains,
      requireTwoStepVerification: data.requireTwoStepVerification,
      otpDeliveryMethod: data.otpDeliveryMethod,
      otpExpirySeconds: data.otpExpirySeconds,
      otpResendCooldownSeconds: data.otpResendCooldownSeconds,
      otpMaxAttempts: data.otpMaxAttempts,
      maxConcurrentSessions: data.maxConcurrentSessions,
      inactivityTimeoutMinutes: data.inactivityTimeoutMinutes,
      warningBeforeExpiryMinutes: data.warningBeforeExpiryMinutes,
      sensitiveActionReverificationMinutes: data.sensitiveActionReverificationMinutes,
      updatedById: admin.id,
    },
    create: {
      organizationId: admin.organizationId,
      allowedAuthMethods: data.allowedAuthMethods,
      allowedEmailDomains: data.allowedEmailDomains,
      requireTwoStepVerification: data.requireTwoStepVerification,
      otpDeliveryMethod: data.otpDeliveryMethod,
      otpExpirySeconds: data.otpExpirySeconds,
      otpResendCooldownSeconds: data.otpResendCooldownSeconds,
      otpMaxAttempts: data.otpMaxAttempts,
      maxConcurrentSessions: data.maxConcurrentSessions,
      inactivityTimeoutMinutes: data.inactivityTimeoutMinutes,
      warningBeforeExpiryMinutes: data.warningBeforeExpiryMinutes,
      sensitiveActionReverificationMinutes: data.sensitiveActionReverificationMinutes,
      updatedById: admin.id,
    },
  });

  // Log Security Audit Event
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'SECURITY_POLICY_UPDATED',
      entity: 'SecurityPolicy',
      entityId: updated.id,
      before: currentPolicy ? JSON.parse(JSON.stringify(currentPolicy)) : null,
      after: JSON.parse(JSON.stringify({
        ...updated,
        changeReason: data.changeReason,
      })),
      ipAddress: '127.0.0.1',
    },
  });

  revalidatePath('/admin/security');

  return {
    success: true,
    message: 'Security policies updated successfully and applied across workspace.',
  };
}
