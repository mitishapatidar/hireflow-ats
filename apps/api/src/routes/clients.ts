import { FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  can,
  UserRole,
  ClientFilterSchema,
  CreateClientSchema,
  UpdateClientSchema,
  UpdateClientCommercialSchema,
  CreateClientContactSchema,
  UpdateClientContactSchema,
  ArchiveClientSchema,
  RestoreClientSchema,
  VerifyClientDocumentSchema,
  normalizeCompanyName,
  formatClientCode,
  parseClientCode,
  ClientSummaryDTO,
  ClientDetailDTO,
  ClientCommercialDTO,
  ClientContactDTO,
  ClientJobDTO,
  ClientDocumentDTO,
  ClientMeetingDTO,
  ClientCRMStatsDTO,
  getStorageProvider,
} from '@hireflow/shared';

export const clientRoutes: FastifyPluginAsync = async (server) => {
  // Helper: Log Client Audit Event
  async function logClientEvent(
    actorId: string,
    action: string,
    clientId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'client',
          entityId: clientId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log client audit event');
    }
  }

  // -------------------------------------------------------------
  // 1. GET /api/clients (List with search, filters, pagination, stats)
  // -------------------------------------------------------------
  server.get(
    '/api/clients',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      // Candidate role cannot access Clients CRM
      if (user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Candidates cannot access Clients CRM' });
      }

      const parseResult = ClientFilterSchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid filter parameters',
          details: parseResult.error.flatten(),
        });
      }

      const filters = parseResult.data;
      const where: Prisma.ClientWhereInput = {
        organizationId: user.organizationId,
      };

      // Client role scope restriction: can only view their own client
      if (user.role === UserRole.CLIENT) {
        const clientAccess = await prisma.clientAccess.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
          select: { clientId: true },
        });
        if (!clientAccess) {
          return reply.status(403).send({ success: false, error: 'Forbidden: No active client access granted' });
        }
        where.id = clientAccess.clientId;
      }

      // Archive Filter
      if (filters.isArchived !== 'ALL') {
        where.isArchived = filters.isArchived;
      }

      // Status Filter
      if (filters.status !== 'ALL') {
        where.status = filters.status as any;
      }

      // Industry Filter
      if (filters.industry) {
        where.industry = { equals: filters.industry, mode: 'insensitive' };
      }

      // Relationship Owner Filter
      if (filters.relationshipOwnerId) {
        where.relationshipOwnerId = filters.relationshipOwnerId;
      }

      // Multi-Field Search
      if (filters.search && filters.search.trim().length > 0) {
        const s = filters.search.trim();
        where.OR = [
          { legalName: { contains: s, mode: 'insensitive' } },
          { code: { contains: s, mode: 'insensitive' } },
          { industry: { contains: s, mode: 'insensitive' } },
          { website: { contains: s, mode: 'insensitive' } },
          {
            contacts: {
              some: {
                OR: [
                  { name: { contains: s, mode: 'insensitive' } },
                  { email: { contains: s, mode: 'insensitive' } },
                ],
              },
            },
          },
        ];
      }

      // Pagination & Ordering
      const skip = (filters.page - 1) * filters.limit;
      const take = filters.limit;
      const orderBy: Prisma.ClientOrderByWithRelationInput = {
        [filters.sortBy]: filters.sortOrder,
      };

      try {
        const now = new Date();
        const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Fetch paginated data, total count, and live statistics in parallel
        const [
          total,
          clients,
          activeCount,
          prospectCount,
          meetingsCount,
        ] = await Promise.all([
          prisma.client.count({ where }),
          prisma.client.findMany({
            where,
            skip,
            take,
            orderBy,
            include: {
              relationshipOwner: {
                select: { id: true, name: true, email: true },
              },
              contacts: {
                where: { isPrimary: true },
                take: 1,
                select: { id: true, name: true, email: true, designation: true },
              },
              _count: {
                select: {
                  jobs: { where: { status: 'ACTIVE' } },
                },
              },
            },
          }),
          // Stats: Active clients (non-archived, ACTIVE)
          prisma.client.count({
            where: { organizationId: user.organizationId, isArchived: false, status: 'ACTIVE' },
          }),
          // Stats: Prospects (non-archived, PROSPECT)
          prisma.client.count({
            where: { organizationId: user.organizationId, isArchived: false, status: 'PROSPECT' },
          }),
          // Stats: Scheduled meetings across organization in next 30 days
          prisma.meeting.count({
            where: {
              client: { organizationId: user.organizationId, isArchived: false },
              scheduledAt: { gte: now, lte: thirtyDaysAhead },
            },
          }),
        ]);

        // STRICT DTO SERIALIZATION: NEVER EXPOSE COMMERCIAL FIELDS IN SUMMARY
        const serializedClients: ClientSummaryDTO[] = clients.map((c) => ({
          id: c.id,
          code: c.code,
          legalName: c.legalName,
          industry: c.industry,
          website: c.website,
          location: c.location,
          status: c.status as any,
          isArchived: c.isArchived,
          archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
          archiveReason: c.archiveReason,
          nextStep: c.nextStep,
          primaryContact: c.contacts[0]
            ? {
                id: c.contacts[0].id,
                name: c.contacts[0].name,
                email: c.contacts[0].email,
                designation: c.contacts[0].designation,
              }
            : null,
          openJobsCount: c._count.jobs,
          relationshipOwner: c.relationshipOwner,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }));

        const stats: ClientCRMStatsDTO = {
          activeCount,
          prospectCount,
          meetingsCount,
        };

        return reply.send({
          success: true,
          data: {
            clients: serializedClients,
            stats,
            pagination: {
              total,
              page: filters.page,
              limit: filters.limit,
              totalPages: Math.ceil(total / filters.limit) || 1,
            },
          },
        });
      } catch (err: any) {
        server.log.error(err, 'Failed to fetch clients list');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 2. GET /api/clients/:id (Detailed Client Record)
  // -------------------------------------------------------------
  server.get(
    '/api/clients/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      // Client role access boundary
      if (user.role === UserRole.CLIENT) {
        const clientAccess = await prisma.clientAccess.findFirst({
          where: { userId: user.id, clientId: id, status: 'ACTIVE' },
        });
        if (!clientAccess) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Access denied to this client record' });
        }
      }

      try {
        const client = await prisma.client.findFirst({
          where: { id, organizationId: user.organizationId },
          include: {
            relationshipOwner: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: {
                jobs: { where: { status: 'ACTIVE' } },
                contacts: true,
                documents: true,
                meetings: true,
              },
            },
          },
        });

        if (!client) {
          return reply.status(404).send({ success: false, error: 'Client not found' });
        }

        // STRICT DTO SERIALIZATION (Zero leakage of commercial terms)
        const dto: ClientDetailDTO = {
          id: client.id,
          code: client.code,
          legalName: client.legalName,
          industry: client.industry,
          website: client.website,
          location: client.location,
          status: client.status as any,
          isArchived: client.isArchived,
          archivedAt: client.archivedAt ? client.archivedAt.toISOString() : null,
          archiveReason: client.archiveReason,
          nextStep: client.nextStep,
          relationshipOwner: client.relationshipOwner,
          openJobsCount: client._count.jobs,
          contactsCount: client._count.contacts,
          documentsCount: client._count.documents,
          meetingsCount: client._count.meetings,
          createdAt: client.createdAt.toISOString(),
          updatedAt: client.updatedAt.toISOString(),
        };

        return reply.send({ success: true, data: dto });
      } catch (err: any) {
        server.log.error(err, 'Failed to fetch client details');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 3. POST /api/clients (Concurrency-safe creation with CL-XXXX code)
  // -------------------------------------------------------------
  server.post(
    '/api/clients',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      // Role check: Only ADMIN, MANAGER, or RECRUITER can create client records
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient permissions to create clients' });
      }

      const parseResult = CreateClientSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;
      const normalizedInputName = normalizeCompanyName(input.legalName);

      try {
        // Concurrency-safe atomic transaction for code generation & creation
        const created = await prisma.$transaction(async (tx) => {
          // 1. Duplicate check by normalized company name
          const existingClients = await tx.client.findMany({
            where: { organizationId: user.organizationId, isArchived: false },
            select: { id: true, code: true, legalName: true },
          });

          for (const existing of existingClients) {
            if (normalizeCompanyName(existing.legalName) === normalizedInputName) {
              throw new Error(`DUPLICATE_CLIENT_NAME:${existing.legalName} (${existing.code})`);
            }
          }

          // 2. Concurrency-safe client code generation (CL-1001, CL-1002...)
          const lastClients = await tx.client.findMany({
            where: {
              organizationId: user.organizationId,
              code: { startsWith: 'CL-' },
            },
            select: { code: true },
          });

          let maxSeq = 1000;
          for (const c of lastClients) {
            const seq = parseClientCode(c.code);
            if (seq && seq > maxSeq) {
              maxSeq = seq;
            }
          }
          const nextCode = formatClientCode(maxSeq + 1);

          // 3. Create Client
          const newClient = await tx.client.create({
            data: {
              code: nextCode,
              legalName: input.legalName.trim(),
              industry: input.industry?.trim() || null,
              website: input.website?.trim() || null,
              location: input.location?.trim() || null,
              relationshipOwnerId: input.relationshipOwnerId || user.id,
              organizationId: user.organizationId,
              status: input.status as any,
              nextStep: input.nextStep?.trim() || null,
              commercialTerms: input.commercialTerms?.trim() || null,
              feePercentage: input.feePercentage !== undefined && input.feePercentage !== null
                ? new Prisma.Decimal(input.feePercentage)
                : null,
              paymentTerms: input.paymentTerms?.trim() || 'NET_30',
              relationshipNotes: input.relationshipNotes?.trim() || null,
              createdById: user.id,
            },
          });

          // 4. Create primary contact if supplied
          if (input.primaryContact) {
            await tx.clientContact.create({
              data: {
                clientId: newClient.id,
                name: input.primaryContact.name.trim(),
                designation: input.primaryContact.designation?.trim() || null,
                email: input.primaryContact.email.trim().toLowerCase(),
                phone: input.primaryContact.phone?.trim() || null,
                contactType: 'PRIMARY',
                isPrimary: true,
                createdById: user.id,
              },
            });
          }

          return newClient;
        });

        // 5. Audit Log
        await logClientEvent(user.id, 'CLIENT_CREATED', created.id, null, {
          code: created.code,
          legalName: created.legalName,
          status: created.status,
        }, request.ip);

        return reply.status(201).send({
          success: true,
          data: {
            id: created.id,
            code: created.code,
            legalName: created.legalName,
            status: created.status,
          },
        });
      } catch (err: any) {
        if (err.message?.startsWith('DUPLICATE_CLIENT_NAME:')) {
          const existingInfo = err.message.replace('DUPLICATE_CLIENT_NAME:', '');
          return reply.status(409).send({
            success: false,
            error: `A client with similar name already exists: ${existingInfo}. Duplicate client creation is blocked.`,
            code: 'DUPLICATE_CLIENT_NAME',
          });
        }
        server.log.error(err, 'Failed to create client');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 4. PATCH /api/clients/:id (Update Company Profile)
  // -------------------------------------------------------------
  server.patch(
    '/api/clients/:id',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = UpdateClientSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      try {
        const existing = await prisma.client.findFirst({
          where: { id, organizationId: user.organizationId },
        });

        if (!existing) {
          return reply.status(404).send({ success: false, error: 'Client not found' });
        }

        const updateData: Prisma.ClientUpdateInput = {};
        if (input.legalName !== undefined) updateData.legalName = input.legalName.trim();
        if (input.industry !== undefined) updateData.industry = input.industry?.trim() || null;
        if (input.website !== undefined) updateData.website = input.website?.trim() || null;
        if (input.location !== undefined) updateData.location = input.location?.trim() || null;
        if (input.relationshipOwnerId !== undefined) {
          updateData.relationshipOwner = input.relationshipOwnerId
            ? { connect: { id: input.relationshipOwnerId } }
            : { disconnect: true };
        }
        if (input.status !== undefined) updateData.status = input.status as any;
        if (input.nextStep !== undefined) updateData.nextStep = input.nextStep?.trim() || null;

        const updated = await prisma.client.update({
          where: { id },
          data: updateData,
        });

        await logClientEvent(
          user.id,
          'CLIENT_UPDATED',
          id,
          { legalName: existing.legalName, status: existing.status },
          { legalName: updated.legalName, status: updated.status },
          request.ip
        );

        return reply.send({ success: true, data: { id: updated.id, code: updated.code, legalName: updated.legalName } });
      } catch (err: any) {
        server.log.error(err, 'Failed to update client');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 5. GET /api/clients/:id/commercial (INTERNAL-ONLY Commercial Panel)
  // -------------------------------------------------------------
  server.get(
    '/api/clients/:id/commercial',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      // SECURITY COMMANDMENT: NEVER EXPOSE TO CLIENT OR CANDIDATE
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({
          success: false,
          error: 'Access Denied: Internal commercial information is restricted to authorized agency staff.',
        });
      }

      // Recruiter view grant check
      if (user.role === UserRole.RECRUITER && !user.grants?.recruiterViewInternalFees) {
        return reply.status(403).send({
          success: false,
          error: 'Permission Denied: Your recruiter role requires recruiterViewInternalFees permission grant.',
        });
      }

      try {
        const client = await prisma.client.findFirst({
          where: { id, organizationId: user.organizationId },
          select: {
            id: true,
            commercialTerms: true,
            feePercentage: true,
            paymentTerms: true,
            relationshipNotes: true,
            updatedAt: true,
          },
        });

        if (!client) {
          return reply.status(404).send({ success: false, error: 'Client not found' });
        }

        const dto: ClientCommercialDTO = {
          clientId: client.id,
          commercialTerms: client.commercialTerms,
          feePercentage: client.feePercentage ? Number(client.feePercentage) : null,
          paymentTerms: client.paymentTerms,
          relationshipNotes: client.relationshipNotes,
          updatedAt: client.updatedAt.toISOString(),
        };

        return reply.send({ success: true, data: dto });
      } catch (err: any) {
        server.log.error(err, 'Failed to fetch commercial data');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 6. PATCH /api/clients/:id/commercial (Update Commercial Terms)
  // -------------------------------------------------------------
  server.patch(
    '/api/clients/:id/commercial',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      // Commercial modifications restricted to ADMIN
      if (user.role !== UserRole.ADMIN) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: Only Admin users can modify client commercial fee structures.',
        });
      }

      const parseResult = UpdateClientCommercialSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      try {
        const existing = await prisma.client.findFirst({
          where: { id, organizationId: user.organizationId },
          select: {
            commercialTerms: true,
            feePercentage: true,
            paymentTerms: true,
            relationshipNotes: true,
          },
        });

        if (!existing) {
          return reply.status(404).send({ success: false, error: 'Client not found' });
        }

        const updateData: Prisma.ClientUpdateInput = {};
        if (input.commercialTerms !== undefined) updateData.commercialTerms = input.commercialTerms?.trim() || null;
        if (input.feePercentage !== undefined) {
          updateData.feePercentage = input.feePercentage !== null
            ? new Prisma.Decimal(input.feePercentage)
            : null;
        }
        if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms?.trim() || 'NET_30';
        if (input.relationshipNotes !== undefined) updateData.relationshipNotes = input.relationshipNotes?.trim() || null;

        const updated = await prisma.client.update({
          where: { id },
          data: updateData,
        });

        await logClientEvent(
          user.id,
          'CLIENT_COMMERCIAL_UPDATED',
          id,
          {
            commercialTerms: existing.commercialTerms,
            feePercentage: existing.feePercentage ? Number(existing.feePercentage) : null,
          },
          {
            commercialTerms: updated.commercialTerms,
            feePercentage: updated.feePercentage ? Number(updated.feePercentage) : null,
          },
          request.ip
        );

        return reply.send({ success: true, message: 'Commercial terms updated successfully' });
      } catch (err: any) {
        server.log.error(err, 'Failed to update commercial data');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 7. POST /api/clients/:id/archive & /restore (Soft Archive)
  // -------------------------------------------------------------
  server.post(
    '/api/clients/:id/archive',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role !== UserRole.ADMIN) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Admin role required to archive clients' });
      }

      const parseResult = ArchiveClientSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Archive reason is mandatory (minimum 3 characters)',
        });
      }

      try {
        const client = await prisma.client.findFirst({
          where: { id, organizationId: user.organizationId },
        });

        if (!client) {
          return reply.status(404).send({ success: false, error: 'Client not found' });
        }

        const updated = await prisma.client.update({
          where: { id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            archiveReason: parseResult.data.reason.trim(),
          },
        });

        await logClientEvent(user.id, 'CLIENT_ARCHIVED', id, { isArchived: false }, { isArchived: true, reason: parseResult.data.reason }, request.ip);

        return reply.send({
          success: true,
          message: 'Client archived successfully',
          data: { id: updated.id, isArchived: true },
        });
      } catch (err: any) {
        server.log.error(err, 'Failed to archive client');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  server.post(
    '/api/clients/:id/restore',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role !== UserRole.ADMIN) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Admin role required to restore clients' });
      }

      const parseResult = RestoreClientSchema.safeParse(request.body);

      try {
        const client = await prisma.client.findFirst({
          where: { id, organizationId: user.organizationId },
        });

        if (!client) {
          return reply.status(404).send({ success: false, error: 'Client not found' });
        }

        const updated = await prisma.client.update({
          where: { id },
          data: {
            isArchived: false,
            archivedAt: null,
            archiveReason: null,
          },
        });

        await logClientEvent(
          user.id,
          'CLIENT_RESTORED',
          id,
          { isArchived: true, reason: client.archiveReason },
          { isArchived: false, reason: parseResult.data?.reason || 'Restored by admin' },
          request.ip
        );

        return reply.send({
          success: true,
          message: 'Client restored successfully',
          data: { id: updated.id, isArchived: false },
        });
      } catch (err: any) {
        server.log.error(err, 'Failed to restore client');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 8. CONTACTS: GET & POST /api/clients/:id/contacts
  // -------------------------------------------------------------
  server.get(
    '/api/clients/:id/contacts',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      try {
        const contacts = await prisma.clientContact.findMany({
          where: { clientId: id, client: { organizationId: user.organizationId } },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        });

        // Determine portal access status using Prompt 6 ClientAccess records
        const contactEmails = contacts.map((c) => c.email.toLowerCase());
        const portalUsers = await prisma.user.findMany({
          where: {
            email: { in: contactEmails },
            role: UserRole.CLIENT,
            clientAccesses: { some: { clientId: id, status: 'ACTIVE' } },
          },
          select: { id: true, email: true, status: true },
        });

        const portalUserMap = new Map(portalUsers.map((u) => [u.email.toLowerCase(), u]));

        const dtos: ClientContactDTO[] = contacts.map((c) => {
          const pu = portalUserMap.get(c.email.toLowerCase());
          return {
            id: c.id,
            clientId: c.clientId,
            name: c.name,
            designation: c.designation,
            email: c.email,
            phone: c.phone,
            contactType: c.contactType,
            isPrimary: c.isPrimary,
            hasPortalAccess: !!pu,
            portalUserId: pu ? pu.id : null,
            portalUserStatus: pu ? pu.status : null,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          };
        });

        return reply.send({ success: true, data: dtos });
      } catch (err: any) {
        server.log.error(err, 'Failed to fetch client contacts');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  server.post(
    '/api/clients/:id/contacts',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const parseResult = CreateClientContactSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      try {
        const client = await prisma.client.findFirst({
          where: { id, organizationId: user.organizationId },
        });

        if (!client) {
          return reply.status(404).send({ success: false, error: 'Client not found' });
        }

        const contact = await prisma.$transaction(async (tx) => {
          if (input.isPrimary) {
            // Unset other primary contacts for this client
            await tx.clientContact.updateMany({
              where: { clientId: id, isPrimary: true },
              data: { isPrimary: false },
            });
          }

          return tx.clientContact.create({
            data: {
              clientId: id,
              name: input.name.trim(),
              designation: input.designation?.trim() || null,
              email: input.email.trim().toLowerCase(),
              phone: input.phone?.trim() || null,
              contactType: input.contactType || 'HIRING_MANAGER',
              isPrimary: input.isPrimary,
              createdById: user.id,
            },
          });
        });

        await logClientEvent(user.id, 'CLIENT_CONTACT_CREATED', id, null, { contactId: contact.id, name: contact.name, email: contact.email }, request.ip);

        return reply.status(201).send({ success: true, data: contact });
      } catch (err: any) {
        server.log.error(err, 'Failed to create client contact');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 9. JOBS: GET /api/clients/:id/jobs
  // -------------------------------------------------------------
  server.get(
    '/api/clients/:id/jobs',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      try {
        const jobs = await prisma.job.findMany({
          where: { clientId: id, client: { organizationId: user.organizationId } },
          orderBy: { createdAt: 'desc' },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            hiringManagerContact: { select: { id: true, name: true, email: true } },
            _count: { select: { applications: true } },
          },
        });

        const dtos: ClientJobDTO[] = jobs.map((j) => ({
          id: j.id,
          code: j.code,
          title: j.title,
          status: j.status,
          openings: j.openings,
          candidateCount: j._count.applications,
          owner: j.owner,
          hiringManager: j.hiringManagerContact,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        }));

        return reply.send({ success: true, data: dtos });
      } catch (err: any) {
        server.log.error(err, 'Failed to fetch client jobs');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 10. DOCUMENTS: GET, POST, & VERIFY /api/clients/:id/documents
  // -------------------------------------------------------------
  server.get(
    '/api/clients/:id/documents',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      try {
        const documents = await prisma.clientDocument.findMany({
          where: { clientId: id, client: { organizationId: user.organizationId } },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        });

        // Resolve verifier and uploader names
        const userIds = Array.from(
          new Set(
            documents
              .flatMap((d) => [d.createdById, d.verifiedById])
              .filter((x): x is string => !!x)
          )
        );

        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        });

        const userMap = new Map(users.map((u) => [u.id, u.name]));

        const dtos: ClientDocumentDTO[] = documents.map((d) => ({
          id: d.id,
          clientId: d.clientId,
          fileName: d.fileName,
          storageKey: d.storageKey,
          storageBucket: d.storageBucket,
          documentType: d.documentType,
          version: d.version,
          fileSize: d.fileSize || 0,
          mimeType: d.mimeType || 'application/pdf',
          checksum: d.checksum,
          isVerified: d.isVerified,
          verifiedBy: d.verifiedById ? { id: d.verifiedById, name: userMap.get(d.verifiedById) || 'Internal User' } : null,
          verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
          uploadedBy: d.createdById ? { id: d.createdById, name: userMap.get(d.createdById) || 'Internal Staff' } : null,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        }));

        return reply.send({ success: true, data: dtos });
      } catch (err: any) {
        server.log.error(err, 'Failed to fetch client documents');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  server.post(
    '/api/clients/:id/documents/:docId/verify',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id, docId } = request.params as { id: string; docId: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden: Only Admin or Manager can verify client legal documents',
        });
      }

      const parseResult = VerifyClientDocumentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: 'Invalid verification state' });
      }

      const { isVerified } = parseResult.data;

      try {
        const doc = await prisma.clientDocument.findFirst({
          where: { id: docId, clientId: id, client: { organizationId: user.organizationId } },
        });

        if (!doc) {
          return reply.status(404).send({ success: false, error: 'Document not found' });
        }

        const updated = await prisma.clientDocument.update({
          where: { id: docId },
          data: {
            isVerified,
            verifiedById: isVerified ? user.id : null,
            verifiedAt: isVerified ? new Date() : null,
          },
        });

        await logClientEvent(
          user.id,
          'CLIENT_DOCUMENT_VERIFICATION_CHANGED',
          id,
          { docId, previousVerified: doc.isVerified },
          { docId, isVerified: updated.isVerified, verifiedById: user.id },
          request.ip
        );

        return reply.send({
          success: true,
          message: `Document ${isVerified ? 'marked as verified' : 'unverified'}`,
          data: { id: updated.id, isVerified: updated.isVerified },
        });
      } catch (err: any) {
        server.log.error(err, 'Failed to update document verification');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  server.get(
    '/api/clients/:id/documents/:docId/download',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id, docId } = request.params as { id: string; docId: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      try {
        const doc = await prisma.clientDocument.findFirst({
          where: { id: docId, clientId: id, client: { organizationId: user.organizationId } },
        });

        if (!doc) {
          return reply.status(404).send({ success: false, error: 'Document not found' });
        }

        const storage = getStorageProvider();
        const signedUrl = await storage.getSignedUrl(doc.storageKey || doc.fileUrl, 900); // 15 min expiry

        return reply.send({ success: true, signedUrl, fileName: doc.fileName });
      } catch (err: any) {
        server.log.error(err, 'Failed to generate signed download URL');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // -------------------------------------------------------------
  // 11. MEETINGS & ACTIVITY: GET /api/clients/:id/activity
  // -------------------------------------------------------------
  server.get(
    '/api/clients/:id/activity',
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = request.user;
      const { id } = request.params as { id: string };

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      try {
        const [meetings, auditLogs] = await Promise.all([
          prisma.meeting.findMany({
            where: { clientId: id, client: { organizationId: user.organizationId } },
            orderBy: { scheduledAt: 'desc' },
          }),
          prisma.auditLog.findMany({
            where: { entity: 'client', entityId: id },
            orderBy: { createdAt: 'desc' },
            take: 30,
          }),
        ]);

        const userIds = Array.from(
          new Set([
            ...meetings.map((m) => m.organizerId),
            ...auditLogs.map((a) => a.actorId),
          ].filter(Boolean))
        );

        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        const timeline: any[] = [];

        for (const m of meetings) {
          const org = userMap.get(m.organizerId);
          timeline.push({
            id: `meeting-${m.id}`,
            type: 'MEETING',
            title: m.title,
            description: m.notes,
            timestamp: m.scheduledAt.toISOString(),
            status: m.status,
            meetingType: m.meetingType,
            participants: m.participants,
            actor: org ? { id: org.id, name: org.name, email: org.email } : null,
          });
        }

        for (const a of auditLogs) {
          const actor = userMap.get(a.actorId);
          timeline.push({
            id: `audit-${a.id}`,
            type: 'AUDIT_LOG',
            title: a.action.replace(/_/g, ' '),
            description: a.after ? JSON.stringify(a.after) : null,
            timestamp: a.createdAt.toISOString(),
            actor: actor ? { id: actor.id, name: actor.name, email: actor.email } : null,
          });
        }

        // Sort unified timeline descending by timestamp
        timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return reply.send({ success: true, data: timeline });
      } catch (err: any) {
        server.log.error(err, 'Failed to fetch client activity');
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );
};
