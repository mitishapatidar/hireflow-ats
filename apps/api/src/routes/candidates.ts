import { FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  can,
  UserRole,
  CandidateFilterSchema,
  UpdateCandidateSchema,
  CreateCandidateNoteSchema,
  CandidateHandoverSchema,
  ArchiveCandidateSchema,
  RestoreCandidateSchema,
} from '@hireflow/shared';

const candidateRoutes: FastifyPluginAsync = async (server) => {
  // Helper: Log Candidate Audit Event
  async function logCandidateEvent(
    actorId: string,
    action: string,
    candidateId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'candidate',
          entityId: candidateId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log candidate audit event');
    }
  }

  // -------------------------------------------------------------
  // 1. GET /api/candidates (List with search, filters, pagination)
  // -------------------------------------------------------------
  server.get(
    '/api/candidates',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const parsed = CandidateFilterSchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_QUERY_PARAMS',
            message: 'Invalid filter or pagination parameters',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const filters = parsed.data;
      const where: Prisma.CandidateWhereInput = {
        organizationId: user.organizationId,
      };

      // Archive filter: default false
      if (!filters.includeArchived) {
        where.isArchived = false;
      }

      // Role Scoping
      if (user.role === UserRole.RECRUITER) {
        where.ownerId = user.id;
      } else if (user.role === UserRole.MANAGER) {
        const allowedOwners = [user.id, ...(user.subordinateIds || [])];
        where.ownerId = { in: allowedOwners };
      } else if (user.role === UserRole.CLIENT) {
        if (!user.clientAccess?.clientId) {
          return reply.status(200).send({
            success: true,
            data: { candidates: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 },
          });
        }
        where.applications = {
          some: {
            job: {
              clientId: user.clientAccess.clientId,
              ...(user.clientAccess.authorizedJobIds?.length
                ? { id: { in: user.clientAccess.authorizedJobIds } }
                : {}),
            },
          },
        };
      } else if (user.role === UserRole.CANDIDATE) {
        if (!user.candidateProfileId) {
          return reply.status(200).send({
            success: true,
            data: { candidates: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 },
          });
        }
        where.id = user.candidateProfileId;
      }

      // Explicit owner filter for Admin/Manager
      if (filters.ownerId && (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER)) {
        where.ownerId = filters.ownerId;
      }

      // Free-text Search
      if (filters.search) {
        const q = filters.search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { currentTitle: { contains: q, mode: 'insensitive' } },
          { currentCompany: { contains: q, mode: 'insensitive' } },
          { skills: { has: q } },
          { tags: { some: { name: { contains: q, mode: 'insensitive' } } } },
        ];
      }

      if (filters.jobId) {
        where.applications = { some: { jobId: filters.jobId } };
      }

      if (filters.status) {
        where.applications = { some: { status: filters.status as any } };
      }

      if (filters.source) {
        where.source = { contains: filters.source, mode: 'insensitive' };
      }

      if (filters.location) {
        where.location = { contains: filters.location, mode: 'insensitive' };
      }

      if (filters.minExp !== undefined || filters.maxExp !== undefined) {
        where.experienceYears = {
          ...(filters.minExp !== undefined ? { gte: filters.minExp } : {}),
          ...(filters.maxExp !== undefined ? { lte: filters.maxExp } : {}),
        };
      }

      if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
        where.expectedSalary = {
          ...(filters.minSalary !== undefined ? { gte: filters.minSalary } : {}),
          ...(filters.maxSalary !== undefined ? { lte: filters.maxSalary } : {}),
        };
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { some: { name: { in: filters.tags } } };
      }

      const skip = (filters.page - 1) * filters.limit;
      const take = filters.limit;
      const orderBy = { [filters.sortBy]: filters.sortOrder };

      const [total, candidates] = await Promise.all([
        prisma.candidate.count({ where }),
        prisma.candidate.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            owner: { select: { id: true, name: true, email: true } },
            tags: true,
            applications: {
              include: {
                job: {
                  select: {
                    id: true,
                    title: true,
                    client: { select: { id: true, legalName: true } },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        }),
      ]);

      // Anti-leak sanitization for client
      const sanitized = candidates.map((c) => {
        if (user.role === UserRole.CLIENT) {
          return {
            ...c,
            currentSalary: null,
            expectedSalary: null,
            noticePeriod: null,
          };
        }
        return c;
      });

      return reply.status(200).send({
        success: true,
        data: {
          candidates: sanitized,
          total,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.ceil(total / filters.limit) || 1,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 2. GET /api/candidates/:candidateId (Single candidate profile)
  // -------------------------------------------------------------
  server.get(
    '/api/candidates/:candidateId',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { candidateId } = request.params as { candidateId: string };

      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          owner: { select: { id: true, name: true, email: true, role: true } },
          tags: true,
          notes: {
            orderBy: { createdAt: 'desc' },
          },
          documents: {
            orderBy: { uploadedAt: 'desc' },
          },
          applications: {
            include: {
              job: {
                include: {
                  client: { select: { id: true, legalName: true } },
                },
              },
              interviews: {
                include: {
                  round: true,
                },
                orderBy: { scheduledAt: 'desc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!candidate) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate not found' },
        });
      }

      // Check authorization
      const allowed = can(user, 'read', {
        type: 'candidate',
        id: candidate.id,
        ownerId: candidate.ownerId,
        organizationId: candidate.organizationId,
      });

      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'Insufficient permissions to view this candidate' },
        });
      }

      // Fetch note authors
      const authorIds = Array.from(new Set(candidate.notes.map((n) => n.authorId)));
      const authors = authorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, name: true, role: true },
          })
        : [];
      const authorMap = new Map(authors.map((a) => [a.id, a]));
      const notesWithAuthor = candidate.notes.map((n) => ({
        ...n,
        author: authorMap.get(n.authorId) || { id: n.authorId, name: 'Team Member', role: 'RECRUITER' },
      }));

      // Fetch audit logs
      const rawAuditLogs = await prisma.auditLog.findMany({
        where: { entity: 'candidate', entityId: candidateId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const actorIds = Array.from(new Set(rawAuditLogs.map((l) => l.actorId)));
      const actors = actorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, role: true },
          })
        : [];
      const actorMap = new Map(actors.map((a) => [a.id, a]));
      const auditLogs = rawAuditLogs.map((l) => ({
        ...l,
        actor: actorMap.get(l.actorId) || { id: l.actorId, name: 'System', role: 'ADMIN' },
      }));

      // Anti-leak sanitization for client
      if (user.role === UserRole.CLIENT) {
        return reply.status(200).send({
          success: true,
          data: {
            candidate: {
              ...candidate,
              currentSalary: null,
              expectedSalary: null,
              noticePeriod: null,
              notes: [],
            },
            auditLogs: [],
          },
        });
      }

      // Anti-leak sanitization for candidate role
      if (user.role === UserRole.CANDIDATE) {
        return reply.status(200).send({
          success: true,
          data: {
            candidate: {
              ...candidate,
              notes: notesWithAuthor.filter((n) => !n.isInternalOnly),
            },
            auditLogs: [],
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          candidate: {
            ...candidate,
            notes: notesWithAuthor,
          },
          auditLogs,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 3. PATCH /api/candidates/:candidateId (Update candidate profile)
  // -------------------------------------------------------------
  server.patch(
    '/api/candidates/:candidateId',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { candidateId } = request.params as { candidateId: string };

      const parsed = UpdateCandidateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid candidate data',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const existing = await prisma.candidate.findUnique({ where: { id: candidateId } });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate not found' },
        });
      }

      const allowed = can(user, 'update', {
        type: 'candidate',
        id: existing.id,
        ownerId: existing.ownerId,
        organizationId: existing.organizationId,
      });

      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'You do not have permission to edit this candidate' },
        });
      }

      const data = parsed.data;
      const updated = await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || null,
          currentTitle: data.currentTitle || null,
          currentCompany: data.currentCompany || null,
          experienceYears: data.experienceYears,
          currentSalary: data.currentSalary,
          expectedSalary: data.expectedSalary,
          noticePeriod: data.noticePeriod || null,
          location: data.location || null,
          skills: data.skills,
          source: data.source ? data.source : undefined,
        },
      });

      await logCandidateEvent(
        user.id,
        'candidate.updated',
        candidateId,
        {
          name: existing.name,
          currentTitle: existing.currentTitle,
          currentCompany: existing.currentCompany,
        },
        {
          name: updated.name,
          currentTitle: updated.currentTitle,
          currentCompany: updated.currentCompany,
        },
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: { candidate: updated },
      });
    }
  );

  // -------------------------------------------------------------
  // 4. POST /api/candidates/:candidateId/notes (Add internal note)
  // -------------------------------------------------------------
  server.post(
    '/api/candidates/:candidateId/notes',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { candidateId } = request.params as { candidateId: string };

      const parsed = CreateCandidateNoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid note content',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
      if (!candidate) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate not found' },
        });
      }

      const allowed = can(user, 'create', {
        type: 'candidate_notes',
        candidateId,
        ownerId: candidate.ownerId,
        organizationId: candidate.organizationId,
      });

      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'You cannot add notes to this candidate' },
        });
      }

      const note = await prisma.candidateNote.create({
        data: {
          candidateId,
          authorId: user.id,
          content: parsed.data.content,
          isInternalOnly: parsed.data.isInternalOnly,
        },
      });

      await logCandidateEvent(
        user.id,
        'candidate.note_created',
        candidateId,
        null,
        { noteId: note.id, preview: note.content.substring(0, 100) },
        request.ip
      );

      return reply.status(201).send({
        success: true,
        data: {
          note: {
            ...note,
            author: { id: user.id, name: user.name, role: user.role },
          },
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 5. DELETE /api/candidates/:candidateId/notes/:noteId
  // -------------------------------------------------------------
  server.delete(
    '/api/candidates/:candidateId/notes/:noteId',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { candidateId, noteId } = request.params as { candidateId: string; noteId: string };

      const note = await prisma.candidateNote.findUnique({
        where: { id: noteId },
        include: { candidate: true },
      });

      if (!note || note.candidateId !== candidateId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Note not found' },
        });
      }

      const isAuthor = note.authorId === user.id;
      const isOwner = note.candidate.ownerId === user.id;
      const isAdmin = user.role === UserRole.ADMIN;

      if (!isAuthor && !isOwner && !isAdmin) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'Cannot delete note authored by another user' },
        });
      }

      await prisma.candidateNote.delete({ where: { id: noteId } });

      await logCandidateEvent(user.id, 'candidate.note_deleted', candidateId, { noteId }, null, request.ip);

      return reply.status(200).send({
        success: true,
        data: { message: 'Note deleted successfully' },
      });
    }
  );

  // -------------------------------------------------------------
  // 6. POST /api/candidates/:candidateId/handover
  // -------------------------------------------------------------
  server.post(
    '/api/candidates/:candidateId/handover',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { candidateId } = request.params as { candidateId: string };

      const parsed = CandidateHandoverSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid handover payload',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: { owner: true },
      });

      if (!candidate) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate not found' },
        });
      }

      const isOwner = candidate.ownerId === user.id;
      const isManager =
        user.role === UserRole.MANAGER && (user.subordinateIds?.includes(candidate.ownerId ?? '') || false);
      const isAdmin = user.role === UserRole.ADMIN;

      if (!isOwner && !isManager && !isAdmin) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'You cannot reassign this candidate' },
        });
      }

      const newOwner = await prisma.user.findUnique({ where: { id: parsed.data.newOwnerId } });
      if (!newOwner || newOwner.organizationId !== user.organizationId || newOwner.status !== 'ACTIVE') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_OWNER', message: 'Target owner must be an active recruiter in your organization' },
        });
      }

      const updated = await prisma.candidate.update({
        where: { id: candidateId },
        data: { ownerId: newOwner.id },
      });

      await logCandidateEvent(
        user.id,
        'candidate.ownership_handover',
        candidateId,
        { previousOwnerId: candidate.ownerId, previousOwnerName: candidate.owner?.name },
        { newOwnerId: newOwner.id, newOwnerName: newOwner.name, reason: parsed.data.reason },
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: { candidate: updated, message: `Candidate successfully reassigned to ${newOwner.name}` },
      });
    }
  );

  // -------------------------------------------------------------
  // 7. POST /api/candidates/:candidateId/archive (Soft Archive)
  // -------------------------------------------------------------
  server.post(
    '/api/candidates/:candidateId/archive',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { candidateId } = request.params as { candidateId: string };

      const parsed = ArchiveCandidateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Archive reason is required',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
      if (!candidate) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate not found' },
        });
      }

      const allowed = can(user, 'delete', {
        type: 'candidate',
        id: candidate.id,
        ownerId: candidate.ownerId,
        organizationId: candidate.organizationId,
      });

      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'You cannot archive this candidate' },
        });
      }

      const updated = await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedById: user.id,
          archiveReason: parsed.data.reason,
        },
      });

      await logCandidateEvent(
        user.id,
        'candidate.archived',
        candidateId,
        { isArchived: false },
        { isArchived: true, reason: parsed.data.reason },
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: { candidate: updated, message: 'Candidate archived successfully' },
      });
    }
  );

  // -------------------------------------------------------------
  // 8. POST /api/candidates/:candidateId/restore (Soft Restore)
  // -------------------------------------------------------------
  server.post(
    '/api/candidates/:candidateId/restore',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { candidateId } = request.params as { candidateId: string };

      const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
      if (!candidate) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate not found' },
        });
      }

      const allowed = can(user, 'update', {
        type: 'candidate',
        id: candidate.id,
        ownerId: candidate.ownerId,
        organizationId: candidate.organizationId,
      });

      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'You cannot restore this candidate' },
        });
      }

      const parsed = RestoreCandidateSchema.safeParse(request.body || {});

      const updated = await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          isArchived: false,
          archivedAt: null,
          archivedById: null,
          archiveReason: null,
        },
      });

      await logCandidateEvent(
        user.id,
        'candidate.restored',
        candidateId,
        { isArchived: true, previousReason: candidate.archiveReason },
        { isArchived: false, reason: parsed.success ? parsed.data.reason : 'Restored' },
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: { candidate: updated, message: 'Candidate restored successfully' },
      });
    }
  );
};

export default candidateRoutes;
