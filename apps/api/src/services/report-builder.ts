/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import {
  ReportEntityType,
  ReportQueryInput,
  validateReportColumns,
  UserRole,
  ClientReportDataBundle,
  ClientSafeJobProgress,
  ClientSafeSubmissionProfile,
  ClientSafeNextStep,
} from '@hireflow/shared';

export interface ExecuteReportContext {
  organizationId: string;
  user: {
    id: string;
    role: UserRole;
    teamId?: string | null;
  };
  query: ReportQueryInput;
}

export interface ReportQueryResult {
  rows: Record<string, any>[];
  totalCount: number;
  asOf: string;
  columns: string[];
  groups?: Array<{ group: string; count: number }>;
}

/**
 * Calculates start and end Date bounds from standard period tokens.
 */
function parseDateRange(period?: string, startDate?: string, endDate?: string): { gte?: Date; lte?: Date } {
  const now = new Date();
  if (startDate || endDate) {
    return {
      gte: startDate ? new Date(startDate) : undefined,
      lte: endDate ? new Date(endDate) : undefined,
    };
  }

  if (!period) return {};

  switch (period) {
    case 'LAST_7_DAYS': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { gte: d };
    }
    case 'LAST_30_DAYS': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { gte: d };
    }
    case 'THIS_MONTH': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { gte: d };
    }
    case 'LAST_MONTH': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { gte: start, lte: end };
    }
    default:
      return {};
  }
}

/**
 * Executes a scoped report query enforcing strict role-based and entity boundaries.
 */
export async function executeReportQuery(ctx: ExecuteReportContext): Promise<ReportQueryResult> {
  const { organizationId, user, query } = ctx;

  if (user.role === UserRole.CANDIDATE) {
    throw new Error('Access Denied: Candidate users are not permitted to access reporting infrastructure.');
  }

  // 1. Column Catalog and Zero-Leak Validation
  const colVal = validateReportColumns(query.primaryEntity as ReportEntityType, query.selectedColumns, user.role);
  if (!colVal.valid) {
    throw new Error(colVal.error || 'Invalid columns requested');
  }
  const safeColumns = colVal.safeColumns;

  // 2. Determine Subordinate/Team Scoping for Managers
  let subordinateIds: string[] | null = null;
  if (user.role === UserRole.MANAGER) {
    const subs = await prisma.user.findMany({
      where: {
        organizationId,
        OR: [{ managerId: user.id }, { id: user.id }, ...(user.teamId ? [{ teamId: user.teamId }] : [])],
      },
      select: { id: true },
    });
    subordinateIds = subs.map((s) => s.id);
  }

  const dateFilter = parseDateRange(query.filters?.period, query.filters?.startDate, query.filters?.endDate);
  const limit = Math.min(query.limit || 5, 10000);
  const skip = ((query.page || 1) - 1) * limit;

  let rows: Record<string, any>[] = [];
  let totalCount = 0;

  // 3. Entity-specific queries
  switch (query.primaryEntity) {
    case 'CANDIDATES': {
      const where: any = {
        organizationId,
        isArchived: false,
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      };

      if (user.role === UserRole.RECRUITER) {
        where.OR = [{ ownerId: user.id }, { ownerId: null }];
      } else if (user.role === UserRole.MANAGER && subordinateIds) {
        where.ownerId = { in: subordinateIds };
      }

      if (query.filters?.recruiterId) {
        where.ownerId = query.filters.recruiterId;
      }

      totalCount = await prisma.candidate.count({ where });
      const candidates = await prisma.candidate.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: {
          owner: { select: { name: true } },
        },
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
        organizationId,
        isArchived: false,
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      };

      if (user.role === UserRole.RECRUITER) {
        where.ownerId = user.id;
      } else if (user.role === UserRole.MANAGER && subordinateIds) {
        where.ownerId = { in: subordinateIds };
      }

      if (query.filters?.clientId) {
        where.clientId = query.filters.clientId;
      }
      if (query.filters?.recruiterId) {
        where.ownerId = query.filters.recruiterId;
      }
      if (query.filters?.status && query.filters.status !== 'ALL') {
        where.status = query.filters.status;
      }

      totalCount = await prisma.job.count({ where });
      const jobs = await prisma.job.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: {
          client: { select: { legalName: true } },
          owner: { select: { name: true } },
        },
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
        job: {
          organizationId,
          ...(query.filters?.clientId ? { clientId: query.filters.clientId } : {}),
        },
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      };

      if (query.filters?.stageId) {
        where.stageId = query.filters.stageId;
      }

      totalCount = await prisma.application.count({ where });
      const apps = await prisma.application.findMany({
        where,
        take: limit,
        skip,
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
        application: {
          job: { organizationId },
        },
        ...(dateFilter.gte || dateFilter.lte ? { scheduledAt: dateFilter } : {}),
      };

      if (user.role === UserRole.RECRUITER) {
        where.panelMembers = { some: { userId: user.id } };
      }

      totalCount = await prisma.interview.count({ where });
      const interviews = await prisma.interview.findMany({
        where,
        take: limit,
        skip,
        orderBy: { scheduledAt: query.sortDirection || 'desc' },
        include: {
          application: {
            include: {
              candidate: { select: { name: true } },
              job: { select: { title: true } },
            },
          },
          round: { select: { name: true } },
          panelMembers: { include: { user: { select: { name: true } } } },
        },
      });

      rows = interviews.map((i) => ({
        candidateName: i.application.candidate.name,
        jobTitle: i.application.job.title,
        roundName: i.round?.name || 'General Evaluation',
        scheduledAt: i.scheduledAt.toISOString().replace('T', ' ').substring(0, 16),
        meetingType: i.provider || i.mode,
        status: i.outcome,
        interviewerName: i.panelMembers[0]?.user.name || 'Unassigned',
      }));
      break;
    }

    case 'SUBMISSIONS': {
      const where: any = {
        application: {
          job: {
            organizationId,
            ...(query.filters?.clientId ? { clientId: query.filters.clientId } : {}),
          },
        },
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      };

      if (query.filters?.status && query.filters.status !== 'ALL') {
        where.approvalStatus = query.filters.status;
      }

      totalCount = await prisma.submission.count({ where });
      const submissions = await prisma.submission.findMany({
        where,
        take: limit,
        skip,
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
        organizationId,
        isArchived: false,
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      };

      if (query.filters?.status && query.filters.status !== 'ALL') {
        where.status = query.filters.status;
      }

      totalCount = await prisma.client.count({ where });
      const clients = await prisma.client.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: {
          relationshipOwner: { select: { name: true } },
        },
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
        client: { organizationId },
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      };

      if (query.filters?.clientId) {
        where.clientId = query.filters.clientId;
      }

      totalCount = await prisma.placement.count({ where });
      const placements = await prisma.placement.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: query.sortDirection || 'desc' },
        include: {
          client: { select: { legalName: true } },
          application: {
            include: {
              candidate: { select: { name: true } },
              job: { select: { title: true } },
            },
          },
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

  // 4. Calculate Group By aggregation if requested
  let groups: Array<{ group: string; count: number }> | undefined;
  if (query.groupBy) {
    const groupCounts = new Map<string, number>();
    rows.forEach((r) => {
      const gVal = String(r[query.groupBy!] || 'Other');
      groupCounts.set(gVal, (groupCounts.get(gVal) || 0) + 1);
    });
    groups = Array.from(groupCounts.entries()).map(([group, count]) => ({ group, count }));
  }

  // 5. Filter row properties strictly to selected safe columns
  const filteredRows = rows.map((r) => {
    const out: Record<string, any> = {};
    safeColumns.forEach((col) => {
      out[col] = r[col] ?? '';
    });
    return out;
  });

  return {
    rows: filteredRows,
    totalCount,
    asOf: new Date().toISOString(),
    columns: safeColumns,
    groups,
  };
}

/**
 * Compiles verified, client-safe reporting data for scheduled client reports.
 * Enforces Zero Data Leak: Internal notes, margin fees, private scores are strictly excluded.
 */
export async function fetchClientReportData(
  organizationId: string,
  clientId: string,
  period = 'LAST_7_DAYS',
  includeSections: string[] = ['JOB_PROGRESS', 'SUBMITTED_PROFILES', 'NEXT_STEPS']
): Promise<ClientReportDataBundle> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId, isArchived: false },
    select: { id: true, legalName: true, status: true },
  });

  if (!client) {
    throw new Error(`Client not found or archived: ${clientId}`);
  }

  const dateFilter = parseDateRange(period);

  let jobProgress: ClientSafeJobProgress[] = [];
  let submittedProfiles: ClientSafeSubmissionProfile[] = [];
  let nextSteps: ClientSafeNextStep[] = [];

  // Section 1: Job Progress
  if (includeSections.includes('JOB_PROGRESS')) {
    const jobs = await prisma.job.findMany({
      where: {
        organizationId,
        clientId,
        isArchived: false,
      },
      include: {
        applications: {
          include: {
            submissions: { select: { id: true } },
            interviews: { select: { id: true, outcome: true } },
            offers: { select: { id: true } },
          },
        },
      },
    });

    jobProgress = jobs.map((j) => {
      let totalSubmissions = 0;
      let activeInterviews = 0;
      let offersExtended = 0;

      j.applications.forEach((a) => {
        totalSubmissions += a.submissions.length;
        activeInterviews += a.interviews.filter((i) => i.outcome === 'SCHEDULED').length;
        offersExtended += a.offers.length;
      });

      return {
        jobCode: j.code,
        jobTitle: j.title,
        openings: j.openings,
        status: j.status,
        totalSubmissions,
        activeInterviews,
        offersExtended,
      };
    });
  }

  // Section 2: Submitted Profiles (Safe allow-list only)
  if (includeSections.includes('SUBMITTED_PROFILES')) {
    const submissions = await prisma.submission.findMany({
      where: {
        application: {
          job: { organizationId, clientId },
        },
        sendState: 'SENT',
        ...(dateFilter.gte || dateFilter.lte ? { sentAt: dateFilter } : {}),
      },
      include: {
        application: {
          include: {
            candidate: {
              select: {
                code: true,
                name: true,
                currentTitle: true,
                experienceYears: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    submittedProfiles = submissions.map((s) => ({
      candidateCode: s.application.candidate.code,
      candidateName: s.application.candidate.name,
      currentTitle: s.application.candidate.currentTitle || 'Professional',
      experienceYears: s.application.candidate.experienceYears != null ? Number(s.application.candidate.experienceYears) : 0,
      submittedAt: s.sentAt ? s.sentAt.toISOString().split('T')[0] : s.createdAt.toISOString().split('T')[0],
      clientStatus: s.clientDecision || 'PENDING_REVIEW',
    }));
  }

  // Section 3: Next Steps
  if (includeSections.includes('NEXT_STEPS')) {
    const upcomingInterviews = await prisma.interview.findMany({
      where: {
        outcome: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
        application: {
          job: { organizationId, clientId },
        },
      },
      include: {
        application: {
          include: {
            candidate: { select: { code: true, name: true } },
            job: { select: { title: true } },
          },
        },
        round: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });

    nextSteps = upcomingInterviews.map((i) => ({
      candidateCode: i.application.candidate.code,
      candidateName: i.application.candidate.name,
      jobTitle: i.application.job.title,
      roundName: i.round?.name || 'Upcoming Round',
      scheduledAt: i.scheduledAt.toISOString().replace('T', ' ').substring(0, 16),
      actionRequired: 'Interview attendance and client evaluation submission',
    }));
  }

  return {
    clientName: client.legalName,
    reportingPeriod: period.replace(/_/g, ' '),
    generatedAt: new Date().toISOString(),
    jobProgress,
    submittedProfiles,
    nextSteps,
  };
}
