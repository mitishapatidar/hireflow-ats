'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  EXPORT_ENTITY_CATALOG,
  FORBIDDEN_EXPORT_FIELDS,
  generateCsvString,
  redactAuditSecrets,
  getKolkataDayBounds,
  DEFAULT_DAILY_DOWNLOAD_LIMITS,
  CreateCustomFieldDefinitionSchema,
  CreateCustomFieldDefinitionInput,
  UpdateCustomFieldDefinitionSchema,
  UpdateCustomFieldDefinitionInput,
  SetClientCustomFieldRuleSchema,
  SetClientCustomFieldRuleInput,
  CreateExportRequestSchema,
  CreateExportRequestInput,
  RestoreArchivedCandidateSchema,
  UpdateDownloadPolicySchema,
  UpdateDownloadPolicyInput,
  ExportEntityType,
} from '@hireflow/shared';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Helper: Ensure user is Admin
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) {
    throw new Error('Forbidden: Data Governance is restricted to system Administrators.');
  }
  return user;
}

// Helper: Log Governance Audit
async function logGovernanceAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  before?: Record<string, any> | null,
  after?: Record<string, any> | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        before: before ? (redactAuditSecrets(before) as any) : undefined,
        after: after ? (redactAuditSecrets(after) as any) : undefined,
        ipAddress: '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write governance audit log:', err);
  }
}

// Ensure export folder exists
async function getExportDir(): Promise<string> {
  const dir = path.resolve(process.cwd(), '.storage', 'exports');
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  return dir;
}

// =========================================================================
// 1. SCOPED EXPORT ACTIONS (TAB 1)
// =========================================================================

export async function getExportConfigAction() {
  const user = await requireAdmin();
  return {
    success: true,
    data: {
      entities: EXPORT_ENTITY_CATALOG,
      userRole: user.role,
      canExportSensitive: true,
    },
  };
}

// Helper: Fetch entity export rows
async function fetchExportRows(
  orgId: string,
  entityType: ExportEntityType,
  filters?: any,
  limit?: number
): Promise<Record<string, any>[]> {
  switch (entityType) {
    case 'CANDIDATES': {
      const candidates = await prisma.candidate.findMany({
        where: {
          organizationId: orgId,
          isArchived: false,
        },
        include: {
          owner: { select: { name: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return candidates.map((c) => ({
        code: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        currentTitle: c.currentTitle || '',
        currentCompany: c.currentCompany || '',
        experienceYears: c.experienceYears != null ? String(c.experienceYears) : '',
        location: c.location || '',
        skills: c.skills.join('; '),
        noticePeriod: c.noticePeriod || '',
        status: c.isArchived ? 'ARCHIVED' : 'ACTIVE',
        ownerName: c.owner?.name || 'Unassigned',
        createdAt: c.createdAt.toISOString().split('T')[0],
        currentSalary: c.currentSalary != null ? String(c.currentSalary) : '',
        expectedSalary: c.expectedSalary != null ? String(c.expectedSalary) : '',
      }));
    }

    case 'JOBS': {
      const jobs = await prisma.job.findMany({
        where: {
          organizationId: orgId,
          ...(filters?.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
          ...(filters?.clientId ? { clientId: filters.clientId } : {}),
        },
        include: {
          client: { select: { legalName: true } },
          owner: { select: { name: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return jobs.map((j) => ({
        code: j.code,
        title: j.title,
        clientName: j.client.legalName,
        employmentType: j.employmentType,
        openings: String(j.openings),
        location: j.location || '',
        status: j.status,
        ownerName: j.owner?.name || 'Unassigned',
        createdAt: j.createdAt.toISOString().split('T')[0],
        salaryMin: j.salaryMin != null ? String(j.salaryMin) : '',
        salaryMax: j.salaryMax != null ? String(j.salaryMax) : '',
      }));
    }

    case 'CLIENTS': {
      const clients = await prisma.client.findMany({
        where: {
          organizationId: orgId,
          isArchived: false,
          ...(filters?.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
        },
        include: {
          relationshipOwner: { select: { name: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return clients.map((cl) => ({
        code: cl.code,
        legalName: cl.legalName,
        industry: cl.industry || '',
        website: cl.website || '',
        location: cl.location || '',
        status: cl.status,
        relationshipOwnerName: cl.relationshipOwner?.name || 'Unassigned',
        createdAt: cl.createdAt.toISOString().split('T')[0],
      }));
    }

    case 'APPLICATIONS': {
      const apps = await prisma.application.findMany({
        where: {
          job: { organizationId: orgId },
          ...(filters?.jobId ? { jobId: filters.jobId } : {}),
          ...(filters?.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
        },
        include: {
          candidate: { select: { code: true, name: true } },
          job: { select: { code: true, title: true, client: { select: { legalName: true } } } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return apps.map((a) => ({
        id: a.id,
        candidateCode: a.candidate.code,
        candidateName: a.candidate.name,
        jobCode: a.job.code,
        jobTitle: a.job.title,
        clientName: a.job.client.legalName,
        status: a.status,
        appliedAt: a.createdAt.toISOString().split('T')[0],
      }));
    }

    case 'SUBMISSIONS': {
      const subs = await prisma.submission.findMany({
        where: {
          application: { job: { organizationId: orgId } },
          ...(filters?.jobId ? { application: { jobId: filters.jobId } } : {}),
        },
        include: {
          application: {
            include: {
              candidate: { select: { name: true } },
              job: { select: { title: true, client: { select: { legalName: true } } } },
            },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return subs.map((s) => ({
        code: s.code,
        candidateName: s.application.candidate.name,
        jobTitle: s.application.job.title,
        clientName: s.application.job.client.legalName,
        approvalStatus: s.approvalStatus,
        version: String(s.version),
        submittedByName: s.createdById || 'Recruiter',
        createdAt: s.createdAt.toISOString().split('T')[0],
      }));
    }

    case 'INTERVIEWS': {
      const interviews = await prisma.interview.findMany({
        where: {
          application: { job: { organizationId: orgId } },
        },
        include: {
          application: {
            include: {
              candidate: { select: { name: true } },
              job: { select: { title: true } },
            },
          },
          round: { select: { name: true } },
        },
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      });

      return interviews.map((i) => ({
        id: i.id,
        candidateName: i.application.candidate.name,
        jobTitle: i.application.job.title,
        roundName: i.round?.name || 'Interview',
        scheduledAt: i.scheduledAt.toISOString(),
        durationMinutes: String(i.duration),
        mode: i.mode,
        status: i.outcome,
      }));
    }

    case 'PLACEMENTS': {
      const placements = await prisma.placement.findMany({
        where: {
          application: { job: { organizationId: orgId } },
        },
        include: {
          application: {
            include: {
              candidate: { select: { name: true } },
              job: { select: { title: true, owner: { select: { name: true } } } },
            },
          },
          client: { select: { legalName: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return placements.map((p) => ({
        id: p.id,
        candidateName: p.application.candidate.name,
        jobTitle: p.application.job.title,
        clientName: p.client.legalName,
        recruiterName: p.application.job.owner?.name || 'Unassigned',
        placementDate: p.createdAt.toISOString().split('T')[0],
        offeredSalary: p.feeAmount != null ? String(p.feeAmount) : '',
      }));
    }

    case 'AUDIT_LOGS': {
      const orgUsers = await prisma.user.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, role: true },
      });
      const userMap = new Map(orgUsers.map((u) => [u.id, u]));
      const userIds = orgUsers.map((u) => u.id);

      const logs = await prisma.auditLog.findMany({
        where: { actorId: { in: userIds } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return logs.map((l) => {
        const actor = userMap.get(l.actorId);
        return {
          createdAt: l.createdAt.toISOString(),
          actorName: actor?.name || 'System',
          actorRole: actor?.role || 'SYSTEM',
          action: l.action,
          entity: l.entity,
          entityId: l.entityId,
          ipAddress: l.ipAddress || '',
        };
      });
    }

    default:
      return [];
  }
}

export async function previewExportAction(input: CreateExportRequestInput) {
  const user = await requireAdmin();
  const parsed = CreateExportRequestSchema.parse(input);

  const safeColumns = parsed.selectedColumns.filter((col) => !FORBIDDEN_EXPORT_FIELDS.has(col));
  const catalog = EXPORT_ENTITY_CATALOG[parsed.entityType];
  const columnDefs = catalog.columns.filter((c) => safeColumns.includes(c.key));

  const rows = await fetchExportRows(user.organizationId, parsed.entityType, parsed.filters, 10);

  return {
    success: true,
    data: {
      entityType: parsed.entityType,
      columns: columnDefs,
      previewRows: rows,
    },
  };
}

export async function generateExportAction(input: CreateExportRequestInput) {
  const user = await requireAdmin();
  const parsed = CreateExportRequestSchema.parse(input);

  // Check sensitive columns & re-verification
  const catalog = EXPORT_ENTITY_CATALOG[parsed.entityType];
  const sensitiveKeys = new Set(catalog.columns.filter((c) => c.isSensitive).map((c) => c.key));
  const requestedSensitive = parsed.selectedColumns.some((col) => sensitiveKeys.has(col));

  if (requestedSensitive && user.lastReverifiedAt) {
    const lastReverified = new Date(user.lastReverifiedAt).getTime();
    if (Date.now() - lastReverified > 15 * 60 * 1000) {
      throw new Error(
        'REVERIFICATION_REQUIRED: Sensitive export requires recent re-verification within 15 minutes.'
      );
    }
  }

  const safeColumns = parsed.selectedColumns.filter((col) => !FORBIDDEN_EXPORT_FIELDS.has(col));
  const activeColumnDefs = catalog.columns.filter((c) => safeColumns.includes(c.key));

  const rows = await fetchExportRows(user.organizationId, parsed.entityType, parsed.filters);
  const csvString = generateCsvString(activeColumnDefs, rows);

  const exportDir = await getExportDir();
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  const fileKey = `export_${parsed.entityType.toLowerCase()}_${timestamp}_${crypto.randomBytes(4).toString('hex')}.csv`;
  const filePath = path.join(exportDir, fileKey);
  await fs.writeFile(filePath, csvString, 'utf-8');

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const record = await prisma.exportRequest.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      entityType: parsed.entityType,
      format: parsed.format,
      selectedColumns: safeColumns,
      filters: parsed.filters ? (parsed.filters as any) : undefined,
      status: 'READY',
      fileKey,
      fileName: `hireflow_${parsed.entityType.toLowerCase()}_${timestamp}.csv`,
      fileSize: Buffer.byteLength(csvString, 'utf-8'),
      rowCount: rows.length,
      expiresAt,
    },
  });

  await logGovernanceAudit(
    user.id,
    'DATA_EXPORT_GENERATED',
    'export_request',
    record.id,
    null,
    { entityType: parsed.entityType, rowCount: rows.length }
  );

  return {
    success: true,
    data: {
      exportId: record.id,
      fileName: record.fileName,
      rowCount: record.rowCount,
      downloadUrl: `/api/governance/exports/${record.id}/download`,
    },
  };
}

// =========================================================================
// 2. CUSTOM FIELDS ACTIONS (TAB 2)
// =========================================================================

export async function getCustomFieldsAction(entityType?: string) {
  const user = await requireAdmin();

  const fields = await prisma.customFieldDefinition.findMany({
    where: {
      organizationId: user.organizationId,
      ...(entityType && entityType !== 'ALL' ? { entityType } : {}),
    },
    include: {
      clientRules: {
        include: {
          client: { select: { id: true, legalName: true } },
        },
      },
      _count: {
        select: { values: true },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return {
    success: true,
    data: fields.map((f) => ({
      ...f,
      usageCount: f._count.values,
    })),
  };
}

export async function createCustomFieldAction(input: CreateCustomFieldDefinitionInput) {
  const user = await requireAdmin();
  const parsed = CreateCustomFieldDefinitionSchema.parse(input);

  const existing = await prisma.customFieldDefinition.findFirst({
    where: {
      organizationId: user.organizationId,
      entityType: parsed.entityType,
      OR: [{ fieldName: parsed.fieldName }, { fieldKey: parsed.fieldKey }],
    },
  });

  if (existing) {
    throw new Error(
      `A custom field with name '${parsed.fieldName}' or key '${parsed.fieldKey}' already exists for ${parsed.entityType}.`
    );
  }

  const created = await prisma.customFieldDefinition.create({
    data: {
      organizationId: user.organizationId,
      entityType: parsed.entityType,
      fieldName: parsed.fieldName,
      fieldKey: parsed.fieldKey,
      fieldType: parsed.fieldType,
      description: parsed.description,
      options: parsed.options,
      isRequired: parsed.isRequired,
      visibility: parsed.visibility,
      validationRules: parsed.validationRules ? (parsed.validationRules as any) : undefined,
      defaultValue: parsed.defaultValue ? (parsed.defaultValue as any) : undefined,
      displayOrder: parsed.displayOrder,
      createdById: user.id,
      version: 1,
      isActive: true,
    },
  });

  await logGovernanceAudit(
    user.id,
    'CUSTOM_FIELD_CREATED',
    'custom_field_definition',
    created.id,
    null,
    created as any
  );

  revalidatePath('/admin/data-governance');
  return { success: true, data: created };
}

export async function updateCustomFieldAction(id: string, input: UpdateCustomFieldDefinitionInput) {
  const user = await requireAdmin();
  const parsed = UpdateCustomFieldDefinitionSchema.parse(input);

  const existing = await prisma.customFieldDefinition.findUnique({
    where: { id },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error('Custom field definition not found or unauthorized.');
  }

  const updated = await prisma.customFieldDefinition.update({
    where: { id },
    data: {
      ...(parsed.fieldName ? { fieldName: parsed.fieldName } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.options ? { options: parsed.options } : {}),
      ...(parsed.isRequired !== undefined ? { isRequired: parsed.isRequired } : {}),
      ...(parsed.visibility ? { visibility: parsed.visibility } : {}),
      ...(parsed.validationRules ? { validationRules: parsed.validationRules as any } : {}),
      ...(parsed.defaultValue !== undefined ? { defaultValue: parsed.defaultValue as any } : {}),
      ...(parsed.displayOrder !== undefined ? { displayOrder: parsed.displayOrder } : {}),
      ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      version: { increment: 1 },
      updatedById: user.id,
    },
  });

  await logGovernanceAudit(
    user.id,
    'CUSTOM_FIELD_UPDATED',
    'custom_field_definition',
    updated.id,
    existing as any,
    updated as any
  );

  revalidatePath('/admin/data-governance');
  return { success: true, data: updated };
}

export async function archiveCustomFieldAction(id: string) {
  const user = await requireAdmin();

  const existing = await prisma.customFieldDefinition.findUnique({
    where: { id },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error('Custom field definition not found or unauthorized.');
  }

  const archived = await prisma.customFieldDefinition.update({
    where: { id },
    data: {
      isActive: false,
      updatedById: user.id,
    },
  });

  await logGovernanceAudit(
    user.id,
    'CUSTOM_FIELD_ARCHIVED',
    'custom_field_definition',
    id,
    { isActive: true },
    { isActive: false }
  );

  revalidatePath('/admin/data-governance');
  return { success: true, data: archived };
}

export async function setClientCustomFieldRuleAction(input: SetClientCustomFieldRuleInput) {
  const user = await requireAdmin();
  const parsed = SetClientCustomFieldRuleSchema.parse(input);

  const [client, fieldDef] = await Promise.all([
    prisma.client.findUnique({ where: { id: parsed.clientId } }),
    prisma.customFieldDefinition.findUnique({ where: { id: parsed.fieldDefinitionId } }),
  ]);

  if (!client || client.organizationId !== user.organizationId) {
    throw new Error('Client company not found or cross-tenant.');
  }

  if (!fieldDef || fieldDef.organizationId !== user.organizationId) {
    throw new Error('Custom field definition not found or cross-tenant.');
  }

  const rule = await prisma.clientCustomFieldRule.upsert({
    where: {
      clientId_fieldDefinitionId: {
        clientId: parsed.clientId,
        fieldDefinitionId: parsed.fieldDefinitionId,
      },
    },
    update: {
      isRequired: parsed.isRequired,
      workflowVersion: parsed.workflowVersion,
    },
    create: {
      clientId: parsed.clientId,
      fieldDefinitionId: parsed.fieldDefinitionId,
      isRequired: parsed.isRequired,
      workflowVersion: parsed.workflowVersion,
    },
  });

  await logGovernanceAudit(
    user.id,
    'CLIENT_CUSTOM_FIELD_RULE_SET',
    'client_custom_field_rule',
    rule.id,
    null,
    rule as any
  );

  revalidatePath('/admin/data-governance');
  return { success: true, data: rule };
}

// =========================================================================
// 3. ARCHIVE & RESTORE ACTIONS (TAB 3)
// =========================================================================

export async function getArchivedCandidatesAction() {
  const user = await requireAdmin();

  const archivedCandidates = await prisma.candidate.findMany({
    where: {
      organizationId: user.organizationId,
      isArchived: true,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      applications: {
        select: { id: true, status: true, job: { select: { title: true } } },
      },
    },
    orderBy: { archivedAt: 'desc' },
  });

  // Check conflicts
  const emails = archivedCandidates.map((c) => c.email.toLowerCase());
  const activeCandidates = await prisma.candidate.findMany({
    where: {
      organizationId: user.organizationId,
      isArchived: false,
      email: { in: emails },
    },
    select: { id: true, email: true, code: true, name: true },
  });

  const conflictEmailMap = new Map(activeCandidates.map((c) => [c.email.toLowerCase(), c]));

  const items = archivedCandidates.map((c) => {
    const conflict = conflictEmailMap.get(c.email.toLowerCase());
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      email: c.email,
      phone: c.phone,
      currentTitle: c.currentTitle,
      archivedAt: c.archivedAt?.toISOString() || c.updatedAt.toISOString(),
      archiveReason: c.archiveReason || 'Standard archive retention policy',
      owner: c.owner,
      applicationCount: c.applications.length,
      hasConflict: !!conflict,
      conflictDetails: conflict
        ? `Active candidate ${conflict.code} (${conflict.name}) already uses this email.`
        : null,
    };
  });

  return { success: true, data: items };
}

export async function restoreArchivedCandidateAction(candidateId: string, reason: string) {
  const user = await requireAdmin();
  const parsed = RestoreArchivedCandidateSchema.parse({ reason });

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidate || candidate.organizationId !== user.organizationId) {
    throw new Error('Candidate record not found or cross-tenant.');
  }

  if (!candidate.isArchived) {
    throw new Error('Candidate is already active.');
  }

  const activeDuplicate = await prisma.candidate.findFirst({
    where: {
      organizationId: user.organizationId,
      isArchived: false,
      email: candidate.email.toLowerCase(),
      id: { not: candidate.id },
    },
  });

  if (activeDuplicate) {
    throw new Error(
      `Cannot restore candidate: An active candidate (${activeDuplicate.code} - ${activeDuplicate.name}) already exists with email ${candidate.email}.`
    );
  }

  const restored = await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      isArchived: false,
      archivedAt: null,
      archiveReason: null,
    },
  });

  await logGovernanceAudit(
    user.id,
    'CANDIDATE_RESTORED',
    'candidate',
    candidate.id,
    { isArchived: true, archiveReason: candidate.archiveReason },
    { isArchived: false, restoreReason: parsed.reason, restoredBy: user.id }
  );

  revalidatePath('/admin/data-governance');
  return { success: true, data: restored };
}

// =========================================================================
// 4. DOWNLOAD POLICY ACTIONS (TAB 4)
// =========================================================================

export async function getDownloadPoliciesAction() {
  const user = await requireAdmin();
  const { startUtc, endUtc } = getKolkataDayBounds();

  const existingPolicies = await prisma.downloadPolicy.findMany({
    where: { organizationId: user.organizationId },
  });
  const policyMap = new Map(existingPolicies.map((p) => [p.role, p]));
  const roles = [UserRole.RECRUITER, UserRole.MANAGER, UserRole.CLIENT, UserRole.ADMIN];

  const todayLogs = await prisma.downloadLog.findMany({
    where: {
      organizationId: user.organizationId,
      resourceType: 'CV',
      result: 'SUCCESS',
      createdAt: { gte: startUtc, lte: endUtc },
    },
    select: { userId: true },
  });

  const userIds = [...new Set(todayLogs.map((l) => l.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true },
  });
  const roleMap = new Map(users.map((u) => [u.id, u.role]));

  const roleUsageCounts: Record<string, number> = {
    RECRUITER: 0,
    MANAGER: 0,
    CLIENT: 0,
    ADMIN: 0,
  };

  for (const log of todayLogs) {
    const r = roleMap.get(log.userId);
    if (r && roleUsageCounts[r] !== undefined) {
      roleUsageCounts[r]++;
    }
  }

  const cards = roles.map((role) => {
    const policy = policyMap.get(role);
    const limit = policy?.dailyCvLimit ?? DEFAULT_DAILY_DOWNLOAD_LIMITS[role] ?? 50;
    const used = roleUsageCounts[role] || 0;
    const remaining = Math.max(0, limit - used);

    return {
      role,
      dailyCvLimit: limit,
      requireWatermark: policy?.requireWatermark ?? true,
      watermarkPattern: policy?.watermarkPattern ?? 'HIREFLOW / {{CLIENT_NAME}} / {{DATE}}',
      allowOriginalDownload: policy?.allowOriginalDownload ?? false,
      isActive: policy?.isActive ?? true,
      usedToday: used,
      remainingToday: remaining,
      isExceeded: used >= limit,
      resetAtUtc: endUtc.toISOString(),
    };
  });

  return {
    success: true,
    data: {
      policies: cards,
      timezone: 'Asia/Kolkata',
      dayStartUtc: startUtc.toISOString(),
      dayEndUtc: endUtc.toISOString(),
    },
  };
}

export async function updateDownloadPolicyAction(input: UpdateDownloadPolicyInput) {
  const user = await requireAdmin();
  const parsed = UpdateDownloadPolicySchema.parse(input);

  const existing = await prisma.downloadPolicy.findUnique({
    where: {
      organizationId_role: {
        organizationId: user.organizationId,
        role: parsed.role,
      },
    },
  });

  const updated = await prisma.downloadPolicy.upsert({
    where: {
      organizationId_role: {
        organizationId: user.organizationId,
        role: parsed.role,
      },
    },
    update: {
      dailyCvLimit: parsed.dailyCvLimit,
      requireWatermark: parsed.requireWatermark,
      allowOriginalDownload: parsed.allowOriginalDownload,
      isActive: parsed.isActive,
      updatedById: user.id,
    },
    create: {
      organizationId: user.organizationId,
      role: parsed.role,
      dailyCvLimit: parsed.dailyCvLimit,
      requireWatermark: parsed.requireWatermark,
      allowOriginalDownload: parsed.allowOriginalDownload,
      isActive: parsed.isActive,
      updatedById: user.id,
    },
  });

  await logGovernanceAudit(
    user.id,
    'DOWNLOAD_POLICY_UPDATED',
    'download_policy',
    updated.id,
    existing as any,
    updated as any
  );

  revalidatePath('/admin/data-governance');
  return { success: true, data: updated };
}

// =========================================================================
// 5. AUDIT TRAIL ACTIONS (TAB 5)
// =========================================================================

export async function getAuditLogsAction(query?: {
  actorId?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const user = await requireAdmin();

  const page = Math.max(1, query?.page || 1);
  const limit = Math.min(100, Math.max(1, query?.limit || 25));
  const skip = (page - 1) * limit;

  const orgUsers = await prisma.user.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true, email: true, role: true },
  });
  const userMap = new Map(orgUsers.map((u) => [u.id, u]));
  const orgUserIds = orgUsers.map((u) => u.id);

  const where: Prisma.AuditLogWhereInput = {
    actorId: query?.actorId ? query.actorId : { in: orgUserIds },
    ...(query?.action ? { action: query.action } : {}),
    ...(query?.entity ? { entity: query.entity } : {}),
  };

  if (query?.startDate || query?.endDate) {
    where.createdAt = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const sanitizedLogs = logs.map((l) => {
    const actor = userMap.get(l.actorId) || {
      id: l.actorId,
      name: 'System',
      email: '',
      role: 'SYSTEM',
    };
    return {
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      actor,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      ipAddress: l.ipAddress,
      before: l.before ? redactAuditSecrets(l.before as Record<string, any>) : null,
      after: l.after ? redactAuditSecrets(l.after as Record<string, any>) : null,
    };
  });

  return {
    success: true,
    data: sanitizedLogs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function exportAuditLogsCsvAction() {
  const user = await requireAdmin();

  const orgUsers = await prisma.user.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true, role: true },
  });
  const userMap = new Map(orgUsers.map((u) => [u.id, u]));
  const orgUserIds = orgUsers.map((u) => u.id);

  const logs = await prisma.auditLog.findMany({
    where: { actorId: { in: orgUserIds } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  const catalog = EXPORT_ENTITY_CATALOG.AUDIT_LOGS;
  const rows = logs.map((l) => {
    const actor = userMap.get(l.actorId);
    return {
      createdAt: l.createdAt.toISOString(),
      actorName: actor?.name || 'System',
      actorRole: actor?.role || 'SYSTEM',
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      ipAddress: l.ipAddress || '',
    };
  });

  const csvString = generateCsvString(catalog.columns, rows);

  await logGovernanceAudit(
    user.id,
    'AUDIT_LOGS_EXPORTED',
    'audit_log',
    user.organizationId,
    null,
    { rowCount: rows.length }
  );

  return {
    success: true,
    csvContent: csvString,
    fileName: `hireflow_audit_trail_${new Date().toISOString().split('T')[0]}.csv`,
  };
}
