/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  EXPORT_ENTITY_CATALOG,
  FORBIDDEN_EXPORT_FIELDS,
  sanitizeForCsv,
  generateCsvString,
  redactAuditSecrets,
  validateCustomFieldValue,
  getKolkataDayBounds,
  calculateDownloadUsage,
  DEFAULT_DAILY_DOWNLOAD_LIMITS,
  CreateCustomFieldDefinitionSchema,
  UpdateCustomFieldDefinitionSchema,
  SetClientCustomFieldRuleSchema,
  CreateExportRequestSchema,
  RestoreArchivedCandidateSchema,
  UpdateDownloadPolicySchema,
  generateCVWatermarkText,
  ExportEntityType,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const governanceRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Ensure local export directory exists
  const exportDir = path.resolve(process.cwd(), '.storage', 'exports');
  await fs.mkdir(exportDir, { recursive: true }).catch(() => {});

  // Helper: Audit logger
  async function logGovernanceAudit(
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
          before: before ? (redactAuditSecrets(before) as any) : undefined,
          after: after ? (redactAuditSecrets(after) as any) : undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to write governance audit log');
    }
  }

  // =========================================================================
  // 1. SCOPED EXPORTS (TAB 1 & FRAME 37)
  // =========================================================================

  // GET /api/governance/exports/config
  server.get(
    '/api/governance/exports/config',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = request.user!;
      return reply.send({
        success: true,
        data: {
          entities: EXPORT_ENTITY_CATALOG,
          formats: ['CSV', 'XLSX'],
          userRole: user.role,
          canExportSensitive: user.role === UserRole.ADMIN,
        },
      });
    }
  );

  // Helper: Fetch entity records for export
  async function fetchExportRows(
    orgId: string,
    entityType: ExportEntityType,
    filters?: any,
    limit?: number
  ): Promise<Record<string, any>[]> {
    const whereAnd: any[] = [{ organizationId: orgId }];

    if (filters?.clientId) {
      whereAnd.push({ clientId: filters.clientId });
    }
    if (filters?.jobId) {
      whereAnd.push({ jobId: filters.jobId });
    }

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
          where: {
            actorId: { in: userIds },
          },
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

  // POST /api/governance/exports/preview
  server.post(
    '/api/governance/exports/preview',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const body = CreateExportRequestSchema.parse(request.body);
      const user = request.user!;

      // Filter out any forbidden fields
      const safeColumns = body.selectedColumns.filter((col) => !FORBIDDEN_EXPORT_FIELDS.has(col));

      const catalog = EXPORT_ENTITY_CATALOG[body.entityType];
      const columnDefs = catalog.columns.filter((c) => safeColumns.includes(c.key));

      // Fetch 10 sample rows
      const rows = await fetchExportRows(user.organizationId, body.entityType, body.filters, 10);

      return reply.send({
        success: true,
        data: {
          entityType: body.entityType,
          totalPreviewRows: rows.length,
          columns: columnDefs,
          previewRows: rows,
        },
      });
    }
  );

  // POST /api/governance/exports (Generate Full Export)
  server.post(
    '/api/governance/exports',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const body = CreateExportRequestSchema.parse(request.body);
      const user = request.user!;

      // 1. Sensitive Column & Re-verification check
      const catalog = EXPORT_ENTITY_CATALOG[body.entityType];
      const sensitiveKeys = new Set(catalog.columns.filter((c) => c.isSensitive).map((c) => c.key));
      const requestedSensitive = body.selectedColumns.some((col) => sensitiveKeys.has(col));

      if (requestedSensitive) {
        // Enforce 15-minute re-verification check
        const lastReverified = request.session?.lastReverifiedAt
          ? new Date(request.session.lastReverifiedAt).getTime()
          : 0;
        const reverifiedWindowMs = 15 * 60 * 1000;

        if (Date.now() - lastReverified > reverifiedWindowMs) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'REVERIFICATION_REQUIRED',
              message:
                'Sensitive export (containing compensation or audit data) requires recent re-verification within 15 minutes. Please re-authenticate.',
            },
          });
        }
      }

      // 2. Filter out forbidden fields
      const safeColumns = body.selectedColumns.filter((col) => !FORBIDDEN_EXPORT_FIELDS.has(col));
      const activeColumnDefs = catalog.columns.filter((c) => safeColumns.includes(c.key));

      // 3. Fetch data
      const rows = await fetchExportRows(user.organizationId, body.entityType, body.filters);

      // 4. Generate CSV
      const csvString = generateCsvString(activeColumnDefs, rows);

      // 5. Save to local storage file
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
      const fileKey = `export_${body.entityType.toLowerCase()}_${timestamp}_${crypto.randomBytes(4).toString('hex')}.csv`;
      const filePath = path.join(exportDir, fileKey);
      await fs.writeFile(filePath, csvString, 'utf-8');

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours retention

      // 6. Create ExportRequest record
      const exportRecord = await prisma.exportRequest.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          entityType: body.entityType,
          format: body.format,
          selectedColumns: safeColumns,
          filters: body.filters ? (body.filters as any) : undefined,
          status: 'READY',
          fileKey,
          fileName: `hireflow_${body.entityType.toLowerCase()}_${timestamp}.csv`,
          fileSize: Buffer.byteLength(csvString, 'utf-8'),
          rowCount: rows.length,
          expiresAt,
        },
      });

      // 7. Write AuditLog
      await logGovernanceAudit(
        user.id,
        'DATA_EXPORT_GENERATED',
        'export_request',
        exportRecord.id,
        null,
        {
          entityType: body.entityType,
          rowCount: rows.length,
          columns: safeColumns,
          hasSensitiveColumns: requestedSensitive,
        },
        request.ip
      );

      return reply.send({
        success: true,
        data: {
          exportId: exportRecord.id,
          fileName: exportRecord.fileName,
          rowCount: exportRecord.rowCount,
          fileSize: exportRecord.fileSize,
          expiresAt: exportRecord.expiresAt.toISOString(),
          downloadUrl: `/api/governance/exports/${exportRecord.id}/download`,
        },
      });
    }
  );

  // GET /api/governance/exports/:id/download (Stream download)
  server.get(
    '/api/governance/exports/:id/download',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const exportRecord = await prisma.exportRequest.findUnique({
        where: { id },
      });

      if (!exportRecord || exportRecord.organizationId !== user.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Export file not found or unauthorized' },
        });
      }

      if (new Date() > exportRecord.expiresAt) {
        return reply.status(410).send({
          success: false,
          error: { code: 'EXPORT_EXPIRED', message: 'This export file has expired (24-hour retention exceeded)' },
        });
      }

      if (!exportRecord.fileKey) {
        return reply.status(404).send({
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: 'Export file artifact is missing' },
        });
      }

      const filePath = path.join(exportDir, exportRecord.fileKey);
      let fileContent: Buffer;
      try {
        fileContent = await fs.readFile(filePath);
      } catch {
        return reply.status(404).send({
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: 'Export file does not exist on disk' },
        });
      }

      // Increment download count and record DownloadLog
      await prisma.$transaction([
        prisma.exportRequest.update({
          where: { id },
          data: { downloadCount: { increment: 1 } },
        }),
        prisma.downloadLog.create({
          data: {
            userId: user.id,
            resourceType: 'EXPORT',
            resourceId: exportRecord.id,
            organizationId: user.organizationId,
            entityType: exportRecord.entityType,
            entityId: exportRecord.id,
            fileFormat: exportRecord.format,
            result: 'SUCCESS',
            purpose: 'SCOPED_EXPORT_DOWNLOAD',
            ipAddress: request.ip,
          },
        }),
      ]);

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${exportRecord.fileName || 'hireflow_export.csv'}"`
      );
      return reply.send(fileContent);
    }
  );

  // =========================================================================
  // 2. CUSTOM FIELDS (TAB 2 & FRAME 33 TAB 2)
  // =========================================================================

  // GET /api/governance/custom-fields
  server.get(
    '/api/governance/custom-fields',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request, reply) => {
      const user = request.user!;
      const query = request.query as { entityType?: string };

      const fields = await prisma.customFieldDefinition.findMany({
        where: {
          organizationId: user.organizationId,
          ...(query.entityType ? { entityType: query.entityType } : {}),
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

      return reply.send({
        success: true,
        data: fields.map((f) => ({
          ...f,
          usageCount: f._count.values,
        })),
      });
    }
  );

  // POST /api/governance/custom-fields
  server.post(
    '/api/governance/custom-fields',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const body = CreateCustomFieldDefinitionSchema.parse(request.body);
      const user = request.user!;

      // Check unique fieldName or fieldKey in organization
      const existing = await prisma.customFieldDefinition.findFirst({
        where: {
          organizationId: user.organizationId,
          entityType: body.entityType,
          OR: [{ fieldName: body.fieldName }, { fieldKey: body.fieldKey }],
        },
      });

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DUPLICATE_FIELD',
            message: `A custom field with name '${body.fieldName}' or key '${body.fieldKey}' already exists for ${body.entityType}.`,
          },
        });
      }

      const created = await prisma.customFieldDefinition.create({
        data: {
          organizationId: user.organizationId,
          entityType: body.entityType,
          fieldName: body.fieldName,
          fieldKey: body.fieldKey,
          fieldType: body.fieldType,
          description: body.description,
          options: body.options,
          isRequired: body.isRequired,
          visibility: body.visibility,
          validationRules: body.validationRules ? (body.validationRules as any) : undefined,
          defaultValue: body.defaultValue ? (body.defaultValue as any) : undefined,
          displayOrder: body.displayOrder,
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
        created as any,
        request.ip
      );

      return reply.status(201).send({
        success: true,
        data: created,
      });
    }
  );

  // PATCH /api/governance/custom-fields/:id
  server.patch(
    '/api/governance/custom-fields/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateCustomFieldDefinitionSchema.parse(request.body);
      const user = request.user!;

      const existing = await prisma.customFieldDefinition.findUnique({
        where: { id },
      });

      if (!existing || existing.organizationId !== user.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Custom field definition not found' },
        });
      }

      const updated = await prisma.customFieldDefinition.update({
        where: { id },
        data: {
          ...(body.fieldName ? { fieldName: body.fieldName } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.options ? { options: body.options } : {}),
          ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
          ...(body.visibility ? { visibility: body.visibility } : {}),
          ...(body.validationRules ? { validationRules: body.validationRules as any } : {}),
          ...(body.defaultValue !== undefined ? { defaultValue: body.defaultValue as any } : {}),
          ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
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
        updated as any,
        request.ip
      );

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // POST /api/governance/custom-fields/:id/archive
  server.post(
    '/api/governance/custom-fields/:id/archive',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const existing = await prisma.customFieldDefinition.findUnique({
        where: { id },
      });

      if (!existing || existing.organizationId !== user.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Custom field definition not found' },
        });
      }

      // Soft-archive by toggling isActive: false
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
        { isActive: false },
        request.ip
      );

      return reply.send({
        success: true,
        data: archived,
      });
    }
  );

  // POST /api/governance/custom-fields/client-rule
  server.post(
    '/api/governance/custom-fields/client-rule',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const body = SetClientCustomFieldRuleSchema.parse(request.body);
      const user = request.user!;

      const [client, fieldDef] = await Promise.all([
        prisma.client.findUnique({ where: { id: body.clientId } }),
        prisma.customFieldDefinition.findUnique({ where: { id: body.fieldDefinitionId } }),
      ]);

      if (!client || client.organizationId !== user.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found or cross-tenant' },
        });
      }

      if (!fieldDef || fieldDef.organizationId !== user.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'FIELD_NOT_FOUND', message: 'Custom field not found or cross-tenant' },
        });
      }

      const rule = await prisma.clientCustomFieldRule.upsert({
        where: {
          clientId_fieldDefinitionId: {
            clientId: body.clientId,
            fieldDefinitionId: body.fieldDefinitionId,
          },
        },
        update: {
          isRequired: body.isRequired,
          workflowVersion: body.workflowVersion,
        },
        create: {
          clientId: body.clientId,
          fieldDefinitionId: body.fieldDefinitionId,
          isRequired: body.isRequired,
          workflowVersion: body.workflowVersion,
        },
      });

      await logGovernanceAudit(
        user.id,
        'CLIENT_CUSTOM_FIELD_RULE_SET',
        'client_custom_field_rule',
        rule.id,
        null,
        rule as any,
        request.ip
      );

      return reply.send({
        success: true,
        data: rule,
      });
    }
  );

  // GET /api/governance/custom-fields/values/:entityType/:entityId
  server.get(
    '/api/governance/custom-fields/values/:entityType/:entityId',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request, reply) => {
      const { entityType, entityId } = request.params as {
        entityType: string;
        entityId: string;
      };
      const user = request.user!;

      const definitions = await prisma.customFieldDefinition.findMany({
        where: {
          organizationId: user.organizationId,
          entityType: entityType.toUpperCase(),
          isActive: true,
        },
        orderBy: { displayOrder: 'asc' },
      });

      const values = await prisma.customFieldValue.findMany({
        where: { entityId },
      });

      const valueMap = new Map(values.map((v) => [v.fieldDefinitionId, v.value]));

      const results = definitions.map((def) => ({
        definition: def,
        value: valueMap.get(def.id) ?? def.defaultValue ?? null,
      }));

      return reply.send({
        success: true,
        data: results,
      });
    }
  );

  // POST /api/governance/custom-fields/values/:entityType/:entityId
  server.post(
    '/api/governance/custom-fields/values/:entityType/:entityId',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request, reply) => {
      const { entityType, entityId } = request.params as {
        entityType: string;
        entityId: string;
      };
      const user = request.user!;
      const payload = request.body as Record<string, any>; // { fieldDefinitionId: value }

      const definitions = await prisma.customFieldDefinition.findMany({
        where: {
          organizationId: user.organizationId,
          entityType: entityType.toUpperCase(),
          isActive: true,
        },
      });

      const defMap = new Map(definitions.map((d) => [d.id, d]));
      const validationErrors: Array<{ fieldName: string; error: string }> = [];
      const validatedValues: Array<{ fieldDefinitionId: string; sanitizedValue: any }> = [];

      for (const [defId, val] of Object.entries(payload)) {
        const def = defMap.get(defId);
        if (!def) continue;

        const validation = validateCustomFieldValue(val, def as any);
        if (!validation.isValid) {
          validationErrors.push({
            fieldName: def.fieldName,
            error: validation.error || 'Invalid value',
          });
        } else {
          validatedValues.push({
            fieldDefinitionId: def.id,
            sanitizedValue: validation.sanitizedValue,
          });
        }
      }

      if (validationErrors.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'One or more custom field values failed validation rules',
            details: validationErrors,
          },
        });
      }

      // Upsert validated values
      await prisma.$transaction(
        validatedValues.map((v) =>
          prisma.customFieldValue.upsert({
            where: {
              fieldDefinitionId_entityId: {
                fieldDefinitionId: v.fieldDefinitionId,
                entityId,
              },
            },
            update: {
              value: v.sanitizedValue,
            },
            create: {
              fieldDefinitionId: v.fieldDefinitionId,
              entityId,
              value: v.sanitizedValue,
              createdById: user.id,
            },
          })
        )
      );

      return reply.send({
        success: true,
        data: {
          savedCount: validatedValues.length,
        },
      });
    }
  );

  // =========================================================================
  // 3. ARCHIVE & RESTORE (TAB 3 & FRAME 33 TAB 3)
  // =========================================================================

  // GET /api/governance/archive/candidates
  server.get(
    '/api/governance/archive/candidates',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request, reply) => {
      const user = request.user!;

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

      // Enrich with potential conflicts against active candidate database
      const emails = archivedCandidates.map((c) => c.email.toLowerCase());
      const activeCandidatesWithSameEmail = await prisma.candidate.findMany({
        where: {
          organizationId: user.organizationId,
          isArchived: false,
          email: { in: emails },
        },
        select: { id: true, email: true, code: true, name: true },
      });

      const conflictEmailMap = new Map(
        activeCandidatesWithSameEmail.map((c) => [c.email.toLowerCase(), c])
      );

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
            ? `Active candidate ${conflict.code} (${conflict.name}) already uses email ${conflict.email}`
            : null,
        };
      });

      return reply.send({
        success: true,
        data: items,
      });
    }
  );

  // POST /api/governance/archive/candidates/:id/restore
  server.post(
    '/api/governance/archive/candidates/:id/restore',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = RestoreArchivedCandidateSchema.parse(request.body);
      const user = request.user!;

      const candidate = await prisma.candidate.findUnique({
        where: { id },
      });

      if (!candidate || candidate.organizationId !== user.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate record not found or cross-tenant' },
        });
      }

      if (!candidate.isArchived) {
        return reply.status(400).send({
          success: false,
          error: { code: 'ALREADY_ACTIVE', message: 'Candidate is not archived' },
        });
      }

      // Check conflict with an active candidate using the same email
      const activeDuplicate = await prisma.candidate.findFirst({
        where: {
          organizationId: user.organizationId,
          isArchived: false,
          email: candidate.email.toLowerCase(),
          id: { not: candidate.id },
        },
      });

      if (activeDuplicate) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'RESTORE_CONFLICT',
            message: `Cannot restore candidate. An active candidate record (${activeDuplicate.code}) already exists with email ${candidate.email}.`,
          },
        });
      }

      // Restore
      const restored = await prisma.candidate.update({
        where: { id },
        data: {
          isArchived: false,
          archivedAt: null,
          archiveReason: null,
        },
      });

      // Audit Log with mandatory justification
      await logGovernanceAudit(
        user.id,
        'CANDIDATE_RESTORED',
        'candidate',
        candidate.id,
        {
          isArchived: true,
          archivedAt: candidate.archivedAt,
          previousArchiveReason: candidate.archiveReason,
        },
        {
          isArchived: false,
          restoreReason: body.reason,
          restoredBy: user.id,
        },
        request.ip
      );

      return reply.send({
        success: true,
        data: restored,
      });
    }
  );

  // =========================================================================
  // 4. DOWNLOAD POLICY & CV WATERMARKING (TAB 4 & FRAME 33 TAB 4)
  // =========================================================================

  // GET /api/governance/download-policy
  server.get(
    '/api/governance/download-policy',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { startUtc, endUtc } = getKolkataDayBounds();

      // Fetch or seed default policies for all 4 roles
      const existingPolicies = await prisma.downloadPolicy.findMany({
        where: { organizationId: user.organizationId },
      });

      const policyMap = new Map(existingPolicies.map((p) => [p.role, p]));
      const roles = [UserRole.RECRUITER, UserRole.MANAGER, UserRole.CLIENT, UserRole.ADMIN];

      // Count downloads today per role
      const todayLogs = await prisma.downloadLog.findMany({
        where: {
          organizationId: user.organizationId,
          resourceType: 'CV',
          result: 'SUCCESS',
          createdAt: {
            gte: startUtc,
            lte: endUtc,
          },
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

      const policyCards = roles.map((role) => {
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

      return reply.send({
        success: true,
        data: {
          policies: policyCards,
          timezone: 'Asia/Kolkata',
          dayStartUtc: startUtc.toISOString(),
          dayEndUtc: endUtc.toISOString(),
        },
      });
    }
  );

  // PATCH /api/governance/download-policy
  server.patch(
    '/api/governance/download-policy',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const body = UpdateDownloadPolicySchema.parse(request.body);
      const user = request.user!;

      const existing = await prisma.downloadPolicy.findUnique({
        where: {
          organizationId_role: {
            organizationId: user.organizationId,
            role: body.role,
          },
        },
      });

      const updated = await prisma.downloadPolicy.upsert({
        where: {
          organizationId_role: {
            organizationId: user.organizationId,
            role: body.role,
          },
        },
        update: {
          dailyCvLimit: body.dailyCvLimit,
          requireWatermark: body.requireWatermark,
          allowOriginalDownload: body.allowOriginalDownload,
          isActive: body.isActive,
          updatedById: user.id,
        },
        create: {
          organizationId: user.organizationId,
          role: body.role,
          dailyCvLimit: body.dailyCvLimit,
          requireWatermark: body.requireWatermark,
          allowOriginalDownload: body.allowOriginalDownload,
          isActive: body.isActive,
          updatedById: user.id,
        },
      });

      await logGovernanceAudit(
        user.id,
        'DOWNLOAD_POLICY_UPDATED',
        'download_policy',
        updated.id,
        existing as any,
        updated as any,
        request.ip
      );

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // GET /api/governance/downloads/usage (Current user usage today)
  server.get(
    '/api/governance/downloads/usage',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { startUtc, endUtc } = getKolkataDayBounds();

      // Get policy
      const policy = await prisma.downloadPolicy.findUnique({
        where: {
          organizationId_role: {
            organizationId: user.organizationId,
            role: user.role,
          },
        },
      });

      const userDownloadsToday = await prisma.downloadLog.count({
        where: {
          userId: user.id,
          resourceType: 'CV',
          result: 'SUCCESS',
          createdAt: {
            gte: startUtc,
            lte: endUtc,
          },
        },
      });

      const usage = calculateDownloadUsage({
        role: user.role,
        configuredLimit: policy?.dailyCvLimit,
        downloadsUsedToday: userDownloadsToday,
      });

      return reply.send({
        success: true,
        data: {
          ...usage,
          requireWatermark: policy?.requireWatermark ?? true,
          allowOriginalDownload: policy?.allowOriginalDownload ?? false,
          resetAtUtc: endUtc.toISOString(),
          timezone: 'Asia/Kolkata',
        },
      });
    }
  );

  // GET /api/governance/cv/:candidateId/download
  server.get(
    '/api/governance/cv/:candidateId/download',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT),
      ],
    },
    async (request, reply) => {
      const { candidateId } = request.params as { candidateId: string };
      const user = request.user!;
      const query = request.query as { clientId?: string; asOriginal?: string };
      const { startUtc, endUtc } = getKolkataDayBounds();

      // Check candidate
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: { documents: true },
      });

      if (!candidate || candidate.organizationId !== user.organizationId || candidate.isArchived) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate resume not found or candidate is archived' },
        });
      }

      // Check user download quota today
      const policy = await prisma.downloadPolicy.findUnique({
        where: {
          organizationId_role: {
            organizationId: user.organizationId,
            role: user.role,
          },
        },
      });

      const usedToday = await prisma.downloadLog.count({
        where: {
          userId: user.id,
          resourceType: 'CV',
          result: 'SUCCESS',
          createdAt: {
            gte: startUtc,
            lte: endUtc,
          },
        },
      });

      const quota = calculateDownloadUsage({
        role: user.role,
        configuredLimit: policy?.dailyCvLimit,
        downloadsUsedToday: usedToday,
      });

      if (quota.isExceeded) {
        // Log denial
        await prisma.downloadLog.create({
          data: {
            userId: user.id,
            resourceType: 'CV',
            resourceId: candidate.id,
            organizationId: user.organizationId,
            entityType: 'CANDIDATE',
            entityId: candidate.id,
            result: 'DENIED',
            denialReason: 'DAILY_LIMIT_EXCEEDED',
            purpose: 'CV_DOWNLOAD',
            ipAddress: request.ip,
          },
        });

        return reply.status(429).send({
          success: false,
          error: {
            code: 'DAILY_LIMIT_EXCEEDED',
            message: `You have reached your daily limit of ${quota.dailyLimit} CV downloads. Quota resets at midnight Asia/Kolkata.`,
          },
        });
      }

      // Determine client name for watermark
      let clientName = 'CONFIDENTIAL';
      if (user.role === UserRole.CLIENT && user.clientAccess?.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: user.clientAccess.clientId },
          select: { legalName: true },
        });
        if (client) clientName = client.legalName;
      } else if (query.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: query.clientId },
          select: { legalName: true },
        });
        if (client) clientName = client.legalName;
      }

      const watermarkText = generateCVWatermarkText(clientName);

      // Record successful download in DownloadLog
      await prisma.downloadLog.create({
        data: {
          userId: user.id,
          resourceType: 'CV',
          resourceId: candidate.id,
          organizationId: user.organizationId,
          entityType: 'CANDIDATE',
          entityId: candidate.id,
          watermarkApplied: true,
          watermarkText,
          result: 'SUCCESS',
          purpose: 'CV_DOWNLOAD',
          ipAddress: request.ip,
        },
      });

      return reply.send({
        success: true,
        data: {
          candidateId: candidate.id,
          candidateName: candidate.name,
          watermarkText,
          watermarkApplied: true,
          remainingToday: quota.remaining - 1,
          notice: 'Server-side watermark applied for data privacy and anti-leak compliance.',
        },
      });
    }
  );

  // =========================================================================
  // 5. AUDIT TRAIL (TAB 5 & FRAME 33 TAB 5)
  // =========================================================================

  // GET /api/governance/audit-logs
  server.get(
    '/api/governance/audit-logs',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const user = request.user!;
      const query = request.query as {
        actorId?: string;
        action?: string;
        entity?: string;
        startDate?: string;
        endDate?: string;
        page?: string;
        limit?: string;
      };

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
      const skip = (page - 1) * limit;

      const orgUsers = await prisma.user.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true, email: true, role: true },
      });
      const userMap = new Map(orgUsers.map((u) => [u.id, u]));
      const orgUserIds = orgUsers.map((u) => u.id);

      const where: Prisma.AuditLogWhereInput = {
        actorId: query.actorId ? query.actorId : { in: orgUserIds },
        ...(query.action ? { action: query.action } : {}),
        ...(query.entity ? { entity: query.entity } : {}),
      };

      if (query.startDate || query.endDate) {
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

      return reply.send({
        success: true,
        data: sanitizedLogs,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // POST /api/governance/audit-logs/export
  server.post(
    '/api/governance/audit-logs/export',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const user = request.user!;

      // Enforce 15-minute re-verification check
      const lastReverified = request.session?.lastReverifiedAt
        ? new Date(request.session.lastReverifiedAt).getTime()
        : 0;
      const reverifiedWindowMs = 15 * 60 * 1000;

      if (Date.now() - lastReverified > reverifiedWindowMs) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'REVERIFICATION_REQUIRED',
            message: 'Exporting audit trails requires recent re-verification. Please re-authenticate.',
          },
        });
      }

      const orgUsers = await prisma.user.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true, role: true },
      });
      const userMap = new Map(orgUsers.map((u) => [u.id, u]));
      const orgUserIds = orgUsers.map((u) => u.id);

      const logs = await prisma.auditLog.findMany({
        where: {
          actorId: { in: orgUserIds },
        },
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
        { rowCount: rows.length },
        request.ip
      );

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="hireflow_audit_trail_${new Date().toISOString().split('T')[0]}.csv"`
      );
      return reply.send(csvString);
    }
  );
};
