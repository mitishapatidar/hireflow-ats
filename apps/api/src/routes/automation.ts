/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  CreateAutomationRuleSchema,
  UpdateAutomationRuleSchema,
  AutomationPreviewSchema,
  replaceMergeFields,
  STANDARD_AUTOMATION_RULE_PRESETS,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';
import { digestQueue } from '../queue/digest-queue.js';

export const automationRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Write Audit Log
  async function logAutomationAudit(
    actorId: string,
    action: string,
    targetId: string,
    details?: Record<string, any>
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'AUTOMATION_RULE',
          entityId: targetId,
          after: details || {},
        },
      });
    } catch {
      // Non-blocking
    }
  }

  // 1. GET /api/automation/rules — Fetch all automation rules
  server.get(
    '/rules',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      let rules = await prisma.automationRule.findMany({
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
      });

      // Auto-seed standard presets if empty
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

      return reply.send({ success: true, data: rules });
    }
  );

  // 2. POST /api/automation/rules — Create new rule (Admin only)
  server.post(
    '/rules',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const user = request.user!;
      const parseResult = CreateAutomationRuleSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid automation rule payload',
            details: parseResult.error.issues,
          },
        });
      }

      const data = parseResult.data;

      const rule = await prisma.automationRule.create({
        data: {
          name: data.name,
          description: data.description,
          triggerEvent: data.triggerEvent,
          timing: data.timing as any,
          conditions: data.conditions as any,
          actions: {},
          clientScope: data.clientScope,
          recipients: data.recipients as any,
          channels: data.channels as any,
          templateId: data.templateId,
          templateSubject: data.templateSubject,
          templateBody: data.templateBody,
          status: data.status,
          isActive: data.status === 'ACTIVE',
          createdById: user.id,
        },
      });

      await logAutomationAudit(user.id, 'AUTOMATION_RULE_CREATED', rule.id, {
        name: rule.name,
        triggerEvent: rule.triggerEvent,
      });

      return reply.status(201).send({ success: true, data: rule });
    }
  );

  // 3. PATCH /api/automation/rules/:id — Update rule / create new version
  server.patch(
    '/rules/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const parseResult = UpdateAutomationRuleSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid automation rule update payload',
            details: parseResult.error.issues,
          },
        });
      }

      const existing = await prisma.automationRule.findUnique({ where: { id } });
      if (!existing || existing.isArchived) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Automation rule not found' },
        });
      }

      const data = parseResult.data;

      const updated = await prisma.automationRule.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          triggerEvent: data.triggerEvent,
          timing: data.timing as any,
          conditions: data.conditions as any,
          clientScope: data.clientScope,
          recipients: data.recipients as any,
          channels: data.channels as any,
          templateId: data.templateId,
          templateSubject: data.templateSubject,
          templateBody: data.templateBody,
          status: data.status,
          isActive: data.status ? data.status === 'ACTIVE' : undefined,
          version: { increment: 1 }, // Version increments on edit
        },
      });

      await logAutomationAudit(user.id, 'AUTOMATION_RULE_UPDATED', id, {
        version: updated.version,
        name: updated.name,
      });

      return reply.send({ success: true, data: updated });
    }
  );

  // 4. POST /api/automation/rules/:id/activate — Activate Rule
  server.post(
    '/rules/:id/activate',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const existing = await prisma.automationRule.findUnique({ where: { id } });
      if (!existing || existing.isArchived) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Automation rule not found' },
        });
      }

      const updated = await prisma.automationRule.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          isActive: true,
        },
      });

      await logAutomationAudit(user.id, 'AUTOMATION_RULE_ACTIVATED', id, { status: 'ACTIVE' });

      return reply.send({ success: true, data: updated });
    }
  );

  // 5. POST /api/automation/rules/:id/pause — Pause Rule
  server.post(
    '/rules/:id/pause',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const existing = await prisma.automationRule.findUnique({ where: { id } });
      if (!existing || existing.isArchived) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Automation rule not found' },
        });
      }

      const updated = await prisma.automationRule.update({
        where: { id },
        data: {
          status: 'PAUSED',
          isActive: false,
        },
      });

      await logAutomationAudit(user.id, 'AUTOMATION_RULE_PAUSED', id, { status: 'PAUSED' });

      return reply.send({ success: true, data: updated });
    }
  );

  // 6. POST /api/automation/preview — Test merge fields & preview message
  server.post(
    '/preview',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const parseResult = AutomationPreviewSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preview payload',
            details: parseResult.error.issues,
          },
        });
      }

      const { templateBody, templateSubject, context, isCandidateFacing } = parseResult.data;

      const bodyResult = replaceMergeFields(templateBody, context, isCandidateFacing);
      const subjectResult = templateSubject
        ? replaceMergeFields(templateSubject, context, isCandidateFacing)
        : { text: '', missingFields: [], sanitized: false };

      return reply.send({
        success: true,
        data: {
          renderedSubject: subjectResult.text,
          renderedBody: bodyResult.text,
          missingFields: Array.from(new Set([...bodyResult.missingFields, ...subjectResult.missingFields])),
          sanitized: bodyResult.sanitized || subjectResult.sanitized,
        },
      });
    }
  );

  // 7. GET /api/automation/executions — View execution history log
  server.get(
    '/executions',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string; ruleId?: string };
      const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
      const offset = Math.max(0, parseInt(query.offset || '0', 10));

      const whereClause: any = {};
      if (query.ruleId) {
        whereClause.ruleId = query.ruleId;
      }

      const [items, totalCount] = await Promise.all([
        prisma.automationExecution.findMany({
          where: whereClause,
          include: {
            rule: {
              select: { id: true, name: true, triggerEvent: true },
            },
          },
          orderBy: { startedAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.automationExecution.count({ where: whereClause }),
      ]);

      return reply.send({
        success: true,
        data: { items, totalCount, limit, offset },
      });
    }
  );

  // 8. GET /api/digests/today — Get or generate today's pending digest
  server.get(
    '/digests/today',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request, reply) => {
      const user = request.user!;
      const todayStr = new Date().toISOString().substring(0, 10);

      // Check if already generated
      let digest = await prisma.dailyDigest.findUnique({
        where: {
          userId_digestDate_channel: {
            userId: user.id,
            digestDate: todayStr,
            channel: 'IN_APP',
          },
        },
      });

      if (!digest) {
        await digestQueue.generateAndSendDigest(user.id, todayStr);
        digest = await prisma.dailyDigest.findUnique({
          where: {
            userId_digestDate_channel: {
              userId: user.id,
              digestDate: todayStr,
              channel: 'IN_APP',
            },
          },
        });
      }

      return reply.send({ success: true, data: digest });
    }
  );
};
