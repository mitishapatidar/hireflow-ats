/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  LogRecruiterActivitySchema,
  UpdateRecruiterTargetSchema,
} from '@hireflow/shared';
import { MetricsService } from '../services/metrics.js';

export const activityRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Write Audit Log
  async function logActivityAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log activity audit log');
    }
  }

  // Guard: Restrict to Internal Staff
  function verifyInternalStaff(user: any) {
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      const err: any = new Error('Access denied: Recruiter activity tracking is restricted to internal agency team members');
      err.statusCode = 403;
      throw err;
    }
  }

  // 1. GET /daily (and GET /)
  const getDailyActivityHandler = async (request: any, reply: any) => {
    const user = request.user;
    verifyInternalStaff(user);

    const query = request.query as any;
    const targetDate = query.date ? new Date(query.date) : new Date();

    const data = await MetricsService.getRecruiterDailyActivityData(
      user.id,
      user.role as UserRole,
      user.organizationId,
      targetDate
    );

    return reply.status(200).send({
      success: true,
      data,
    });
  };

  server.get('/daily', { preHandler: [(server as any).authenticate] }, getDailyActivityHandler);
  server.get('/', { preHandler: [(server as any).authenticate] }, getDailyActivityHandler);

  // 2. POST /log — Log manual recruiter activity (call, meeting, task, note)
  server.post('/log', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parseResult = LogRecruiterActivitySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid activity details provided',
          details: parseResult.error.flatten(),
        },
      });
    }

    const {
      type,
      relatedCandidateId,
      relatedClientId,
      relatedOpportunityId,
      durationMinutes,
      outcome,
      notes,
      date,
    } = parseResult.data;

    const createdAt = date ? new Date(date) : new Date();

    const activity = await prisma.recruiterActivity.create({
      data: {
        actorId: user.id,
        organizationId: user.organizationId,
        type,
        relatedCandidateId: relatedCandidateId || null,
        relatedClientId: relatedClientId || null,
        relatedOpportunityId: relatedOpportunityId || null,
        durationMinutes: durationMinutes ?? null,
        outcome: outcome || null,
        notes,
        createdAt,
      },
      include: {
        relatedCandidate: { select: { id: true, name: true, email: true } },
        relatedClient: { select: { id: true, legalName: true } },
        relatedOpportunity: { select: { id: true, title: true, companyName: true } },
      },
    });

    await logActivityAudit(
      user.id,
      'RECRUITER_ACTIVITY_LOGGED',
      'RecruiterActivity',
      activity.id,
      null,
      { type, outcome, durationMinutes, notes },
      request.ip
    );

    return reply.status(201).send({
      success: true,
      data: activity,
    });
  });

  // 3. GET /targets — Get current targets
  server.get('/targets', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const query = request.query as any;
    const period = query.period || 'DAILY';

    let target = await prisma.recruiterTarget.findUnique({
      where: {
        userId_period: {
          userId: user.id,
          period,
        },
      },
    });

    if (!target) {
      target = {
        id: 'default-target',
        userId: user.id,
        organizationId: user.organizationId,
        period,
        targetCandidatesSourced: 10,
        targetCalls: 20,
        targetEmails: 15,
        targetSubmissions: 3,
        targetInterviews: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return reply.status(200).send({
      success: true,
      data: target,
    });
  });

  // 4. PATCH /targets — Update targets
  server.patch('/targets', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const parseResult = UpdateRecruiterTargetSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid target parameters provided',
          details: parseResult.error.flatten(),
        },
      });
    }

    const {
      period,
      targetCandidatesSourced,
      targetCalls,
      targetEmails,
      targetSubmissions,
      targetInterviews,
    } = parseResult.data;

    const existingTarget = await prisma.recruiterTarget.findUnique({
      where: {
        userId_period: {
          userId: user.id,
          period,
        },
      },
    });

    const target = await prisma.recruiterTarget.upsert({
      where: {
        userId_period: {
          userId: user.id,
          period,
        },
      },
      update: {
        targetCandidatesSourced,
        targetCalls,
        targetEmails,
        targetSubmissions,
        targetInterviews,
      },
      create: {
        userId: user.id,
        organizationId: user.organizationId,
        period,
        targetCandidatesSourced,
        targetCalls,
        targetEmails,
        targetSubmissions,
        targetInterviews,
      },
    });

    await logActivityAudit(
      user.id,
      'RECRUITER_TARGET_UPDATED',
      'RecruiterTarget',
      target.id,
      existingTarget,
      target,
      request.ip
    );

    return reply.status(200).send({
      success: true,
      data: target,
    });
  });

  // 5. GET /recent — List recently logged activities
  server.get('/recent', { preHandler: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    verifyInternalStaff(user);

    const isRestrictedRecruiter = user.role === UserRole.RECRUITER;

    const activities = await prisma.recruiterActivity.findMany({
      where: {
        organizationId: user.organizationId,
        ...(isRestrictedRecruiter ? { actorId: user.id } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        relatedCandidate: { select: { id: true, name: true } },
        relatedClient: { select: { id: true, legalName: true } },
        relatedOpportunity: { select: { id: true, title: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return reply.status(200).send({
      success: true,
      data: activities,
    });
  });
};
