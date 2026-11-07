'use server';

import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  JobStatus,
  serializePipelineCard,
  PipelineCardDTO,
  PipelineColumnDTO,
  JobPipelineHeaderDTO,
  ApplicationStatus,
  canTransitionApplicationStage,
} from '@hireflow/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Helpers
// ─────────────────────────────────────────────────────────────────────────────

function canAccessPipeline(userRole: string): boolean {
  return (
    userRole === UserRole.ADMIN ||
    userRole === UserRole.MANAGER ||
    userRole === UserRole.RECRUITER
  );
}

async function assertJobAccess(jobId: string, userId: string, userRole: string) {
  if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) return;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      ownerId: true,
      assignments: { select: { recruiterId: true } },
    },
  });

  if (!job) throw new Error('Job not found');

  const isOwner = job.ownerId === userId;
  const isAssigned = job.assignments.some((a) => a.recruiterId === userId);

  if (!isOwner && !isAssigned) {
    throw new Error('Forbidden: You are not assigned to this job');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET PIPELINE BOARD
// ─────────────────────────────────────────────────────────────────────────────

export async function getPipelineAction(jobId: string): Promise<{
  header: JobPipelineHeaderDTO;
  columns: PipelineColumnDTO[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) {
      return { header: {} as JobPipelineHeaderDTO, columns: [], error: 'Forbidden' };
    }
    await assertJobAccess(jobId, user.id, user.role);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: { select: { id: true, legalName: true, code: true } },
        owner: { select: { name: true } },
      },
    });
    if (!job) return { header: {} as JobPipelineHeaderDTO, columns: [], error: 'Job not found' };

    // Resolve client custom stages if published workflow exists; otherwise default organization stages
    let resolvedStages: Array<{
      id: string;
      name: string;
      stageType: string;
      order: number;
      isArchived: boolean;
      colorHex?: string;
      isProtected?: boolean;
    }> = [];

    if (job.clientId) {
      const publishedWorkflow = await prisma.clientWorkflow.findFirst({
        where: { clientId: job.clientId, status: 'PUBLISHED' },
        include: {
          stages: { where: { isArchived: false, isActive: true }, orderBy: { order: 'asc' } },
        },
        orderBy: { version: 'desc' },
      });

      if (publishedWorkflow && publishedWorkflow.stages.length > 0) {
        resolvedStages = publishedWorkflow.stages.map((cs) => ({
          id: cs.id,
          name: cs.name,
          stageType: cs.stageType,
          order: cs.order,
          isArchived: cs.isArchived,
          colorHex: (cs.configuration as any)?.colorHex || '#4A5568',
          isProtected: cs.stageType === 'HIRED' || cs.stageType === 'PLACED' || cs.name.toLowerCase() === 'placed' || cs.name.toLowerCase() === 'joined',
        }));
      }
    }

    if (resolvedStages.length === 0) {
      const defaultStages = await prisma.stage.findMany({
        where: { organizationId: job.organizationId, isArchived: false },
        orderBy: { order: 'asc' },
      });
      resolvedStages = defaultStages.map((st) => ({
        id: st.id,
        name: st.name,
        stageType: st.stageType,
        order: st.order,
        isArchived: st.isArchived,
        colorHex: '#4A5568',
        isProtected: st.stageType === 'PLACED' || st.name.toLowerCase() === 'placed',
      }));
    }

    const columns: PipelineColumnDTO[] = await Promise.all(
      resolvedStages.map(async (stage) => {
        const stageCondition: any = {
          jobId,
          OR: [
            { stageId: stage.id },
            { stage: { name: stage.name } },
            { stage: { stageType: stage.stageType as any } },
            { status: stage.stageType as any },
          ],
        };

        const [apps, totalCount] = await Promise.all([
          prisma.application.findMany({
            where: stageCondition,
            include: {
              candidate: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  currentTitle: true,
                  currentCompany: true,
                  experienceYears: true,
                  expectedSalary: true,
                  location: true,
                  skills: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          }),
          prisma.application.count({ where: stageCondition }),
        ]);

        const cards = apps.map((app) => serializePipelineCard(app, user.role as UserRole));

        return {
          stage: {
            id: stage.id,
            name: stage.name,
            stageType: stage.stageType as ApplicationStatus,
            order: stage.order,
            isArchived: stage.isArchived,
            colorHex: stage.colorHex,
            isProtected: stage.isProtected,
          },
          totalCount,
          cards,
          hasMore: totalCount > cards.length,
          nextCursor: apps.length === 20 ? apps[apps.length - 1].id : undefined,
        };
      })
    );

    const header: JobPipelineHeaderDTO = {
      jobId: job.id,
      jobCode: job.code,
      jobTitle: job.title,
      clientId: job.clientId,
      clientName: job.client?.legalName ?? 'N/A',
      jobStatus: job.status as JobStatus,
      ownerId: job.ownerId,
      ownerName: job.owner?.name ?? null,
      openings: job.openings,
      totalApplications: columns.reduce((s, col) => s + col.totalCount, 0),
    };

    return { header, columns };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { header: {} as JobPipelineHeaderDTO, columns: [], error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOAD MORE (COLUMN PAGINATION)
// ─────────────────────────────────────────────────────────────────────────────

export async function loadMoreColumnAction(
  jobId: string,
  stageId: string,
  cursor: string
): Promise<{ cards: PipelineCardDTO[]; nextCursor?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) {
      return { cards: [], error: 'Forbidden' };
    }
    await assertJobAccess(jobId, user.id, user.role);

    const apps = await prisma.application.findMany({
      where: { jobId, stageId },
      include: {
        candidate: {
          select: {
            id: true,
            code: true,
            name: true,
            currentTitle: true,
            currentCompany: true,
            experienceYears: true,
            expectedSalary: true,
            location: true,
            skills: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      skip: 1,
      cursor: { id: cursor },
    });

    return {
      cards: apps.map((app) => serializePipelineCard(app, user.role as UserRole)),
      nextCursor: apps.length === 20 ? apps[apps.length - 1].id : undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { cards: [], error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADD CANDIDATE TO JOB
// ─────────────────────────────────────────────────────────────────────────────

export async function addCandidateToJobAction(
  jobId: string,
  candidateId: string
): Promise<{ success: boolean; applicationId?: string; error?: string; code?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) return { success: false, error: 'Forbidden' };
    await assertJobAccess(jobId, user.id, user.role);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { organizationId: true },
    });
    if (!job) return { success: false, error: 'Job not found' };

    // Duplicate check
    const existing = await prisma.application.findFirst({
      where: { jobId, candidateId },
    });
    if (existing) {
      return { success: false, error: 'Candidate already applied to this job', code: 'DUPLICATE_APPLICATION' };
    }

    // Get first stage
    const firstStage = await prisma.stage.findFirst({
      where: { organizationId: job.organizationId, isArchived: false },
      orderBy: { order: 'asc' },
    });

    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          jobId,
          candidateId,
          stageId: firstStage?.id ?? null,
          status: (firstStage?.stageType ?? 'SOURCED') as ApplicationStatus,
          appliedAt: new Date(),
          createdById: user.id,
        },
      });

      if (firstStage) {
        await tx.applicationStageHistory.create({
          data: {
            applicationId: app.id,
            fromStage: null,
            toStage: firstStage.stageType,
            changedById: user.id,
            comments: 'Added to pipeline',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'APPLICATION_CREATED',
          entity: 'application',
          entityId: app.id,
          after: { jobId, candidateId, stageId: firstStage?.id },
        },
      });

      return app;
    });

    revalidatePath(`/jobs/${jobId}/pipeline`);
    return { success: true, applicationId: application.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TRANSITION APPLICATION STAGE
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionApplicationStageAction(
  applicationId: string,
  toStageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) return { success: false, error: 'Forbidden' };

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { id: true, status: true } }, stage: true },
    });
    if (!app) return { success: false, error: 'Application not found' };

    await assertJobAccess(app.job.id, user.id, user.role);

    const toStage = await prisma.stage.findUnique({ where: { id: toStageId } });
    if (!toStage) return { success: false, error: 'Target stage not found' };

    const fromType = (app.stage?.stageType ?? app.status) as ApplicationStatus;
    const toType = toStage.stageType as ApplicationStatus;

    const validation = canTransitionApplicationStage(fromType, toType, app.job.status as JobStatus);
    if (!validation.allowed) {
      return { success: false, error: validation.reason || `Cannot transition from ${fromType} to ${toType}` };
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: { stageId: toStageId, status: toType },
      });

      await tx.applicationStageHistory.create({
        data: {
          applicationId,
          fromStage: fromType,
          toStage: toType,
          changedById: user.id,
          comments: 'Pipeline drag-and-drop',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'APPLICATION_STAGE_CHANGED',
          entity: 'application',
          entityId: applicationId,
          before: { stageId: app.stageId, stageType: fromType },
          after: { stageId: toStageId, stageType: toType },
        },
      });
    });

    revalidatePath(`/jobs/${app.job.id}/pipeline`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. REJECT APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectApplicationAction(
  applicationId: string,
  rejectionReasonId: string,
  rejectionFeedback: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) return { success: false, error: 'Forbidden' };

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { id: true } }, stage: true },
    });
    if (!app) return { success: false, error: 'Application not found' };
    await assertJobAccess(app.job.id, user.id, user.role);

    const reason = await prisma.rejectionReason.findFirst({
      where: {
        OR: [{ id: rejectionReasonId }, { code: rejectionReasonId }],
        isArchived: false,
      },
    });
    if (!reason) return { success: false, error: 'Invalid rejection reason' };

    const job = await prisma.job.findUnique({ where: { id: app.job.id }, select: { organizationId: true } });
    const rejectedStage = await prisma.stage.findFirst({
      where: { organizationId: job?.organizationId ?? '', stageType: 'REJECTED', isArchived: false },
    });

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          stageId: rejectedStage?.id ?? app.stageId,
          status: 'REJECTED',
          rejectionReasonId: reason.id,
          rejectionFeedback,
          rejectedAt: new Date(),
        },
      });

      await tx.applicationStageHistory.create({
        data: {
          applicationId,
          fromStage: app.status,
          toStage: 'REJECTED',
          changedById: user.id,
          comments: `Rejected: ${reason.reason}. ${rejectionFeedback}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'APPLICATION_REJECTED',
          entity: 'application',
          entityId: applicationId,
          before: { stageId: app.stageId },
          after: { status: 'REJECTED', rejectionReasonId: reason.id, feedback: rejectionFeedback },
        },
      });
    });

    revalidatePath(`/jobs/${app.job.id}/pipeline`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET APPLICATION DRAWER
// ─────────────────────────────────────────────────────────────────────────────

export async function getApplicationDrawerAction(applicationId: string): Promise<{
  data?: {
    applicationId: string;
    candidateId: string;
    candidateName: string;
    candidateCode: string;
    currentTitle: string | null;
    currentCompany: string | null;
    email: string;
    phone: string | null;
    experienceYears: number | null;
    expectedSalary: string | null;
    skills: string[];
    noticePeriod: string | null;
    stageType: string;
    stageName: string;
    appliedAt: string;
    notes: Array<{ id: string; content: string; createdAt: string }>;
    stageHistory: Array<{ stage: string; changedAt: string; comments: string | null }>;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) return { error: 'Forbidden' };

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: { select: { id: true } },
        stage: true,
        candidate: {
          select: {
            id: true,
            code: true,
            name: true,
            email: true,
            phone: true,
            currentTitle: true,
            currentCompany: true,
            experienceYears: true,
            expectedSalary: true,
            noticePeriod: true,
            skills: true,
            notes: {
              select: { id: true, content: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
        stageHistories: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!app) return { error: 'Application not found' };
    await assertJobAccess(app.job.id, user.id, user.role);

    return {
      data: {
        applicationId: app.id,
        candidateId: app.candidate.id,
        candidateName: app.candidate.name,
        candidateCode: app.candidate.code,
        currentTitle: app.candidate.currentTitle,
        currentCompany: app.candidate.currentCompany,
        email: app.candidate.email,
        phone: app.candidate.phone,
        experienceYears: app.candidate.experienceYears != null ? Number(app.candidate.experienceYears) : null,
        expectedSalary: app.candidate.expectedSalary ? `₹${(Number(app.candidate.expectedSalary) / 100000).toFixed(1)} LPA` : null,
        skills: app.candidate.skills,
        noticePeriod: app.candidate.noticePeriod,
        stageType: app.stage?.stageType ?? app.status,
        stageName: app.stage?.name ?? app.status,
        appliedAt: app.appliedAt.toISOString(),
        notes: app.candidate.notes.map((n) => ({
          id: n.id,
          content: n.content,
          createdAt: n.createdAt.toISOString(),
        })),
        stageHistory: app.stageHistories.map((h) => ({
          stage: h.toStage,
          changedAt: h.createdAt.toISOString(),
          comments: h.comments,
        })),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ADD NOTE TO CANDIDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function addApplicationNoteAction(
  applicationId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) return { success: false, error: 'Forbidden' };

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { candidateId: true, job: { select: { id: true } } },
    });
    if (!app) return { success: false, error: 'Application not found' };
    await assertJobAccess(app.job.id, user.id, user.role);

    await prisma.candidateNote.create({
      data: {
        candidateId: app.candidateId,
        authorId: user.id,
        content,
        isInternalOnly: true,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. GET REJECTION REASONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getRejectionReasonsAction(): Promise<{
  reasons: Array<{ id: string; code: string; label: string }>;
}> {
  try {
    const reasons = await prisma.rejectionReason.findMany({
      where: { isArchived: false },
      orderBy: { reason: 'asc' },
      select: { id: true, code: true, reason: true },
    });
    return {
      reasons: reasons.map((r) => ({
        id: r.id,
        code: r.code,
        label: r.reason,
      })),
    };
  } catch {
    return { reasons: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. SEARCH AVAILABLE CANDIDATES
// ─────────────────────────────────────────────────────────────────────────────

export async function searchAvailableCandidatesAction(
  jobId: string,
  query: string
): Promise<{
  candidates: Array<{
    id: string;
    code: string;
    name: string;
    currentTitle: string | null;
    currentCompany: string | null;
    alreadyApplied: boolean;
  }>;
}> {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessPipeline(user.role)) return { candidates: [] };

    const existingApplicantIds = await prisma.application
      .findMany({ where: { jobId }, select: { candidateId: true } })
      .then((apps) => apps.map((a) => a.candidateId));

    const candidates = await prisma.candidate.findMany({
      where: {
        isArchived: false,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        code: true,
        name: true,
        currentTitle: true,
        currentCompany: true,
      },
    });

    return {
      candidates: candidates.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        currentTitle: c.currentTitle,
        currentCompany: c.currentCompany,
        alreadyApplied: existingApplicantIds.includes(c.id),
      })),
    };
  } catch {
    return { candidates: [] };
  }
}
