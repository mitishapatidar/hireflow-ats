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
  CreateCandidateSchema,
  DuplicateCheckSchema,
  normalizeEmail,
  normalizePhone,
  getResumeParser,
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

  // -------------------------------------------------------------
  // 9. POST /api/candidates/check-duplicate (Prompt 8)
  // -------------------------------------------------------------
  server.post(
    '/api/candidates/check-duplicate',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const parsed = DuplicateCheckSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid duplicate check parameters',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const normEmail = normalizeEmail(parsed.data.email);
      const normPhone = normalizePhone(parsed.data.phone);

      const emailMatches = await prisma.candidate.findMany({
        where: {
          organizationId: user.organizationId,
          email: { equals: normEmail, mode: 'insensitive' },
        },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          isArchived: true,
          owner: { select: { id: true, name: true } },
        },
      });

      const matches: any[] = emailMatches.map((c) => ({
        candidateId: c.id,
        code: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone,
        isArchived: c.isArchived,
        owner: c.owner,
        matchingField: 'email',
      }));

      if (normPhone) {
        const phoneMatches = await prisma.candidate.findMany({
          where: {
            organizationId: user.organizationId,
            phone: { not: null },
          },
          select: {
            id: true,
            code: true,
            name: true,
            email: true,
            phone: true,
            isArchived: true,
            owner: { select: { id: true, name: true } },
          },
        });

        for (const c of phoneMatches) {
          if (c.phone && normalizePhone(c.phone) === normPhone) {
            if (!matches.some((m) => m.candidateId === c.id)) {
              matches.push({
                candidateId: c.id,
                code: c.code,
                name: c.name,
                email: c.email,
                phone: c.phone,
                isArchived: c.isArchived,
                owner: c.owner,
                matchingField: 'phone',
              });
            }
          }
        }
      }

      return reply.status(200).send({
        success: true,
        data: {
          isDuplicate: matches.length > 0,
          matches,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 10. POST /api/candidates/parse-text (Prompt 8 Structured Parser)
  // -------------------------------------------------------------
  server.post(
    '/api/candidates/parse-text',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'You cannot parse resumes' },
        });
      }

      const body = request.body as any;
      const rawText = body?.rawText;
      const fileName = body?.fileName || 'resume.pdf';

      if (!rawText || typeof rawText !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'rawText is required' },
        });
      }

      const parser = getResumeParser();
      const parsed = await parser.parseResume(rawText, { fileName });

      return reply.status(200).send({
        success: true,
        data: parsed,
      });
    }
  );

  // -------------------------------------------------------------
  // 11. BullMQ Background Processing Endpoints
  // -------------------------------------------------------------
  server.get(
    '/api/candidates/queue/status',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'Unauthorized' },
        });
      }

      const { getResumeQueueManager } = await import('../queue/resume-queue.js');
      const queueManager = getResumeQueueManager();
      const status = await queueManager.getQueueStatus();

      return reply.status(200).send({
        success: true,
        data: status,
      });
    }
  );

  server.post(
    '/api/candidates/jobs/parse-resume',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'Unauthorized' },
        });
      }

      const body = request.body as any;
      if (!body.storageKey || !body.fileName || !body.fileChecksum) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'storageKey, fileName, and fileChecksum are required' },
        });
      }

      const { getResumeQueueManager } = await import('../queue/resume-queue.js');
      const queueManager = getResumeQueueManager();
      const enqueueResult = await queueManager.enqueueJob({
        storageKey: body.storageKey,
        fileName: body.fileName,
        fileChecksum: body.fileChecksum,
        organizationId: user.organizationId,
        userId: user.id,
      });

      return reply.status(202).send({
        success: true,
        data: enqueueResult,
      });
    }
  );

  server.get(
    '/api/candidates/jobs/:jobId',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'Unauthorized' },
        });
      }

      const { jobId } = request.params as { jobId: string };
      const { getResumeQueueManager } = await import('../queue/resume-queue.js');
      const queueManager = getResumeQueueManager();
      const jobStatus = await queueManager.getJob(jobId);

      return reply.status(200).send({
        success: true,
        data: jobStatus,
      });
    }
  );

  // -------------------------------------------------------------
  // 12. POST /api/candidates (Explicit Creation & Transaction)
  // -------------------------------------------------------------
  server.post(
    '/api/candidates',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request, reply) => {
      const user = request.user!;

      const parsed = CreateCandidateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid candidate input',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const input = parsed.data;

      const allowed = can(user, 'create', {
        type: 'candidate',
        ownerId: input.ownerId || user.id,
        organizationId: user.organizationId,
      });

      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: 'You are not authorized to create candidates' },
        });
      }
      const normEmail = normalizeEmail(input.email);
      const normPhone = normalizePhone(input.phone);

      try {
        const created = await prisma.$transaction(async (tx) => {
          // Pre-save duplicate check against active and archived candidates within organization
          const duplicateConditions: any[] = [
            { email: { equals: normEmail, mode: 'insensitive' } },
          ];
          if (normPhone) {
            duplicateConditions.push({ phone: { contains: normPhone } });
          }

          const existing = await tx.candidate.findFirst({
            where: {
              organizationId: user.organizationId,
              OR: duplicateConditions,
            },
            select: { id: true, code: true, name: true, email: true, phone: true, isArchived: true },
          });

          if (existing) {
            const matchedField = existing.email.toLowerCase() === normEmail ? 'email' : 'phone';
            throw new Error(
              `Candidate with matching ${matchedField} already exists (${existing.code}: ${existing.name}${existing.isArchived ? ', Archived' : ''}). Duplicate candidate creation is strictly blocked.`
            );
          }

          // Resolve owner
          let resolvedOwnerId = user.id;
          if (input.ownerId && input.ownerId !== user.id) {
            const owner = await tx.user.findFirst({
              where: { id: input.ownerId, organizationId: user.organizationId, status: 'ACTIVE' },
            });
            if (owner) {
              resolvedOwnerId = owner.id;
            }
          }

          const count = await tx.candidate.count({ where: { organizationId: user.organizationId } });
          const code = `cand-c-${String(count + 1).padStart(4, '0')}`;

          const cand = await tx.candidate.create({
            data: {
              code,
              name: input.name,
              email: normEmail,
              phone: input.phone || null,
              currentTitle: input.currentTitle || null,
              currentCompany: input.currentCompany || null,
              experienceYears:
                input.experienceYears !== null && input.experienceYears !== undefined
                  ? new Prisma.Decimal(input.experienceYears)
                  : null,
              currentSalary:
                input.currentSalary !== null && input.currentSalary !== undefined
                  ? new Prisma.Decimal(input.currentSalary)
                  : null,
              expectedSalary:
                input.expectedSalary !== null && input.expectedSalary !== undefined
                  ? new Prisma.Decimal(input.expectedSalary)
                  : null,
              noticePeriod: input.noticePeriod || null,
              location: input.location || null,
              skills: input.skills || [],
              source: input.source || 'Direct Entry',
              ownerId: resolvedOwnerId,
              organizationId: user.organizationId,
              createdById: user.id,
            },
          });

          if (input.tags && input.tags.length > 0) {
            for (const t of input.tags) {
              if (t.trim()) {
                await tx.candidateTag.create({
                  data: { candidateId: cand.id, name: t.trim(), createdById: user.id },
                });
              }
            }
          }

          if (input.notes && input.notes.trim()) {
            await tx.candidateNote.create({
              data: {
                candidateId: cand.id,
                authorId: user.id,
                content: input.notes.trim(),
                isInternalOnly: true,
                createdById: user.id,
              },
            });
          }

          if (input.resumeDocument) {
            await tx.candidateDocument.create({
              data: {
                candidateId: cand.id,
                fileName: input.resumeDocument.fileName,
                fileUrl: input.resumeDocument.storageKey,
                storageBucket: 'resumes',
                documentType: input.resumeDocument.documentType || 'RESUME',
                uploadedById: user.id,
                createdById: user.id,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: 'candidate.created',
              entity: 'candidate',
              entityId: cand.id,
              after: { code: cand.code, name: cand.name, email: cand.email },
              ipAddress: request.ip || '127.0.0.1',
            },
          });

          return cand;
        });

        return reply.status(201).send({
          success: true,
          data: {
            candidate: created,
            message: 'Candidate created successfully',
          },
        });
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          return reply.status(409).send({
            success: false,
            error: { code: 'DUPLICATE_CANDIDATE', message: err.message },
          });
        }
        server.log.error(err, 'Failed to create candidate');
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create candidate' },
        });
      }
    }
  );
};

export default candidateRoutes;
