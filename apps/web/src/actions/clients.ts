'use server';

import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  UserRole,
  ClientFilterSchema,
  ClientFilterInput,
  CreateClientSchema,
  CreateClientInput,
  UpdateClientSchema,
  UpdateClientInput,
  UpdateClientCommercialSchema,
  UpdateClientCommercialInput,
  CreateClientContactSchema,
  CreateClientContactInput,
  ArchiveClientSchema,
  RestoreClientSchema,
  normalizeCompanyName,
  formatClientCode,
  parseClientCode,
  ClientSummaryDTO,
  ClientDetailDTO,
  ClientCommercialDTO,
  ClientContactDTO,
  ClientJobDTO,
  ClientDocumentDTO,
  ClientActivityDTO,
  ClientCRMStatsDTO,
  ClientStatus,
  getStorageProvider,
  validateFileSecurity,
} from '@hireflow/shared';

// Helper: Log Client Audit Event
async function logClientEvent(
  actorId: string,
  action: string,
  clientId: string,
  before?: Prisma.InputJsonValue | null,
  after?: Prisma.InputJsonValue | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'client',
        entityId: clientId,
        before: before ?? Prisma.JsonNull,
        after: after ?? Prisma.JsonNull,
        ipAddress: '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('[logClientEvent] Error logging audit event:', err);
  }
}

// -------------------------------------------------------------
// 1. getClientsAction (List with search, filters, pagination, stats)
// -------------------------------------------------------------
export async function getClientsAction(rawFilters: Partial<ClientFilterInput> = {}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden: Candidates cannot access Clients CRM' };
  }

  const parseResult = ClientFilterSchema.safeParse(rawFilters);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid filter parameters', details: parseResult.error.flatten() };
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
      return { success: false, error: 'Forbidden: No active client access granted' };
    }
    where.id = clientAccess.clientId;
  }

  // Archive Filter
  if (filters.isArchived !== 'ALL') {
    where.isArchived = filters.isArchived;
  }

  // Status Filter
  if (filters.status !== 'ALL') {
    where.status = filters.status;
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

    const [total, clients, activeCount, prospectCount, meetingsCount] = await Promise.all([
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
      prisma.client.count({
        where: { organizationId: user.organizationId, isArchived: false, status: 'ACTIVE' },
      }),
      prisma.client.count({
        where: { organizationId: user.organizationId, isArchived: false, status: 'PROSPECT' },
      }),
      prisma.meeting.count({
        where: {
          client: { organizationId: user.organizationId, isArchived: false },
          scheduledAt: { gte: now, lte: thirtyDaysAhead },
        },
      }),
    ]);

    // STRICT DTO SERIALIZATION: NEVER EXPOSE COMMERCIAL FIELDS
    const serializedClients: ClientSummaryDTO[] = clients.map((c) => ({
      id: c.id,
      code: c.code,
      legalName: c.legalName,
      industry: c.industry,
      website: c.website,
      location: c.location,
      status: c.status as ClientStatus,
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

    return {
      success: true,
      clients: serializedClients,
      stats,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  } catch (err: unknown) {
    console.error('[getClientsAction] Error:', err);
    return { success: false, error: 'Failed to fetch clients list' };
  }
}

// -------------------------------------------------------------
// 2. getClientAction (Detail Record)
// -------------------------------------------------------------
export async function getClientAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
  }

  if (user.role === UserRole.CLIENT) {
    const clientAccess = await prisma.clientAccess.findFirst({
      where: { userId: user.id, clientId: id, status: 'ACTIVE' },
    });
    if (!clientAccess) {
      return { success: false, error: 'Forbidden: Access denied to this client' };
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
      return { success: false, error: 'Client not found' };
    }

    const dto: ClientDetailDTO = {
      id: client.id,
      code: client.code,
      legalName: client.legalName,
      industry: client.industry,
      website: client.website,
      location: client.location,
      status: client.status as ClientStatus,
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

    return { success: true, client: dto };
  } catch (err: unknown) {
    console.error('[getClientAction] Error:', err);
    return { success: false, error: 'Failed to fetch client' };
  }
}

// -------------------------------------------------------------
// 3. createClientAction (Concurrency-Safe CL-XXXX)
// -------------------------------------------------------------
export async function createClientAction(rawInput: CreateClientInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden: Insufficient role permissions' };
  }

  const parseResult = CreateClientSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0]?.message || 'Validation failed' };
  }

  const input = parseResult.data;
  const normalizedInputName = normalizeCompanyName(input.legalName);

  try {
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

      // 2. Concurrency-safe code sequence generation
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

      // 3. Create client
      const newClient = await tx.client.create({
        data: {
          code: nextCode,
          legalName: input.legalName.trim(),
          industry: input.industry?.trim() || null,
          website: input.website?.trim() || null,
          location: input.location?.trim() || null,
          relationshipOwnerId: input.relationshipOwnerId || user.id,
          organizationId: user.organizationId,
          status: input.status,
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

    await logClientEvent(user.id, 'CLIENT_CREATED', created.id, null, {
      code: created.code,
      legalName: created.legalName,
      status: created.status,
    });

    revalidatePath('/clients');
    return { success: true, client: { id: created.id, code: created.code, legalName: created.legalName } };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('DUPLICATE_CLIENT_NAME:')) {
      const existingInfo = err.message.replace('DUPLICATE_CLIENT_NAME:', '');
      return {
        success: false,
        error: `A client with similar name already exists: ${existingInfo}. Duplicate client creation is blocked.`,
        code: 'DUPLICATE_CLIENT_NAME',
      };
    }
    console.error('[createClientAction] Error:', err);
    return { success: false, error: 'Failed to create client record' };
  }
}

// -------------------------------------------------------------
// 4. updateClientAction (Profile Information)
// -------------------------------------------------------------
export async function updateClientAction(id: string, rawInput: UpdateClientInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
  }

  const parseResult = UpdateClientSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0]?.message || 'Validation failed' };
  }

  const input = parseResult.data;

  try {
    const existing = await prisma.client.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!existing) {
      return { success: false, error: 'Client not found' };
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
    if (input.status !== undefined) updateData.status = input.status;
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
      { legalName: updated.legalName, status: updated.status }
    );

    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    return { success: true, client: { id: updated.id, code: updated.code, legalName: updated.legalName } };
  } catch (err: unknown) {
    console.error('[updateClientAction] Error:', err);
    return { success: false, error: 'Failed to update client' };
  }
}

// -------------------------------------------------------------
// 5. getClientCommercialAction (Internal Only)
// -------------------------------------------------------------
export async function getClientCommercialAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // SECURITY: Strictly deny Client and Candidate
  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Access Denied: Internal commercial information is restricted to agency staff.' };
  }

  if (user.role === UserRole.RECRUITER && !user.grants?.recruiterViewInternalFees) {
    return { success: false, error: 'Permission Denied: Requires recruiterViewInternalFees permission grant.' };
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
      return { success: false, error: 'Client not found' };
    }

    const dto: ClientCommercialDTO = {
      clientId: client.id,
      commercialTerms: client.commercialTerms,
      feePercentage: client.feePercentage ? Number(client.feePercentage) : null,
      paymentTerms: client.paymentTerms,
      relationshipNotes: client.relationshipNotes,
      updatedAt: client.updatedAt.toISOString(),
    };

    return { success: true, commercial: dto };
  } catch (err: unknown) {
    console.error('[getClientCommercialAction] Error:', err);
    return { success: false, error: 'Failed to fetch commercial data' };
  }
}

// -------------------------------------------------------------
// 6. updateClientCommercialAction (Admin Only)
// -------------------------------------------------------------
export async function updateClientCommercialAction(id: string, rawInput: UpdateClientCommercialInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role !== UserRole.ADMIN) {
    return { success: false, error: 'Forbidden: Only Admin users can modify commercial terms.' };
  }

  const parseResult = UpdateClientCommercialSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0]?.message || 'Validation failed' };
  }

  const input = parseResult.data;

  try {
    const existing = await prisma.client.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { commercialTerms: true, feePercentage: true, paymentTerms: true, relationshipNotes: true },
    });

    if (!existing) {
      return { success: false, error: 'Client not found' };
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
      }
    );

    revalidatePath(`/clients/${id}`);
    return { success: true, message: 'Commercial terms updated successfully' };
  } catch (err: unknown) {
    console.error('[updateClientCommercialAction] Error:', err);
    return { success: false, error: 'Failed to update commercial terms' };
  }
}

// -------------------------------------------------------------
// 7. archiveClientAction & restoreClientAction (Soft Deletion)
// -------------------------------------------------------------
export async function archiveClientAction(id: string, reason: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role !== UserRole.ADMIN) {
    return { success: false, error: 'Forbidden: Admin role required to archive clients' };
  }

  const parseResult = ArchiveClientSchema.safeParse({ reason });
  if (!parseResult.success) {
    return { success: false, error: 'Archive reason is required (minimum 3 characters)' };
  }

  try {
    const client = await prisma.client.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archiveReason: parseResult.data.reason.trim(),
      },
    });

    await logClientEvent(user.id, 'CLIENT_ARCHIVED', id, { isArchived: false }, { isArchived: true, reason: parseResult.data.reason });

    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    return { success: true, message: 'Client archived successfully', client: { id: updated.id, isArchived: true } };
  } catch (err: unknown) {
    console.error('[archiveClientAction] Error:', err);
    return { success: false, error: 'Failed to archive client' };
  }
}

export async function restoreClientAction(id: string, reason?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role !== UserRole.ADMIN) {
    return { success: false, error: 'Forbidden: Admin role required to restore clients' };
  }

  const parseResult = RestoreClientSchema.safeParse({ reason });

  try {
    const client = await prisma.client.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!client) {
      return { success: false, error: 'Client not found' };
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
      { isArchived: false, reason: parseResult.data?.reason || 'Restored by admin' }
    );

    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    return { success: true, message: 'Client restored successfully', client: { id: updated.id, isArchived: false } };
  } catch (err: unknown) {
    console.error('[restoreClientAction] Error:', err);
    return { success: false, error: 'Failed to restore client' };
  }
}

// -------------------------------------------------------------
// 8. CONTACTS Actions
// -------------------------------------------------------------
export async function getClientContactsAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const contacts = await prisma.clientContact.findMany({
      where: { clientId: id, client: { organizationId: user.organizationId } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    // Check Prompt 6 ClientAccess records
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

    return { success: true, contacts: dtos };
  } catch (err: unknown) {
    console.error('[getClientContactsAction] Error:', err);
    return { success: false, error: 'Failed to fetch contacts' };
  }
}

export async function createClientContactAction(id: string, rawInput: CreateClientContactInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
  }

  const parseResult = CreateClientContactSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0]?.message || 'Validation failed' };
  }

  const input = parseResult.data;

  try {
    const client = await prisma.client.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    const contact = await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
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

    await logClientEvent(user.id, 'CLIENT_CONTACT_CREATED', id, null, { contactId: contact.id, name: contact.name, email: contact.email });

    revalidatePath(`/clients/${id}`);
    return { success: true, contact };
  } catch (err: unknown) {
    console.error('[createClientContactAction] Error:', err);
    return { success: false, error: 'Failed to add contact' };
  }
}

// -------------------------------------------------------------
// 9. JOBS Action
// -------------------------------------------------------------
export async function getClientJobsAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
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

    return { success: true, jobs: dtos };
  } catch (err: unknown) {
    console.error('[getClientJobsAction] Error:', err);
    return { success: false, error: 'Failed to fetch client jobs' };
  }
}

// -------------------------------------------------------------
// 10. DOCUMENTS Actions
// -------------------------------------------------------------
export async function getClientDocumentsAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const documents = await prisma.clientDocument.findMany({
      where: { clientId: id, client: { organizationId: user.organizationId } },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });

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

    return { success: true, documents: dtos };
  } catch (err: unknown) {
    console.error('[getClientDocumentsAction] Error:', err);
    return { success: false, error: 'Failed to fetch documents' };
  }
}

export async function uploadClientDocumentAction(clientId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden: Client contacts cannot upload agency documents directly.' };
  }

  const file = formData.get('file') as File | null;
  const documentType = (formData.get('documentType') as string) || 'AGREEMENT';

  if (!file) {
    return { success: false, error: 'No document file provided' };
  }

  try {
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: user.organizationId },
    });

    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. File Security & Magic Bytes Check
    const securityCheck = validateFileSecurity(buffer, file.name, file.type);
    if (!securityCheck.valid) {
      return { success: false, error: securityCheck.error || 'Invalid file format or malicious payload detected.' };
    }

    // 2. Upload to private object storage
    const storage = getStorageProvider();
    const uploadResult = await storage.uploadFile(buffer, {
      fileName: file.name,
      mimeType: securityCheck.detectedMime || file.type,
      fileSize: buffer.length,
      uploadedById: user.id,
    });

    // 3. Document Versioning: If same filename exists for this client, increment version
    const lastVersion = await prisma.clientDocument.findFirst({
      where: { clientId, fileName: file.name },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

    // 4. Save document record (always isVerified: false initially)
    const doc = await prisma.clientDocument.create({
      data: {
        clientId,
        fileName: file.name,
        fileUrl: uploadResult.storageKey,
        storageKey: uploadResult.storageKey,
        storageBucket: 'client-documents',
        documentType,
        version: nextVersion,
        fileSize: uploadResult.fileSize,
        mimeType: securityCheck.detectedMime || file.type,
        checksum: uploadResult.checksum,
        isVerified: false,
        createdById: user.id,
      },
    });

    await logClientEvent(user.id, 'CLIENT_DOCUMENT_UPLOADED', clientId, null, {
      docId: doc.id,
      fileName: doc.fileName,
      version: doc.version,
    });

    revalidatePath(`/clients/${clientId}`);
    return { success: true, document: doc };
  } catch (err: unknown) {
    console.error('[uploadClientDocumentAction] Error:', err);
    return { success: false, error: 'Failed to upload client document' };
  }
}

export async function verifyClientDocumentAction(clientId: string, docId: string, isVerified: boolean) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    return { success: false, error: 'Forbidden: Admin or Manager role required to verify client legal documents.' };
  }

  try {
    const doc = await prisma.clientDocument.findFirst({
      where: { id: docId, clientId, client: { organizationId: user.organizationId } },
    });

    if (!doc) {
      return { success: false, error: 'Document not found' };
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
      clientId,
      { docId, previousVerified: doc.isVerified },
      { docId, isVerified: updated.isVerified, verifiedById: user.id }
    );

    revalidatePath(`/clients/${clientId}`);
    return { success: true, message: `Document ${isVerified ? 'verified' : 'unverified'}`, isVerified: updated.isVerified };
  } catch (err: unknown) {
    console.error('[verifyClientDocumentAction] Error:', err);
    return { success: false, error: 'Failed to verify document' };
  }
}

export async function getClientDocumentSignedUrlAction(clientId: string, docId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const doc = await prisma.clientDocument.findFirst({
      where: { id: docId, clientId, client: { organizationId: user.organizationId } },
    });

    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    const storage = getStorageProvider();
    const signedUrl = await storage.getSignedUrl(doc.storageKey || doc.fileUrl, 900); // 15 min expiry

    return { success: true, signedUrl, fileName: doc.fileName };
  } catch (err: unknown) {
    console.error('[getClientDocumentSignedUrlAction] Error:', err);
    return { success: false, error: 'Failed to generate signed download link' };
  }
}

// -------------------------------------------------------------
// 11. MEETINGS & ACTIVITY Action
// -------------------------------------------------------------
export async function getClientActivityAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (user.role === UserRole.CANDIDATE) {
    return { success: false, error: 'Forbidden' };
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

    const timeline: ClientActivityDTO[] = [];

    for (const m of meetings) {
      const org = userMap.get(m.organizerId);
      timeline.push({
        id: `meeting-${m.id}`,
        type: 'MEETING',
        title: m.title,
        description: m.notes,
        timestamp: m.scheduledAt.toISOString(),
        actor: org ? { id: org.id, name: org.name, email: org.email } : null,
        metadata: {
          meetingType: m.meetingType,
          status: m.status,
          participants: m.participants,
        },
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
        metadata: { before: a.before, after: a.after },
      });
    }

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { success: true, activity: timeline };
  } catch (err: unknown) {
    console.error('[getClientActivityAction] Error:', err);
    return { success: false, error: 'Failed to fetch client activity' };
  }
}
