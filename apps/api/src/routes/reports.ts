/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  ReportQuerySchema,
  SaveReportViewSchema,
  CreateClientReportScheduleSchema,
  UpdateClientReportScheduleSchema,
  REPORT_COLUMN_CATALOG,
  ALLOWED_LINKED_ENTITIES,
  SUPPORTED_GROUP_BY_DIMENSIONS,
  generateReportExport,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';
import { executeReportQuery, fetchClientReportData } from '../services/report-builder.js';
import { clientReportQueue } from '../queue/client-report-queue.js';

export const reportsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper: Write Audit Log
  async function logReportAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    after?: Record<string, any>
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          after: after || {},
        },
      });
    } catch {
      // Non-blocking
    }
  }

  // ==========================================
  // 1. CUSTOM REPORT BUILDER (FRAME 37)
  // ==========================================

  // GET /api/reports/builder/config — Column Catalog & Metadata
  server.get(
    '/builder/config',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      return reply.send({
        success: true,
        data: {
          catalog: REPORT_COLUMN_CATALOG,
          linkedEntities: ALLOWED_LINKED_ENTITIES,
          supportedGroupBy: SUPPORTED_GROUP_BY_DIMENSIONS,
          userRole: user.role,
          canAccessSensitive: user.role === UserRole.ADMIN,
        },
      });
    }
  );

  // POST /api/reports/preview — 5-row live preview
  server.post(
    '/preview',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const parseRes = ReportQuerySchema.safeParse(request.body);
      if (!parseRes.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_QUERY', message: parseRes.error.errors[0]?.message },
        });
      }

      try {
        const result = await executeReportQuery({
          organizationId: user.organizationId,
          user,
          query: {
            ...parseRes.data,
            limit: parseRes.data.limit || 5, // Default exactly 5 rows for preview
          },
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(403).send({
          success: false,
          error: { code: 'REPORT_QUERY_ERROR', message: err.message },
        });
      }
    }
  );

  // GET /api/reports/saved — List saved report views
  server.get(
    '/saved',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;

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
          shares: {
            include: {
              sharedWithUser: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: reports.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          primaryEntity: r.primaryEntity,
          linkedEntities: r.linkedEntities,
          selectedColumns: r.selectedColumns,
          groupBy: r.groupBy,
          sortBy: r.sortBy,
          sortDirection: r.sortDirection,
          filters: r.filters,
          isShared: r.isShared,
          isOwner: r.ownerId === user.id,
          ownerName: r.owner.name,
          version: r.version,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          shares: r.shares.map((s) => ({ userId: s.sharedWithUserId, userName: s.sharedWithUser.name })),
        })),
      });
    }
  );

  // POST /api/reports/saved — Create saved report view
  server.post(
    '/saved',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const parseRes = SaveReportViewSchema.safeParse(request.body);
      if (!parseRes.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0]?.message },
        });
      }

      const input = parseRes.data;

      const report = await prisma.reportDefinition.create({
        data: {
          organizationId: user.organizationId,
          ownerId: user.id,
          name: input.name,
          description: input.description,
          primaryEntity: input.primaryEntity,
          linkedEntities: input.linkedEntities,
          selectedColumns: input.selectedColumns,
          groupBy: input.groupBy,
          sortBy: input.sortBy,
          sortDirection: input.sortDirection,
          filters: input.filters,
          isShared: input.isShared,
          shares: input.isShared && input.sharedWithUserIds.length > 0
            ? {
                create: input.sharedWithUserIds.map((uid) => ({
                  sharedWithUserId: uid,
                })),
              }
            : undefined,
        },
      });

      await logReportAudit(user.id, 'CREATE_SAVED_REPORT', 'REPORT_DEFINITION', report.id, {
        name: report.name,
        primaryEntity: report.primaryEntity,
      });

      return reply.status(201).send({
        success: true,
        data: report,
      });
    }
  );

  // GET /api/reports/saved/:id — Fetch saved report view
  server.get(
    '/saved/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const report = await prisma.reportDefinition.findFirst({
        where: {
          id,
          organizationId: user.organizationId,
          isArchived: false,
          OR: [
            { ownerId: user.id },
            { isShared: true },
            { shares: { some: { sharedWithUserId: user.id } } },
          ],
        },
        include: {
          owner: { select: { id: true, name: true } },
          shares: { include: { sharedWithUser: { select: { id: true, name: true } } } },
        },
      });

      if (!report) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Saved report view not found or access denied.' },
        });
      }

      return reply.send({
        success: true,
        data: report,
      });
    }
  );

  // PATCH /api/reports/saved/:id — Update saved report view
  server.patch(
    '/saved/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const existing = await prisma.reportDefinition.findFirst({
        where: { id, organizationId: user.organizationId, ownerId: user.id, isArchived: false },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report view not found or you do not have edit permission.' },
        });
      }

      const body = request.body as any;

      const updated = await prisma.reportDefinition.update({
        where: { id },
        data: {
          name: body.name ?? existing.name,
          description: body.description ?? existing.description,
          selectedColumns: body.selectedColumns ?? existing.selectedColumns,
          groupBy: body.groupBy !== undefined ? body.groupBy : existing.groupBy,
          sortBy: body.sortBy !== undefined ? body.sortBy : existing.sortBy,
          sortDirection: body.sortDirection ?? existing.sortDirection,
          filters: body.filters ?? existing.filters,
          isShared: body.isShared !== undefined ? body.isShared : existing.isShared,
          version: { increment: 1 },
        },
      });

      await logReportAudit(user.id, 'UPDATE_SAVED_REPORT', 'REPORT_DEFINITION', id, {
        version: updated.version,
      });

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // DELETE /api/reports/saved/:id — Soft Archive saved report view
  server.delete(
    '/saved/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const existing = await prisma.reportDefinition.findFirst({
        where: { id, organizationId: user.organizationId, ownerId: user.id },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report view not found.' },
        });
      }

      await prisma.reportDefinition.update({
        where: { id },
        data: { isArchived: true },
      });

      await logReportAudit(user.id, 'ARCHIVE_SAVED_REPORT', 'REPORT_DEFINITION', id);

      return reply.send({
        success: true,
        message: 'Report view archived successfully.',
      });
    }
  );

  // POST /api/reports/export — Export report in CSV or Excel
  server.post(
    '/export',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const body = request.body as any;

      const parseRes = ReportQuerySchema.safeParse(body);
      if (!parseRes.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_QUERY', message: parseRes.error.errors[0]?.message },
        });
      }

      const format = (body.format === 'XLSX' ? 'XLSX' : 'CSV') as 'CSV' | 'XLSX';

      try {
        const result = await executeReportQuery({
          organizationId: user.organizationId,
          user,
          query: {
            ...parseRes.data,
            limit: 10000, // Export up to 10,000 records
          },
        });

        // Headers
        const catalog = REPORT_COLUMN_CATALOG[parseRes.data.primaryEntity];
        const catalogMap = new Map(catalog.map((c) => [c.key, c.label]));
        const headers = result.columns.map((col) => ({
          key: col,
          label: catalogMap.get(col) || col,
        }));

        const exportResult = generateReportExport(format, headers, result.rows, body.reportName || 'Custom Report');

        // Create ExportRequest record for audit and tracking
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileKey = `reports/${user.organizationId}/${timestamp}_${parseRes.data.primaryEntity.toLowerCase()}.${exportResult.extension}`;
        const fileName = `hireflow_${parseRes.data.primaryEntity.toLowerCase()}_${timestamp}.${exportResult.extension}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const exportRecord = await prisma.exportRequest.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            entityType: parseRes.data.primaryEntity,
            format,
            selectedColumns: result.columns,
            filters: parseRes.data.filters,
            status: 'READY',
            fileKey,
            fileName,
            fileSize: Buffer.byteLength(exportResult.content, 'utf-8'),
            rowCount: result.rows.length,
            expiresAt,
          },
        });

        await logReportAudit(user.id, 'EXPORT_REPORT', 'EXPORT_REQUEST', exportRecord.id, {
          format,
          rowCount: result.rows.length,
          primaryEntity: parseRes.data.primaryEntity,
        });

        reply.header('Content-Type', exportResult.mimeType);
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.send(exportResult.content);
      } catch (err: any) {
        return reply.status(403).send({
          success: false,
          error: { code: 'EXPORT_ERROR', message: err.message },
        });
      }
    }
  );

  // ==========================================
  // 2. SCHEDULED CLIENT REPORTS (FRAME 38)
  // ==========================================

  // GET /api/reports/client-schedules — List all client report schedules
  server.get(
    '/client-schedules',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;

      const schedules = await prisma.clientReportSchedule.findMany({
        where: {
          organizationId: user.organizationId,
          isArchived: false,
        },
        include: {
          client: { select: { id: true, legalName: true, code: true, status: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch recipient contact details
      const allRecipientIds = Array.from(new Set(schedules.flatMap((s) => s.recipientIds)));
      const contacts = await prisma.clientContact.findMany({
        where: { id: { in: allRecipientIds } },
        select: { id: true, name: true, email: true, isPrimary: true },
      });
      const contactMap = new Map(contacts.map((c) => [c.id, c]));

      const data = schedules.map((s) => ({
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
        lastDeliveredAt: s.lastDeliveredAt,
        nextDeliveryAt: s.nextDeliveryAt,
        recipients: s.recipientIds.map((id) => contactMap.get(id)).filter(Boolean),
        includeSections: s.includeSections,
        creatorName: s.creator.name,
        createdAt: s.createdAt,
      }));

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // POST /api/reports/client-schedules — Create client schedule
  server.post(
    '/client-schedules',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const parseRes = CreateClientReportScheduleSchema.safeParse(request.body);
      if (!parseRes.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0]?.message },
        });
      }

      const input = parseRes.data;

      // 1. Verify Client
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, organizationId: user.organizationId, isArchived: false },
      });
      if (!client) {
        return reply.status(404).send({
          success: false,
          error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found or archived.' },
        });
      }

      // 2. Verify Recipients
      const verifiedContacts = await prisma.clientContact.findMany({
        where: {
          id: { in: input.recipientIds },
          clientId: input.clientId,
        },
      });

      if (verifiedContacts.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_RECIPIENTS', message: 'No valid active contacts found for this client.' },
        });
      }

      // 3. Create Schedule
      const schedule = await prisma.clientReportSchedule.create({
        data: {
          organizationId: user.organizationId,
          clientId: input.clientId,
          creatorId: user.id,
          name: input.name,
          frequency: input.frequency,
          deliveryDay: input.deliveryDay,
          deliveryTime: input.deliveryTime,
          timezone: input.timezone || 'Asia/Kolkata',
          period: input.period,
          recipientIds: verifiedContacts.map((c) => c.id),
          includeSections: input.includeSections,
          status: 'DRAFT',
          version: 1,
        },
      });

      // 4. Create Initial Version Snapshot
      await prisma.clientReportScheduleVersion.create({
        data: {
          scheduleId: schedule.id,
          version: 1,
          snapshot: schedule as any,
          changedById: user.id,
          changeNotes: 'Initial schedule created in DRAFT state.',
        },
      });

      await logReportAudit(user.id, 'CREATE_CLIENT_SCHEDULE', 'CLIENT_REPORT_SCHEDULE', schedule.id, {
        clientId: schedule.clientId,
        frequency: schedule.frequency,
      });

      return reply.status(201).send({
        success: true,
        data: schedule,
      });
    }
  );

  // GET /api/reports/client-schedules/:id — Fetch schedule details
  server.get(
    '/client-schedules/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const schedule = await prisma.clientReportSchedule.findFirst({
        where: { id, organizationId: user.organizationId, isArchived: false },
        include: {
          client: true,
          creator: { select: { id: true, name: true } },
          versions: {
            orderBy: { version: 'desc' },
            include: { changedBy: { select: { name: true } } },
          },
        },
      });

      if (!schedule) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found.' },
        });
      }

      const contacts = await prisma.clientContact.findMany({
        where: { id: { in: schedule.recipientIds } },
      });

      return reply.send({
        success: true,
        data: {
          ...schedule,
          recipients: contacts,
        },
      });
    }
  );

  // PATCH /api/reports/client-schedules/:id — Update schedule
  server.patch(
    '/client-schedules/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const existing = await prisma.clientReportSchedule.findFirst({
        where: { id, organizationId: user.organizationId, isArchived: false },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found.' },
        });
      }

      const parseRes = UpdateClientReportScheduleSchema.safeParse(request.body);
      if (!parseRes.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0]?.message },
        });
      }

      const input = parseRes.data;
      const newVersion = existing.version + 1;

      const updated = await prisma.clientReportSchedule.update({
        where: { id },
        data: {
          name: input.name ?? existing.name,
          frequency: input.frequency ?? existing.frequency,
          deliveryDay: input.deliveryDay !== undefined ? input.deliveryDay : existing.deliveryDay,
          deliveryTime: input.deliveryTime ?? existing.deliveryTime,
          timezone: input.timezone ?? existing.timezone,
          period: input.period ?? existing.period,
          recipientIds: input.recipientIds ?? existing.recipientIds,
          includeSections: input.includeSections ?? existing.includeSections,
          status: input.status ?? existing.status,
          version: newVersion,
        },
      });

      // Snapshot version
      await prisma.clientReportScheduleVersion.create({
        data: {
          scheduleId: id,
          version: newVersion,
          snapshot: updated as any,
          changedById: user.id,
          changeNotes: input.changeNotes || 'Schedule configuration updated.',
        },
      });

      // If active, re-register repeatable job
      if (updated.status === 'ACTIVE') {
        await clientReportQueue.registerSchedule(id);
      } else {
        await clientReportQueue.unregisterSchedule(id);
      }

      await logReportAudit(user.id, 'UPDATE_CLIENT_SCHEDULE', 'CLIENT_REPORT_SCHEDULE', id, {
        version: newVersion,
        status: updated.status,
      });

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // POST /api/reports/client-schedules/:id/preview — Generate live email HTML preview
  server.post(
    '/client-schedules/:id/preview',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const schedule = await prisma.clientReportSchedule.findFirst({
        where: { id, organizationId: user.organizationId },
      });

      if (!schedule) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found.' },
        });
      }

      const reportData = await fetchClientReportData(
        user.organizationId,
        schedule.clientId,
        schedule.period,
        schedule.includeSections
      );

      const html = clientReportQueue.renderClientReportEmail(schedule.name, reportData, false);

      return reply.send({
        success: true,
        data: {
          html,
          reportData,
        },
      });
    }
  );

  // POST /api/reports/client-schedules/:id/test — Send test email preview to verified contact
  server.post(
    '/client-schedules/:id/test',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };
      const { recipientId } = (request.body as any) || {};

      const schedule = await prisma.clientReportSchedule.findFirst({
        where: { id, organizationId: user.organizationId },
      });

      if (!schedule) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found.' },
        });
      }

      const targetRecipientId = recipientId || schedule.recipientIds[0];
      if (!targetRecipientId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_RECIPIENT', message: 'No recipient selected for test delivery.' },
        });
      }

      const deliveryRes = await clientReportQueue.processReportDelivery({
        scheduleId: id,
        organizationId: user.organizationId,
        clientId: schedule.clientId,
        isTest: true,
        testRecipientId: targetRecipientId,
      });

      await logReportAudit(user.id, 'TEST_SEND_CLIENT_REPORT', 'CLIENT_REPORT_SCHEDULE', id, {
        recipientId: targetRecipientId,
        status: deliveryRes.status,
      });

      return reply.send({
        success: deliveryRes.status === 'SENT',
        data: deliveryRes,
      });
    }
  );

  // POST /api/reports/client-schedules/:id/activate — Activate schedule
  server.post(
    '/client-schedules/:id/activate',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const schedule = await prisma.clientReportSchedule.findFirst({
        where: { id, organizationId: user.organizationId, isArchived: false },
      });

      if (!schedule) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found.' },
        });
      }

      // Re-verify contacts before activation
      const verified = await prisma.clientContact.findMany({
        where: { id: { in: schedule.recipientIds }, clientId: schedule.clientId },
      });

      if (verified.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_VALID_RECIPIENTS', message: 'Cannot activate: all contacts are invalid or archived.' },
        });
      }

      const updated = await prisma.clientReportSchedule.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      await clientReportQueue.registerSchedule(id);
      await logReportAudit(user.id, 'ACTIVATE_CLIENT_SCHEDULE', 'CLIENT_REPORT_SCHEDULE', id);

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // POST /api/reports/client-schedules/:id/pause — Pause schedule
  server.post(
    '/client-schedules/:id/pause',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const updated = await prisma.clientReportSchedule.update({
        where: { id },
        data: { status: 'PAUSED' },
      });

      await clientReportQueue.unregisterSchedule(id);
      await logReportAudit(user.id, 'PAUSE_CLIENT_SCHEDULE', 'CLIENT_REPORT_SCHEDULE', id);

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // GET /api/reports/client-schedules/:id/history — Delivery execution history
  server.get(
    '/client-schedules/:id/history',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const deliveries = await prisma.clientReportDelivery.findMany({
        where: { scheduleId: id, organizationId: user.organizationId },
        orderBy: { executedAt: 'desc' },
        take: 50,
      });

      return reply.send({
        success: true,
        data: deliveries,
      });
    }
  );

  // POST /api/reports/client-schedules/:id/retry — Retry failed delivery
  server.post(
    '/client-schedules/:id/retry',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      const schedule = await prisma.clientReportSchedule.findFirst({
        where: { id, organizationId: user.organizationId },
      });

      if (!schedule) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found.' },
        });
      }

      const result = await clientReportQueue.processReportDelivery({
        scheduleId: id,
        organizationId: user.organizationId,
        clientId: schedule.clientId,
        isTest: false,
      });

      await logReportAudit(user.id, 'RETRY_CLIENT_REPORT_DELIVERY', 'CLIENT_REPORT_SCHEDULE', id, {
        status: result.status,
      });

      return reply.send({
        success: result.status === 'SENT',
        data: result,
      });
    }
  );
};
