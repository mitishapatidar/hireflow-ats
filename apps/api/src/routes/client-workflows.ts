import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  WorkflowStatus,
  UpdateClientWorkflowDraftSchema,
  PublishClientWorkflowSchema,
} from '@hireflow/shared';

export const clientWorkflowRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Verify Manager or Admin role
  function requireManagerOrAdmin(user: any, reply: any): boolean {
    if (!user) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return false;
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
      reply.status(403).send({
        success: false,
        error: 'Forbidden: Client workflow configuration is restricted to Managers and Administrators.',
      });
      return false;
    }
    return true;
  }

  // Helper: Verify client belongs to organization
  async function verifyClientAccess(clientId: string, organizationId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId, isArchived: false },
    });
    return client;
  }

  // Helper: Create default initial workflow if none exists
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

    if (existing) {
      return existing;
    }

    // Seed default initial v1 workflow
    return await prisma.$transaction(async (tx) => {
      const created = await tx.clientWorkflow.create({
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
      return created;
    });
  }

  // -------------------------------------------------------------
  // 1. GET /api/clients/:clientId/workflow (Active Workflow & Rules)
  // -------------------------------------------------------------
  server.get(
    '/:clientId/workflow',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { clientId } = request.params as { clientId: string };
      const client = await verifyClientAccess(clientId, user.organizationId);
      if (!client) {
        return reply.status(404).send({ success: false, error: 'Client not found' });
      }

      const query = request.query as { version?: string; status?: string };

      let workflow;
      if (query.version) {
        const v = parseInt(query.version, 10);
        workflow = await prisma.clientWorkflow.findFirst({
          where: { clientId, version: v },
          include: {
            stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
            rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
            submissionRules: { take: 1 },
          },
        });
      } else if (query.status === 'DRAFT') {
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

      // Check if draft exists
      const existingDraft = await prisma.clientWorkflow.findFirst({
        where: { clientId, status: 'DRAFT' },
        select: { id: true, version: true, updatedAt: true },
      });

      const submissionRule = workflow.submissionRules[0] || null;

      // Fetch publisher name if publishedById present
      let publisherName: string | null = null;
      if (workflow.publishedById) {
        const publisher = await prisma.user.findUnique({
          where: { id: workflow.publishedById },
          select: { name: true },
        });
        publisherName = publisher?.name || null;
      }

      return reply.send({
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
      });
    }
  );

  // -------------------------------------------------------------
  // 2. POST /api/clients/:clientId/workflow/draft (Start Editing Draft)
  // -------------------------------------------------------------
  server.post(
    '/:clientId/workflow/draft',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { clientId } = request.params as { clientId: string };
      const client = await verifyClientAccess(clientId, user.organizationId);
      if (!client) {
        return reply.status(404).send({ success: false, error: 'Client not found' });
      }

      // Check if draft already exists
      const existingDraft = await prisma.clientWorkflow.findFirst({
        where: { clientId, status: 'DRAFT' },
        include: {
          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
          submissionRules: { take: 1 },
        },
      });

      if (existingDraft) {
        return reply.send({
          success: true,
          data: existingDraft,
          message: 'Existing draft resumed.',
        });
      }

      // Get latest published workflow to clone from
      let published = await prisma.clientWorkflow.findFirst({
        where: { clientId, status: 'PUBLISHED' },
        include: {
          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
          submissionRules: { take: 1 },
        },
      });

      if (!published) {
        published = await ensureInitialWorkflow(clientId, user.id);
      }

      const nextVersion = published.version + 1;
      const pubRule = published.submissionRules[0] || null;

      // Clone transactionally into a new DRAFT
      const newDraft = await prisma.$transaction(async (tx) => {
        const draft = await tx.clientWorkflow.create({
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
        return draft;
      });

      return reply.status(201).send({
        success: true,
        data: newDraft,
        message: 'New draft workflow created for editing.',
      });
    }
  );

  // -------------------------------------------------------------
  // 3. PATCH /api/clients/:clientId/workflow/draft (Update Draft)
  // -------------------------------------------------------------
  server.patch(
    '/:clientId/workflow/draft',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { clientId } = request.params as { clientId: string };
      const client = await verifyClientAccess(clientId, user.organizationId);
      if (!client) {
        return reply.status(404).send({ success: false, error: 'Client not found' });
      }

      const draft = await prisma.clientWorkflow.findFirst({
        where: { clientId, status: 'DRAFT' },
      });

      if (!draft) {
        return reply.status(404).send({
          success: false,
          error: 'No active draft found. Click "Edit Workflow" to create a new draft.',
        });
      }

      const parseResult = UpdateClientWorkflowDraftSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const { stages, rounds, submissionRule, rules } = parseResult.data;
      const ruleData = submissionRule || rules;

      await prisma.$transaction(async (tx) => {
        // Update stages if provided
        if (stages) {
          await tx.clientStage.deleteMany({ where: { workflowId: draft.id } });
          await tx.clientStage.createMany({
            data: stages.map((s, idx) => ({
              workflowId: draft.id,
              name: s.name,
              order: s.stageOrder || idx + 1,
              stageType: s.stageType || 'CUSTOM',
              configuration: { colorHex: s.colorHex || '#4A5568' },
              isActive: s.isActive ?? true,
            })),
          });
        }

        // Update rounds if provided
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

        // Update submission rules if provided
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

      const updated = await prisma.clientWorkflow.findUnique({
        where: { id: draft.id },
        include: {
          stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
          rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
          submissionRules: { take: 1 },
        },
      });

      return reply.send({
        success: true,
        data: updated,
        message: 'Draft workflow updated successfully.',
      });
    }
  );

  // -------------------------------------------------------------
  // 4. POST /api/clients/:clientId/workflow/publish (Publish Draft)
  // -------------------------------------------------------------
  server.post(
    '/:clientId/workflow/publish',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!requireManagerOrAdmin(user, reply)) return;

      const { clientId } = request.params as { clientId: string };
      const client = await verifyClientAccess(clientId, user.organizationId);
      if (!client) {
        return reply.status(404).send({ success: false, error: 'Client not found' });
      }

      const parseResult = PublishClientWorkflowSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed: A descriptive change summary is required to publish.',
          details: parseResult.error.flatten(),
        });
      }

      const { changeSummary } = parseResult.data;

      const draft = await prisma.clientWorkflow.findFirst({
        where: { clientId, status: 'DRAFT' },
        include: {
          stages: { where: { isArchived: false } },
          rounds: { where: { isActive: true } },
          submissionRules: { take: 1 },
        },
      });

      if (!draft) {
        return reply.status(400).send({
          success: false,
          error: 'No active draft found to publish.',
        });
      }

      if (draft.stages.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot publish workflow with zero pipeline stages.',
        });
      }

      // Publish transaction: archive old published, mark draft as published
      const publishedWorkflow = await prisma.$transaction(async (tx) => {
        // Archive previously published versions
        await tx.clientWorkflow.updateMany({
          where: { clientId, status: 'PUBLISHED' },
          data: { status: 'ARCHIVED' },
        });

        // Publish current draft
        const updated = await tx.clientWorkflow.update({
          where: { id: draft.id },
          data: {
            status: 'PUBLISHED',
            changeSummary,
            publishedAt: new Date(),
            publishedById: user.id,
          },
          include: {
            stages: { where: { isArchived: false }, orderBy: { order: 'asc' } },
            rounds: { where: { isActive: true }, orderBy: { order: 'asc' } },
            submissionRules: { take: 1 },
          },
        });

        return updated;
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CLIENT_WORKFLOW_PUBLISHED',
          entity: 'client_workflow',
          entityId: publishedWorkflow.id,
          after: {
            clientId,
            version: publishedWorkflow.version,
            changeSummary,
          },
          ipAddress: '127.0.0.1',
        },
      });

      return reply.send({
        success: true,
        data: publishedWorkflow,
        message: `Version ${publishedWorkflow.version} published successfully.`,
      });
    }
  );

  // -------------------------------------------------------------
  // 5. GET /api/clients/:clientId/workflow/versions (Version History)
  // -------------------------------------------------------------
  server.get(
    '/:clientId/workflow/versions',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, error: 'Unauthorized' });

      const { clientId } = request.params as { clientId: string };
      const client = await verifyClientAccess(clientId, user.organizationId);
      if (!client) {
        return reply.status(404).send({ success: false, error: 'Client not found' });
      }

      const versions = await prisma.clientWorkflow.findMany({
        where: { clientId },
        include: {
          _count: { select: { stages: true, rounds: true } },
        },
        orderBy: { version: 'desc' },
      });

      // Fetch publisher names
      const publisherIds = Array.from(new Set(versions.map((v) => v.publishedById).filter(Boolean) as string[]));
      const publishers = publisherIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: publisherIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const publisherMap = new Map(publishers.map((p) => [p.id, p.name]));

      return reply.send({
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
      });
    }
  );
};
