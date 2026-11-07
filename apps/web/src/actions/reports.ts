'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  ReportQuerySchema,
  ReportQueryInput,
  SaveReportViewSchema,
  SaveReportViewInput,
  CreateClientReportScheduleSchema,
  CreateClientReportScheduleInput,
  REPORT_COLUMN_CATALOG,
  ALLOWED_LINKED_ENTITIES,
  SUPPORTED_GROUP_BY_DIMENSIONS,
  validateReportColumns,
  ReportEntityType,
  generateReportExport,
} from '@hireflow/shared';

// ==========================================
// 1. CUSTOM REPORT BUILDER ACTIONS (FRAME 37)
// ==========================================

export async function getReportBuilderConfig() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  return {
    catalog: REPORT_COLUMN_CATALOG,
    linkedEntities: ALLOWED_LINKED_ENTITIES,
    supportedGroupBy: SUPPORTED_GROUP_BY_DIMENSIONS,
    userRole: user.role,
    canAccessSensitive: user.role === UserRole.ADMIN,
  };
}

export async function previewCustomReport(input: ReportQueryInput) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  if (user.role === UserRole.CANDIDATE || user.role === UserRole.CLIENT) {
    throw new Error('Access Denied: Internal reporting is restricted to internal recruitment team roles.');
  }

  const parseRes = ReportQuerySchema.safeParse(input);
  if (!parseRes.success) {
    throw new Error(parseRes.error.errors[0]?.message || 'Invalid report configuration');
  }

  const query = parseRes.data;

  // Validate columns
  const colVal = validateReportColumns(query.primaryEntity as ReportEntityType, query.selectedColumns, user.role);
  if (!colVal.valid) {
    throw new Error(colVal.error || 'Invalid column requested');
  }

  // Execute query via bounded queries
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (query.filters?.period) {
    const now = new Date();
    if (query.filters.period === 'LAST_7_DAYS') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateFilter.gte = d;
    } else if (query.filters.period === 'LAST_30_DAYS') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateFilter.gte = d;
    }
  }

  const limit = Math.min(query.limit || 5, 100);
  let rows: Record<string, any>[] = [];
  let totalCount = 0;

  switch (query.primaryEntity) {
    case 'CANDIDATES': {
      const where: any = {
        organizationId: user.organizationId,
        isArchived: false,
        ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
      };
      if (query.filters?.recruiterId) {
        where.ownerId = query.filters.recruiterId;
      }
      totalCount = await prisma.candidate.count({ where });
      const candidates = await prisma.candidate.findMany({
        where,
        take: limit,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: { owner: { select: { name: true } } },
      });
      rows = candidates.map((c) => ({
        code: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        currentTitle: c.currentTitle || '',
        currentCompany: c.currentCompany || '',
        experienceYears: c.experienceYears != null ? Number(c.experienceYears) : '',
        location: c.location || '',
        status: c.isArchived ? 'ARCHIVED' : 'ACTIVE',
        createdAt: c.createdAt.toISOString().split('T')[0],
        ownerName: c.owner?.name || 'Unassigned',
        currentSalary: user.role === UserRole.ADMIN && c.currentSalary != null ? Number(c.currentSalary) : undefined,
        expectedSalary: user.role === UserRole.ADMIN && c.expectedSalary != null ? Number(c.expectedSalary) : undefined,
      }));
      break;
    }

    case 'JOBS': {
      const where: any = {
        organizationId: user.organizationId,
        isArchived: false,
        ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
      };
      if (query.filters?.clientId) where.clientId = query.filters.clientId;
      if (query.filters?.recruiterId) where.ownerId = query.filters.recruiterId;
      if (query.filters?.status && query.filters.status !== 'ALL') where.status = query.filters.status as any;

      totalCount = await prisma.job.count({ where });
      const jobs = await prisma.job.findMany({
        where,
        take: limit,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: { client: { select: { legalName: true } }, owner: { select: { name: true } } },
      });
      rows = jobs.map((j) => ({
        code: j.code,
        title: j.title,
        clientName: j.client.legalName,
        employmentType: j.employmentType,
        openings: j.openings,
        location: j.location || '',
        status: j.status,
        ownerName: j.owner?.name || 'Unassigned',
        createdAt: j.createdAt.toISOString().split('T')[0],
        salaryMin: user.role === UserRole.ADMIN && j.salaryMin != null ? Number(j.salaryMin) : undefined,
        salaryMax: user.role === UserRole.ADMIN && j.salaryMax != null ? Number(j.salaryMax) : undefined,
      }));
      break;
    }

    case 'APPLICATIONS': {
      const where: any = {
        job: { organizationId: user.organizationId },
        ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
      };
      if (query.filters?.clientId) where.job = { clientId: query.filters.clientId, organizationId: user.organizationId };

      totalCount = await prisma.application.count({ where });
      const apps = await prisma.application.findMany({
        where,
        take: limit,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: {
          candidate: { select: { name: true, email: true } },
          job: { select: { title: true, code: true, client: { select: { legalName: true } } } },
          stage: { select: { name: true } },
        },
      });
      rows = apps.map((a) => ({
        candidateName: a.candidate.name,
        candidateEmail: a.candidate.email,
        jobTitle: a.job.title,
        jobCode: a.job.code,
        clientName: a.job.client.legalName,
        stageName: a.stage?.name || 'Applied',
        status: a.status,
        createdAt: a.createdAt.toISOString().split('T')[0],
      }));
      break;
    }

    case 'INTERVIEWS': {
      const where: any = {
        application: { job: { organizationId: user.organizationId } },
        ...(dateFilter.gte ? { scheduledAt: dateFilter } : {}),
      };
      totalCount = await prisma.interview.count({ where });
      const interviews = await prisma.interview.findMany({
        where,
        take: limit,
        orderBy: { scheduledAt: query.sortDirection || 'desc' },
        include: {
          application: { include: { candidate: { select: { name: true } }, job: { select: { title: true } } } },
          round: { select: { name: true } },
          panelMembers: { include: { user: { select: { name: true } } } },
        },
      });
      rows = interviews.map((i) => ({
        candidateName: i.application.candidate.name,
        jobTitle: i.application.job.title,
        roundName: i.round?.name || 'General Evaluation',
        scheduledAt: i.scheduledAt.toISOString().replace('T', ' ').substring(0, 16),
        meetingType: i.mode,
        status: i.outcome,
        interviewerName: i.panelMembers[0]?.user.name || 'Unassigned',
      }));
      break;
    }

    case 'SUBMISSIONS': {
      const where: any = {
        application: { job: { organizationId: user.organizationId } },
        ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
      };
      if (query.filters?.clientId) {
        where.application.job.clientId = query.filters.clientId;
      }
      totalCount = await prisma.submission.count({ where });
      const submissions = await prisma.submission.findMany({
        where,
        take: limit,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: {
          application: {
            include: {
              candidate: { select: { name: true } },
              job: { select: { title: true, client: { select: { legalName: true } } } },
            },
          },
        },
      });
      rows = submissions.map((s) => ({
        candidateName: s.application.candidate.name,
        jobTitle: s.application.job.title,
        clientName: s.application.job.client.legalName,
        status: s.clientDecision || s.approvalStatus,
        submittedAt: s.sentAt ? s.sentAt.toISOString().split('T')[0] : s.createdAt.toISOString().split('T')[0],
      }));
      break;
    }

    case 'CLIENTS': {
      const where: any = {
        organizationId: user.organizationId,
        isArchived: false,
        ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
      };
      totalCount = await prisma.client.count({ where });
      const clients = await prisma.client.findMany({
        where,
        take: limit,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: { relationshipOwner: { select: { name: true } } },
      });
      rows = clients.map((cl) => ({
        code: cl.code,
        legalName: cl.legalName,
        industry: cl.industry || 'General',
        location: cl.location || 'India',
        status: cl.status,
        ownerName: cl.relationshipOwner?.name || 'Unassigned',
        createdAt: cl.createdAt.toISOString().split('T')[0],
      }));
      break;
    }

    case 'PLACEMENTS': {
      const where: any = {
        client: { organizationId: user.organizationId },
        ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
      };
      totalCount = await prisma.placement.count({ where });
      const placements = await prisma.placement.findMany({
        where,
        take: limit,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: {
          client: { select: { legalName: true } },
          application: { include: { candidate: { select: { name: true } }, job: { select: { title: true } } } },
        },
      });
      rows = placements.map((p) => ({
        candidateName: p.application.candidate.name,
        jobTitle: p.application.job.title,
        clientName: p.client.legalName,
        joiningDate: p.dueDate ? p.dueDate.toISOString().split('T')[0] : 'Pending',
        status: p.paymentStatus,
        createdAt: p.createdAt.toISOString().split('T')[0],
      }));
      break;
    }
  }

  // Filter columns
  const filteredRows = rows.map((r) => {
    const out: Record<string, any> = {};
    colVal.safeColumns.forEach((col) => {
      out[col] = r[col] ?? '';
    });
    return out;
  });

  return {
    rows: filteredRows,
    totalCount,
    asOf: new Date().toISOString(),
    columns: colVal.safeColumns,
  };
}

export async function saveReportViewAction(input: SaveReportViewInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const parsed = SaveReportViewSchema.parse(input);

  const report = await prisma.reportDefinition.create({
    data: {
      organizationId: user.organizationId,
      ownerId: user.id,
      name: parsed.name,
      description: parsed.description,
      primaryEntity: parsed.primaryEntity,
      linkedEntities: parsed.linkedEntities,
      selectedColumns: parsed.selectedColumns,
      groupBy: parsed.groupBy,
      sortBy: parsed.sortBy,
      sortDirection: parsed.sortDirection,
      filters: parsed.filters,
      isShared: parsed.isShared,
      shares: parsed.isShared && parsed.sharedWithUserIds.length > 0
        ? {
            create: parsed.sharedWithUserIds.map((uid) => ({
              sharedWithUserId: uid,
            })),
          }
        : undefined,
    },
  });

  revalidatePath('/reports/builder');
  return { success: true, data: report };
}

export async function getSavedReportsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const reports = await prisma.reportDefinition.findMany({
    where: {
      organizationId: user.organizationId,
      isArchived: false,
      OR: [
        { ownerId: user.id },
        { isShared: true },
        { shares: { some: { sharedWithUserId: user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, role: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    success: true,
    data: reports.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      primaryEntity: r.primaryEntity,
      selectedColumns: r.selectedColumns,
      isShared: r.isShared,
      isOwner: r.ownerId === user.id,
      ownerName: r.owner.name,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function archiveSavedReportAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const report = await prisma.reportDefinition.findFirst({
    where: { id, organizationId: user.organizationId, ownerId: user.id },
  });

  if (!report) throw new Error('Report not found or not owned by you');

  await prisma.reportDefinition.update({
    where: { id },
    data: { isArchived: true },
  });

  revalidatePath('/reports/builder');
  return { success: true };
}

export async function exportCustomReportAction(query: ReportQueryInput, format: 'CSV' | 'XLSX') {
  const preview = await previewCustomReport({ ...query, limit: 10000 });
  const catalog = REPORT_COLUMN_CATALOG[query.primaryEntity as ReportEntityType];
  const catalogMap = new Map(catalog.map((c) => [c.key, c.label]));

  const headers = preview.columns.map((col) => ({
    key: col,
    label: catalogMap.get(col) || col,
  }));

  const exportResult = generateReportExport(format, headers, preview.rows, 'HireFlow Custom Report');
  return exportResult;
}

// ==========================================
// 2. SCHEDULED CLIENT REPORTS ACTIONS (FRAME 38)
// ==========================================

export async function getClientSchedulesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new Error('Access Denied: Scheduled client reports are restricted to Managers and Admins.');
  }

  const schedules = await prisma.clientReportSchedule.findMany({
    where: { organizationId: user.organizationId, isArchived: false },
    include: {
      client: { select: { id: true, legalName: true, code: true, status: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allRecipientIds = Array.from(new Set(schedules.flatMap((s) => s.recipientIds)));
  const contacts = await prisma.clientContact.findMany({
    where: { id: { in: allRecipientIds } },
    select: { id: true, name: true, email: true },
  });
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return schedules.map((s) => ({
    id: s.id,
    name: s.name,
    client: s.client,
    frequency: s.frequency,
    deliveryDay: s.deliveryDay,
    deliveryTime: s.deliveryTime,
    timezone: s.timezone,
    period: s.period,
    status: s.status,
    version: s.version,
    lastDeliveredAt: s.lastDeliveredAt ? s.lastDeliveredAt.toISOString() : null,
    nextDeliveryAt: s.nextDeliveryAt ? s.nextDeliveryAt.toISOString() : null,
    recipients: s.recipientIds.map((id) => contactMap.get(id)).filter(Boolean),
    includeSections: s.includeSections,
    creatorName: s.creator.name,
  }));
}

export async function createClientScheduleAction(input: CreateClientReportScheduleInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new Error('Forbidden');
  }

  const parsed = CreateClientReportScheduleSchema.parse(input);

  const client = await prisma.client.findFirst({
    where: { id: parsed.clientId, organizationId: user.organizationId, isArchived: false },
  });
  if (!client) throw new Error('Client not found');

  const verified = await prisma.clientContact.findMany({
    where: { id: { in: parsed.recipientIds }, clientId: parsed.clientId },
  });
  if (verified.length === 0) throw new Error('No valid verified client contacts');

  const schedule = await prisma.clientReportSchedule.create({
    data: {
      organizationId: user.organizationId,
      clientId: parsed.clientId,
      creatorId: user.id,
      name: parsed.name,
      frequency: parsed.frequency,
      deliveryDay: parsed.deliveryDay,
      deliveryTime: parsed.deliveryTime,
      timezone: parsed.timezone || 'Asia/Kolkata',
      period: parsed.period,
      recipientIds: verified.map((c) => c.id),
      includeSections: parsed.includeSections,
      status: 'DRAFT',
      version: 1,
    },
  });

  await prisma.clientReportScheduleVersion.create({
    data: {
      scheduleId: schedule.id,
      version: 1,
      snapshot: schedule as any,
      changedById: user.id,
      changeNotes: 'Initial draft schedule created.',
    },
  });

  revalidatePath('/reports/client-schedules');
  return { success: true, data: schedule };
}

export async function toggleClientScheduleStatusAction(id: string, action: 'activate' | 'pause') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new Error('Forbidden');
  }

  const status = action === 'activate' ? 'ACTIVE' : 'PAUSED';
  const updated = await prisma.clientReportSchedule.update({
    where: { id },
    data: { status },
  });

  revalidatePath('/reports/client-schedules');
  return { success: true, data: updated };
}

export async function getClientScheduleHistoryAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const history = await prisma.clientReportDelivery.findMany({
    where: { scheduleId: id, organizationId: user.organizationId },
    orderBy: { executedAt: 'desc' },
    take: 30,
  });

  return history.map((h) => ({
    id: h.id,
    scheduledFor: h.scheduledFor.toISOString(),
    executedAt: h.executedAt.toISOString(),
    recipientCount: h.recipientCount,
    successCount: h.successCount,
    failedCount: h.failedCount,
    status: h.status,
    failureReason: h.failureReason,
    scheduleVersion: h.scheduleVersion,
  }));
}
