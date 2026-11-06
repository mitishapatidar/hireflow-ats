'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  UserRole,
  JobStatus,
  SubmissionApprovalStatus,
  getISTMonthBoundaries,
} from '@hireflow/shared';

function assertManagerOrAdmin(user: any) {
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    throw new Error('Forbidden: Manager Overview is restricted to designated Managers and Administrators.');
  }
}

async function getSubordinateUserIds(managerId: string, organizationId: string): Promise<string[]> {
  const direct = await prisma.user.findMany({
    where: { managerId, organizationId },
    select: { id: true },
  });
  const directIds = direct.map((u) => u.id);
  const allSubordinateIds = new Set<string>(directIds);

  let currentLayer = directIds;
  while (currentLayer.length > 0) {
    const nextLayer = await prisma.user.findMany({
      where: { managerId: { in: currentLayer }, organizationId },
      select: { id: true },
    });
    const nextIds = nextLayer.map((u) => u.id).filter((id) => !allSubordinateIds.has(id));
    for (const id of nextIds) {
      allSubordinateIds.add(id);
    }
    currentLayer = nextIds;
  }
  return Array.from(allSubordinateIds);
}

export async function getManagerOverviewAction() {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const { startUtc, endUtc, label: currentMonthLabel } = getISTMonthBoundaries();

    let subordinateIds: string[] | null = null;
    if (user!.role === UserRole.MANAGER) {
      subordinateIds = await getSubordinateUserIds(user!.id, user!.organizationId);
    }

    const jobsWhere: Prisma.JobWhereInput = {
      organizationId: user!.organizationId,
      status: JobStatus.PENDING_APPROVAL as any,
      isArchived: false,
    };
    if (subordinateIds !== null) {
      jobsWhere.OR = [
        { ownerId: { in: subordinateIds } },
        { createdById: { in: subordinateIds } },
      ];
    }

    const submissionsWhere: Prisma.SubmissionWhereInput = {
      application: {
        job: {
          organizationId: user!.organizationId,
          isArchived: false,
        },
      },
      approvalStatus: SubmissionApprovalStatus.PENDING_MANAGER_APPROVAL,
      isArchived: false,
    };
    if (subordinateIds !== null) {
      submissionsWhere.OR = [
        { application: { candidate: { ownerId: { in: subordinateIds } } } },
        { application: { job: { ownerId: { in: subordinateIds } } } },
        { createdById: { in: subordinateIds } },
      ];
    }

    const recruitersWhere: Prisma.UserWhereInput = {
      organizationId: user!.organizationId,
      role: UserRole.RECRUITER,
      status: 'ACTIVE',
    };
    if (subordinateIds !== null) {
      recruitersWhere.id = { in: subordinateIds };
    }

    const placementsWhere: Prisma.PlacementWhereInput = {
      application: { job: { organizationId: user!.organizationId } },
      createdAt: { gte: startUtc, lte: endUtc },
    };
    if (subordinateIds !== null) {
      placementsWhere.OR = [
        { application: { candidate: { ownerId: { in: subordinateIds } } } },
        { application: { job: { ownerId: { in: subordinateIds } } } },
        { createdById: { in: subordinateIds } },
      ];
    }

    const [
      jobsAwaitingApproval,
      submissionsAwaitingApproval,
      activeRecruiters,
      placementsThisMonth,
      recentPendingSubmissions,
      recentPendingJobs,
    ] = await Promise.all([
      prisma.job.count({ where: jobsWhere }),
      prisma.submission.count({ where: submissionsWhere }),
      prisma.user.count({ where: recruitersWhere }),
      prisma.placement.count({ where: placementsWhere }),
      prisma.submission.findMany({
        where: submissionsWhere,
        include: {
          application: {
            include: {
              candidate: { select: { id: true, name: true, code: true } },
              job: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  client: { select: { legalName: true } },
                },
              },
            },
          },
          profileVersions: {
            where: { isCurrent: true },
            include: { createdBy: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.job.findMany({
        where: jobsWhere,
        include: {
          client: { select: { legalName: true } },
          owner: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const pendingApprovals = [
      ...recentPendingSubmissions.map((s) => ({
        id: s.id,
        type: 'SUBMISSION',
        code: s.code,
        title: `${s.application.candidate.name} → ${s.application.job.title}`,
        clientName: s.application.job.client.legalName,
        submittedBy: s.profileVersions[0]?.createdBy?.name || 'Recruiter',
        submittedAt: s.createdAt.toISOString(),
        version: s.version,
      })),
      ...recentPendingJobs.map((j) => ({
        id: j.id,
        type: 'JOB',
        code: j.code,
        title: j.title,
        clientName: j.client.legalName,
        submittedBy: j.owner?.name || 'Recruiter',
        submittedAt: j.createdAt.toISOString(),
        version: 1,
      })),
    ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return {
      success: true,
      data: {
        manager: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          role: user!.role,
        },
        kpis: {
          jobsAwaitingApproval,
          submissionsAwaitingApproval,
          activeRecruiters,
          placementsThisMonth,
          monthLabel: currentMonthLabel,
        },
        pendingApprovals: pendingApprovals.slice(0, 5),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load manager overview' };
  }
}

export async function getManagerTeamPerformanceAction() {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const { startUtc, endUtc } = getISTMonthBoundaries();

    let recruiterIds: string[];
    if (user!.role === UserRole.MANAGER) {
      recruiterIds = await getSubordinateUserIds(user!.id, user!.organizationId);
    } else {
      const allRecruiters = await prisma.user.findMany({
        where: { organizationId: user!.organizationId, role: UserRole.RECRUITER, status: 'ACTIVE' },
        select: { id: true },
      });
      recruiterIds = allRecruiters.map((r) => r.id);
    }

    if (recruiterIds.length === 0) {
      return { success: true, data: { recruiters: [] } };
    }

    const recruiters = await prisma.user.findMany({
      where: { id: { in: recruiterIds } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        team: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const performanceList = await Promise.all(
      recruiters.map(async (rec) => {
        const [activeJobsCount, pipelineCandidatesCount, interviewsThisMonth, submissionsThisMonth, placementsThisMonth] =
          await Promise.all([
            prisma.job.count({
              where: {
                organizationId: user!.organizationId,
                isArchived: false,
                status: JobStatus.ACTIVE as any,
                OR: [
                  { ownerId: rec.id },
                  { assignments: { some: { recruiterId: rec.id, status: 'ACTIVE' } } },
                ],
              },
            }),
            prisma.application.count({
              where: {
                job: { organizationId: user!.organizationId, isArchived: false },
                status: { notIn: ['REJECTED', 'PLACED'] },
                OR: [
                  { candidate: { ownerId: rec.id } },
                  { createdById: rec.id },
                  { job: { ownerId: rec.id } },
                ],
              },
            }),
            prisma.interview.count({
              where: {
                application: { job: { organizationId: user!.organizationId } },
                createdAt: { gte: startUtc, lte: endUtc },
                OR: [
                  { createdById: rec.id },
                  { panelMembers: { some: { userId: rec.id } } },
                  { application: { candidate: { ownerId: rec.id } } },
                ],
              },
            }),
            prisma.submission.count({
              where: {
                application: { job: { organizationId: user!.organizationId } },
                createdAt: { gte: startUtc, lte: endUtc },
                createdById: rec.id,
              },
            }),
            prisma.placement.count({
              where: {
                application: { job: { organizationId: user!.organizationId } },
                createdAt: { gte: startUtc, lte: endUtc },
                OR: [
                  { createdById: rec.id },
                  { application: { candidate: { ownerId: rec.id } } },
                  { application: { job: { ownerId: rec.id } } },
                ],
              },
            }),
          ]);

        return {
          id: rec.id,
          name: rec.name,
          email: rec.email,
          teamName: rec.team?.name || 'Recruitment Team',
          activeJobsCount,
          pipelineCandidatesCount,
          interviewsThisMonth,
          submissionsThisMonth,
          placementsThisMonth,
        };
      })
    );

    return {
      success: true,
      data: {
        recruiters: performanceList,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch team performance' };
  }
}
