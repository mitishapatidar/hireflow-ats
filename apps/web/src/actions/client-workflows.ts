'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  UpdateClientWorkflowDraftSchema,
  PublishClientWorkflowSchema,
  UpdateClientWorkflowDraftInput,
} from '@hireflow/shared';

function assertManagerOrAdmin(user: any) {
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    throw new Error('Forbidden: Client workflow configuration is restricted to Managers and Administrators.');
  }
}

async function verifyClientAccess(clientId: string, organizationId: string) {
  return await prisma.client.findFirst({
    where: { id: clientId, organizationId, isArchived: false },
  });
}

async function ensureInitialWorkflow(clientId: string, userId: string) {
  const existing = await prisma.clientWorkflow.findFirst({
    where: { clientId },
    orderBy: { version: 'desc' },
    include: {
      stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
      rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
      submissionRules: { take: 1 },
    },
  });

  if (existing) return existing;

  return await prisma.$transaction(async (tx) => {
    return await tx.clientWorkflow.create({
      data: {
        clientId,
        version: 1,
        status: 'PUBLISHED',
        changeSummary: 'Initial baseline client workflow',
        publishedAt: new Date(),
        publishedById: userId,
        stages: {
          create: [
            { name: 'Sourced', order: 1, stageType: 'SOURCING', configuration: { colorHex: '#4A5568' } },
            { name: 'Screening', order: 2, stageType: 'SCREENING', configuration: { colorHex: '#2B6CB0' } },
            { name: 'Interview', order: 3, stageType: 'INTERVIEW', configuration: { colorHex: '#805AD5' } },
            { name: 'Client Review', order: 4, stageType: 'CLIENT_REVIEW', configuration: { colorHex: '#DD6B20' } },
            { name: 'Offer', order: 5, stageType: 'OFFER', configuration: { colorHex: '#319795' } },
            { name: 'Placed', order: 6, stageType: 'HIRED', configuration: { colorHex: '#38A169' } },
          ],
        },
        rounds: {
          create: [
            { name: 'Initial Recruiter Screen', order: 1, type: 'SCREENING', isRequired: true, defaultDuration: 30 },
            { name: 'Technical Assessment', order: 2, type: 'TECHNICAL', isTechnical: true, isRequired: true, defaultDuration: 60 },
            { name: 'Hiring Manager Interview', order: 3, type: 'HIRING_MANAGER', isHiringManager: true, isRequired: true, defaultDuration: 45 },
          ],
        },
        submissionRules: {
          create: [
            {
              requireCompleteProfile: true,
              requireCvDocument: true,
              requirePortfolioUrl: false,
              requireExpectedSalary: true,
              requireNoticePeriod: true,
              requireCandidateConsent: true,
              requiresManagerApproval: true,
              profileFormat: 'STANDARDIZED_ANONYMIZED',
            },
          ],
        },
      },
      include: {
        stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
        rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
        submissionRules: { take: 1 },
      },
    });
  });
}

export async function getClientWorkflowAction(clientId: string, version?: number, status?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const client = await verifyClientAccess(clientId, user.organizationId);
    if (!client) return { success: false, error: 'Client not found' };

    let workflow;
    if (version) {
      workflow = await prisma.clientWorkflow.findFirst({
        where: { clientId, version },
        include: {
          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
          submissionRules: { take: 1 },
        },
      });
    } else if (status === 'DRAFT') {
      workflow = await prisma.clientWorkflow.findFirst({
        where: { clientId, status: 'DRAFT' },
        include: {
          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
          submissionRules: { take: 1 },
        },
      });
    } else {
      workflow = await prisma.clientWorkflow.findFirst({
        where: { clientId, status: 'PUBLISHED' },
        include: {
          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
          submissionRules: { take: 1 },
        },
      });
    }

    if (!workflow) {
      workflow = await ensureInitialWorkflow(clientId, user.id);
    }

    const existingDraft = await prisma.clientWorkflow.findFirst({
      where: { clientId, status: 'DRAFT' },
      select: { id: true, version: true, updatedAt: true },
    });

    const submissionRule = workflow.submissionRules[0] || null;

    let publisherName: string | null = null;
    if (workflow.publishedById) {
      const publisher = await prisma.user.findUnique({
        where: { id: workflow.publishedById },
        select: { name: true },
      });
      publisherName = publisher?.name || null;
    }

    return {
      success: true,
      data: {
        client: {
          id: client.id,
          legalName: client.legalName,
          code: client.code,
        },
        workflow: {
          id: workflow.id,
          version: workflow.version,
          status: workflow.status,
          changeSummary: workflow.changeSummary,
          publishedAt: workflow.publishedAt?.toISOString() || null,
          publishedBy: publisherName,
          stages: workflow.stages.map((s) => ({
            id: s.id,
            name: s.name,
            stageOrder: s.order,
            order: s.order,
            stageType: s.stageType,
            colorHex: (s.configuration as any)?.colorHex || '#4A5568',
            isActive: s.isActive,
          })),
          rounds: workflow.rounds.map((r) => ({
            id: r.id,
            name: r.name,
            order: r.order,
            type: r.type,
            isTechnical: r.isTechnical,
            isHiringManager: r.isHiringManager,
            isRequired: r.isRequired,
            defaultDuration: r.defaultDuration,
            isActive: r.isActive,
          })),
          submissionRule: submissionRule
            ? {
                id: submissionRule.id,
                requiredFields: (submissionRule.requiredFields as string[]) || [],
                requireCompleteProfile: submissionRule.requireCompleteProfile,
                requireCvDocument: submissionRule.requireCvDocument,
                requirePortfolioUrl: submissionRule.requirePortfolioUrl,
                requireExpectedSalary: submissionRule.requireExpectedSalary,
                requireNoticePeriod: submissionRule.requireNoticePeriod,
                requireCandidateConsent: submissionRule.requireCandidateConsent,
                requiresManagerApproval: submissionRule.requiresManagerApproval,
                profileFormat: submissionRule.profileFormat,
              }
            : null,
        },
        hasDraft: Boolean(existingDraft),
        draftId: existingDraft?.id || null,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load workflow' };
  }
}

export async function createWorkflowDraftAction(clientId: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const client = await verifyClientAccess(clientId, user!.organizationId);
    if (!client) return { success: false, error: 'Client not found' };

    const existingDraft = await prisma.clientWorkflow.findFirst({
      where: { clientId, status: 'DRAFT' },
      include: {
        stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
        rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
        submissionRules: { take: 1 },
      },
    });

    if (existingDraft) {
      return { success: true, data: existingDraft, message: 'Existing draft resumed.' };
    }

    let published = await prisma.clientWorkflow.findFirst({
      where: { clientId, status: 'PUBLISHED' },
      include: {
        stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
        rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
        submissionRules: { take: 1 },
      },
    });

    if (!published) {
      published = await ensureInitialWorkflow(clientId, user!.id);
    }

    const nextVersion = published.version + 1;
    const pubRule = published.submissionRules[0] || null;

    const newDraft = await prisma.$transaction(async (tx) => {
      return await tx.clientWorkflow.create({
        data: {
          clientId,
          version: nextVersion,
          status: 'DRAFT',
          changeSummary: 'Work in progress draft',
          stages: {
            create: published.stages.map((s) => ({
              name: s.name,
              order: s.order,
              stageType: s.stageType,
              configuration: s.configuration as any,
              isActive: s.isActive,
            })),
          },
          rounds: {
            create: published.rounds.map((r) => ({
              name: r.name,
              order: r.order,
              type: r.type,
              isTechnical: r.isTechnical,
              isHiringManager: r.isHiringManager,
              isRequired: r.isRequired,
              defaultDuration: r.defaultDuration,
              isActive: r.isActive,
            })),
          },
          submissionRules: pubRule
            ? {
                create: [
                  {
                    requireCompleteProfile: pubRule.requireCompleteProfile,
                    requireCvDocument: pubRule.requireCvDocument,
                    requirePortfolioUrl: pubRule.requirePortfolioUrl,
                    requireExpectedSalary: pubRule.requireExpectedSalary,
                    requireNoticePeriod: pubRule.requireNoticePeriod,
                    requireCandidateConsent: pubRule.requireCandidateConsent,
                    requiresManagerApproval: pubRule.requiresManagerApproval,
                    profileFormat: pubRule.profileFormat,
                  },
                ],
              }
            : undefined,
        },
        include: {
          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
          submissionRules: { take: 1 },
        },
      });
    });

    revalidatePath(`/admin/clients/${clientId}/workflow`);
    return { success: true, data: newDraft, message: 'Draft created.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create draft' };
  }
}

export async function updateWorkflowDraftAction(clientId: string, payload: UpdateClientWorkflowDraftInput) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const client = await verifyClientAccess(clientId, user!.organizationId);
    if (!client) return { success: false, error: 'Client not found' };

    const draft = await prisma.clientWorkflow.findFirst({
      where: { clientId, status: 'DRAFT' },
    });

    if (!draft) {
      return { success: false, error: 'No active draft found. Please create a draft first.' };
    }

    const parseResult = UpdateClientWorkflowDraftSchema.safeParse(payload);
    if (!parseResult.success) {
      return { success: false, error: 'Validation failed', details: parseResult.error.flatten() };
    }

    const { stages, rounds, submissionRule, rules } = parseResult.data;
    const ruleData = submissionRule || rules;

    await prisma.$transaction(async (tx) => {
      if (stages) {
        await tx.clientStage.deleteMany({ where: { workflowId: draft.id } });
        await tx.clientStage.createMany({
          data: stages.map((s, idx) => ({
            workflowId: draft.id,
            name: s.name,
            order: s.order || idx + 1,
            stageType: s.stageType || 'CUSTOM',
            configuration: { colorHex: (s as any).colorHex || '#4A5568' },
            isActive: s.isActive ?? true,
          })),
        });
      }

      if (rounds) {
        await tx.clientInterviewRound.deleteMany({ where: { workflowId: draft.id } });
        await tx.clientInterviewRound.createMany({
          data: rounds.map((r, idx) => ({
            workflowId: draft.id,
            name: r.name,
            order: r.order || idx + 1,
            type: r.type || 'GENERAL',
            isTechnical: r.isTechnical ?? false,
            isHiringManager: r.isHiringManager ?? false,
            isRequired: r.isRequired ?? true,
            defaultDuration: r.defaultDuration || 45,
            isActive: r.isActive ?? true,
          })),
        });
      }

      if (ruleData) {
        await tx.submissionRule.deleteMany({ where: { workflowId: draft.id } });
        await tx.submissionRule.create({
          data: {
            workflowId: draft.id,
            requireCompleteProfile: ruleData.requireCompleteProfile ?? true,
            requireCvDocument: ruleData.requireCvDocument ?? true,
            requirePortfolioUrl: ruleData.requirePortfolioUrl ?? false,
            requireExpectedSalary: ruleData.requireExpectedSalary ?? true,
            requireNoticePeriod: ruleData.requireNoticePeriod ?? true,
            requireCandidateConsent: ruleData.requireCandidateConsent ?? true,
            requiresManagerApproval: true,
            profileFormat: ruleData.profileFormat || 'STANDARDIZED_ANONYMIZED',
          },
        });
      }
    });

    revalidatePath(`/admin/clients/${clientId}/workflow`);
    return { success: true, message: 'Draft updated successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update draft' };
  }
}

export async function publishWorkflowAction(clientId: string, changeSummary: string) {
  try {
    const user = await getCurrentUser();
    assertManagerOrAdmin(user);

    const client = await verifyClientAccess(clientId, user!.organizationId);
    if (!client) return { success: false, error: 'Client not found' };

    const parseResult = PublishClientWorkflowSchema.safeParse({ clientId, changeSummary });
    if (!parseResult.success) {
      return { success: false, error: 'Validation failed: A descriptive change summary is required to publish.' };
    }

    const draft = await prisma.clientWorkflow.findFirst({
      where: { clientId, status: 'DRAFT' },
      include: {
        stages: { where: { isArchived: false } },
        rounds: { where: { isActive: true } },
        submissionRules: { take: 1 },
      },
    });

    if (!draft) return { success: false, error: 'No active draft found to publish.' };
    if (draft.stages.length === 0) return { success: false, error: 'Cannot publish workflow with zero pipeline stages.' };

    const publishedWorkflow = await prisma.$transaction(async (tx) => {
      await tx.clientWorkflow.updateMany({
        where: { clientId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });

      return await tx.clientWorkflow.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          changeSummary,
          publishedAt: new Date(),
          publishedById: user!.id,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        actorId: user!.id,
        action: 'CLIENT_WORKFLOW_PUBLISHED',
        entity: 'client_workflow',
        entityId: publishedWorkflow.id,
        after: { clientId, version: publishedWorkflow.version, changeSummary },
        ipAddress: '127.0.0.1',
      },
    });

    revalidatePath(`/admin/clients/${clientId}/workflow`);
    return { success: true, data: publishedWorkflow, message: `Version ${publishedWorkflow.version} published successfully.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to publish workflow' };
  }
}

export async function getClientWorkflowVersionsAction(clientId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const client = await verifyClientAccess(clientId, user.organizationId);
    if (!client) return { success: false, error: 'Client not found' };

    const versions = await prisma.clientWorkflow.findMany({
      where: { clientId },
      include: {
        _count: { select: { stages: true, rounds: true } },
      },
      orderBy: { version: 'desc' },
    });

    const publisherIds = Array.from(new Set(versions.map((v) => v.publishedById).filter(Boolean) as string[]));
    const publishers = publisherIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: publisherIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const publisherMap = new Map(publishers.map((p) => [p.id, p.name]));

    return {
      success: true,
      data: versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        changeSummary: v.changeSummary,
        publishedAt: v.publishedAt?.toISOString() || null,
        publishedBy: v.publishedById ? publisherMap.get(v.publishedById) || 'Manager' : 'System Admin',
        stageCount: v._count.stages,
        roundCount: v._count.rounds,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch versions' };
  }
}
