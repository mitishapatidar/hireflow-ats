'use server';

import { revalidatePath } from 'next/cache';
import { prisma, Prisma, ApplicationStatus } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  can,
  UserRole,
  CandidateFilterSchema,
  CandidateFilterInput,
  UpdateCandidateSchema,
  UpdateCandidateInput,
  CreateCandidateNoteSchema,
  CreateCandidateNoteInput,
  CandidateHandoverSchema,
  CandidateHandoverInput,
  ArchiveCandidateSchema,
  ArchiveCandidateInput,
  RestoreCandidateSchema,
  RestoreCandidateInput,
  SavedView,
} from '@hireflow/shared';

// ---------------------------------------------------------------------------
// Helper: Audit Logging
// ---------------------------------------------------------------------------
async function writeCandidateAuditLog(
  actorId: string,
  action: string,
  candidateId: string,
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'candidate',
        entityId: candidateId,
        before: (before ?? Prisma.DbNull) as Prisma.InputJsonValue,
        after: (after ?? Prisma.DbNull) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('[writeCandidateAuditLog] Failed to record audit log:', err);
  }
}

// ---------------------------------------------------------------------------
// 1. Get Candidates List (Search, Filters, Role-based Isolation)
// ---------------------------------------------------------------------------
export async function getCandidatesListAction(rawFilters: Record<string, unknown> = {}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', candidates: [], total: 0, page: 1, limit: 20, totalPages: 0 };
  }

  const parsed = CandidateFilterSchema.safeParse(rawFilters);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid filter parameters',
      fieldErrors: parsed.error.flatten().fieldErrors,
      candidates: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
  }

  const filters = parsed.data;
  const where: Prisma.CandidateWhereInput = {
    organizationId: user.organizationId,
  };

  // Archive status filter (Default: exclude archived)
  if (filters.includeArchived) {
    // Include both archived and unarchived, or let user filter
  } else {
    where.isArchived = false;
  }

  // Role-based scoping
  if (user.role === UserRole.RECRUITER) {
    // Recruiters only see their own candidates
    where.ownerId = user.id;
  } else if (user.role === UserRole.MANAGER) {
    // Managers see candidates owned by themselves or their managed team members
    const allowedOwnerIds = [user.id, ...(user.subordinateIds || [])];
    where.ownerId = { in: allowedOwnerIds };
  } else if (user.role === UserRole.CLIENT) {
    // Clients only see candidates submitted to their authorized jobs
    if (!user.clientAccess?.clientId) {
      return { success: true, candidates: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
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
    // Candidates only see their own profile
    if (!user.candidateProfileId) {
      return { success: true, candidates: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
    }
    where.id = user.candidateProfileId;
  }

  // Explicit owner filter (for Admin / Manager drilling down)
  if (filters.ownerId && (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER)) {
    where.ownerId = filters.ownerId;
  }

  // Free-text Search (Name, Email, Current Title, Current Company, Skills, Tags)
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

  // Job Filter
  if (filters.jobId) {
    where.applications = {
      some: {
        jobId: filters.jobId,
      },
    };
  }

  // Application Status / Pipeline Stage Filter
  if (filters.status) {
    where.applications = {
      some: {
        status: filters.status as ApplicationStatus,
      },
    };
  }

  // Source Filter
  if (filters.source) {
    where.source = { contains: filters.source, mode: 'insensitive' };
  }

  // Location Filter
  if (filters.location) {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }

  // Experience Range Filter
  if (filters.minExp !== undefined || filters.maxExp !== undefined) {
    where.experienceYears = {
      ...(filters.minExp !== undefined ? { gte: filters.minExp } : {}),
      ...(filters.maxExp !== undefined ? { lte: filters.maxExp } : {}),
    };
  }

  // Salary Range Filter
  if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
    where.expectedSalary = {
      ...(filters.minSalary !== undefined ? { gte: filters.minSalary } : {}),
      ...(filters.maxSalary !== undefined ? { lte: filters.maxSalary } : {}),
    };
  }

  // Tags Filter
  if (filters.tags && filters.tags.length > 0) {
    where.tags = {
      some: {
        name: { in: filters.tags },
      },
    };
  }

  // Pagination & Order
  const skip = (filters.page - 1) * filters.limit;
  const take = filters.limit;
  const orderBy = { [filters.sortBy]: filters.sortOrder };

  try {
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

    // Data leak protection: For CLIENT, sanitize salary and internal fields
    const sanitizedCandidates = candidates.map((cand) => {
      const base = {
        ...cand,
        experienceYears: cand.experienceYears !== null && cand.experienceYears !== undefined ? Number(cand.experienceYears) : null,
        currentSalary: cand.currentSalary !== null && cand.currentSalary !== undefined ? Number(cand.currentSalary) : null,
        expectedSalary: cand.expectedSalary !== null && cand.expectedSalary !== undefined ? Number(cand.expectedSalary) : null,
        createdAt: cand.createdAt.toISOString(),
        updatedAt: cand.updatedAt.toISOString(),
        consentRecordedAt: cand.consentRecordedAt ? cand.consentRecordedAt.toISOString() : null,
        archivedAt: cand.archivedAt ? cand.archivedAt.toISOString() : null,
      };

      if (user.role === UserRole.CLIENT) {
        return {
          ...base,
          currentSalary: null,
          expectedSalary: null,
          noticePeriod: null,
        };
      }
      return base;
    });

    return {
      success: true,
      candidates: sanitizedCandidates,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit) || 1,
    };
  } catch (err) {
    console.error('[getCandidatesListAction] Error fetching candidates:', err);
    return {
      success: false,
      error: 'Failed to fetch candidates',
      candidates: [],
      total: 0,
      page: filters.page,
      limit: filters.limit,
      totalPages: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Get Single Candidate by ID (Profile, Full Tabs, Notes, Activity)
// ---------------------------------------------------------------------------
export async function getCandidateByIdAction(candidateId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', candidate: null, auditLogs: [] };
  }

  try {
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
      return { success: false, error: 'Candidate not found', candidate: null, auditLogs: [] };
    }

    // Role-based Authorization check using shared can() engine
    const allowed = can(user, 'read', {
      type: 'candidate',
      id: candidate.id,
      ownerId: candidate.ownerId,
      organizationId: candidate.organizationId,
    });

    if (!allowed) {
      return { success: false, error: 'Forbidden: Insufficient permissions to view candidate', candidate: null, auditLogs: [] };
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

    // Fetch related audit logs for the candidate
    const rawAuditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'candidate',
        entityId: candidateId,
      },
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

    const serializedCandidate = {
      ...candidate,
      experienceYears: candidate.experienceYears !== null && candidate.experienceYears !== undefined ? Number(candidate.experienceYears) : null,
      currentSalary: candidate.currentSalary !== null && candidate.currentSalary !== undefined ? Number(candidate.currentSalary) : null,
      expectedSalary: candidate.expectedSalary !== null && candidate.expectedSalary !== undefined ? Number(candidate.expectedSalary) : null,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
      consentRecordedAt: candidate.consentRecordedAt ? candidate.consentRecordedAt.toISOString() : null,
      archivedAt: candidate.archivedAt ? candidate.archivedAt.toISOString() : null,
      notes: notesWithAuthor.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
      tags: candidate.tags.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      documents: candidate.documents.map((d) => ({
        ...d,
        uploadedAt: d.uploadedAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      applications: candidate.applications.map((a) => ({
        ...a,
        appliedAt: a.appliedAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        job: a.job
          ? {
              ...a.job,
              salaryMin: a.job.salaryMin ? Number(a.job.salaryMin) : null,
              salaryMax: a.job.salaryMax ? Number(a.job.salaryMax) : null,
              createdAt: a.job.createdAt instanceof Date ? a.job.createdAt.toISOString() : a.job.createdAt,
              updatedAt: a.job.updatedAt instanceof Date ? a.job.updatedAt.toISOString() : a.job.updatedAt,
            }
          : a.job,
        interviews: a.interviews.map((i) => ({
          ...i,
          scheduledAt: i.scheduledAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
        })),
      })),
    };

    const serializedAuditLogs = auditLogs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    }));

    // Anti-leak sanitization for CLIENT role
    if (user.role === UserRole.CLIENT) {
      return {
        success: true,
        candidate: {
          ...serializedCandidate,
          currentSalary: null,
          expectedSalary: null,
          noticePeriod: null,
          notes: [], // Clients NEVER see internal notes
        },
        auditLogs: [], // Clients do not see internal audit trails
      };
    }

    // Anti-leak sanitization for CANDIDATE role
    if (user.role === UserRole.CANDIDATE) {
      return {
        success: true,
        candidate: {
          ...serializedCandidate,
          notes: serializedCandidate.notes.filter((n) => !n.isInternalOnly),
        },
        auditLogs: [],
      };
    }

    return {
      success: true,
      candidate: serializedCandidate,
      auditLogs: serializedAuditLogs,
    };
  } catch (err) {
    console.error('[getCandidateByIdAction] Error:', err);
    return { success: false, error: 'Failed to retrieve candidate profile', candidate: null, auditLogs: [] };
  }
}

// ---------------------------------------------------------------------------
// 3. Update Candidate Profile
// ---------------------------------------------------------------------------
export async function updateCandidateAction(candidateId: string, rawInput: UpdateCandidateInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = UpdateCandidateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input fields',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const existing = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!existing) {
      return { success: false, error: 'Candidate not found' };
    }

    const allowed = can(user, 'update', {
      type: 'candidate',
      id: existing.id,
      ownerId: existing.ownerId,
      organizationId: existing.organizationId,
    });

    if (!allowed) {
      return { success: false, error: 'Forbidden: You do not have permission to edit this candidate' };
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

    await writeCandidateAuditLog(
      user.id,
      'candidate.updated',
      candidateId,
      {
        name: existing.name,
        currentTitle: existing.currentTitle,
        currentCompany: existing.currentCompany,
        experienceYears: existing.experienceYears ? Number(existing.experienceYears) : null,
        currentSalary: existing.currentSalary ? Number(existing.currentSalary) : null,
        expectedSalary: existing.expectedSalary ? Number(existing.expectedSalary) : null,
      },
      {
        name: updated.name,
        currentTitle: updated.currentTitle,
        currentCompany: updated.currentCompany,
        experienceYears: updated.experienceYears ? Number(updated.experienceYears) : null,
        currentSalary: updated.currentSalary ? Number(updated.currentSalary) : null,
        expectedSalary: updated.expectedSalary ? Number(updated.expectedSalary) : null,
      }
    );

    revalidatePath('/candidates');
    revalidatePath(`/candidates/${candidateId}`);

    return { success: true, candidate: updated };
  } catch (err) {
    console.error('[updateCandidateAction] Error:', err);
    return { success: false, error: 'Failed to update candidate profile' };
  }
}

// ---------------------------------------------------------------------------
// 4. Candidate Notes CRUD
// ---------------------------------------------------------------------------
export async function addCandidateNoteAction(candidateId: string, rawInput: CreateCandidateNoteInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CreateCandidateNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: 'Invalid note content', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    // Role-based check
    const allowed = can(user, 'create', {
      type: 'candidate_notes',
      candidateId,
      ownerId: candidate.ownerId,
      organizationId: candidate.organizationId,
    });

    if (!allowed) {
      return { success: false, error: 'Forbidden: Cannot add note to this candidate' };
    }

    const note = await prisma.candidateNote.create({
      data: {
        candidateId,
        authorId: user.id,
        content: parsed.data.content,
        isInternalOnly: parsed.data.isInternalOnly,
      },
    });

    await writeCandidateAuditLog(user.id, 'candidate.note_created', candidateId, null, {
      noteId: note.id,
      preview: note.content.substring(0, 100),
    });

    const author = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, role: true },
    });

    revalidatePath(`/candidates/${candidateId}`);
    return {
      success: true,
      note: {
        ...note,
        author: author || { id: user.id, name: user.name, role: user.role },
      },
    };
  } catch (err) {
    console.error('[addCandidateNoteAction] Error:', err);
    return { success: false, error: 'Failed to create candidate note' };
  }
}

export async function deleteCandidateNoteAction(noteId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const note = await prisma.candidateNote.findUnique({
      where: { id: noteId },
      include: { candidate: true },
    });

    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    // Only author, candidate owner or admin can delete
    const isAuthor = note.authorId === user.id;
    const isOwner = note.candidate.ownerId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isAuthor && !isOwner && !isAdmin) {
      return { success: false, error: 'Forbidden: Cannot delete note authored by another user' };
    }

    await prisma.candidateNote.delete({
      where: { id: noteId },
    });

    await writeCandidateAuditLog(user.id, 'candidate.note_deleted', note.candidateId, { noteId }, null);

    revalidatePath(`/candidates/${note.candidateId}`);
    return { success: true };
  } catch (err) {
    console.error('[deleteCandidateNoteAction] Error:', err);
    return { success: false, error: 'Failed to delete note' };
  }
}

// ---------------------------------------------------------------------------
// 5. Candidate Tags CRUD
// ---------------------------------------------------------------------------
export async function addCandidateTagAction(candidateId: string, tagName: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const cleanName = tagName.trim();
  if (!cleanName || cleanName.length > 50) {
    return { success: false, error: 'Invalid tag name' };
  }

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    const allowed = can(user, 'update', {
      type: 'candidate',
      id: candidate.id,
      ownerId: candidate.ownerId,
      organizationId: candidate.organizationId,
    });

    if (!allowed) {
      return { success: false, error: 'Forbidden' };
    }

    // Check duplicate
    const existing = await prisma.candidateTag.findFirst({
      where: { candidateId, name: cleanName },
    });

    if (existing) {
      return { success: true, tag: existing };
    }

    const tag = await prisma.candidateTag.create({
      data: {
        candidateId,
        name: cleanName,
      },
    });

    await writeCandidateAuditLog(user.id, 'candidate.tag_added', candidateId, null, { tag: cleanName });

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true, tag };
  } catch (err) {
    console.error('[addCandidateTagAction] Error:', err);
    return { success: false, error: 'Failed to add tag' };
  }
}

export async function removeCandidateTagAction(candidateId: string, tagId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    const allowed = can(user, 'update', {
      type: 'candidate',
      id: candidate.id,
      ownerId: candidate.ownerId,
      organizationId: candidate.organizationId,
    });

    if (!allowed) {
      return { success: false, error: 'Forbidden' };
    }

    const tag = await prisma.candidateTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      return { success: true };
    }

    await prisma.candidateTag.delete({ where: { id: tagId } });

    await writeCandidateAuditLog(user.id, 'candidate.tag_removed', candidateId, { tag: tag.name }, null);

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
  } catch (err) {
    console.error('[removeCandidateTagAction] Error:', err);
    return { success: false, error: 'Failed to remove tag' };
  }
}

// ---------------------------------------------------------------------------
// 6. Ownership Handover
// ---------------------------------------------------------------------------
export async function handoverCandidateAction(candidateId: string, rawInput: CandidateHandoverInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CandidateHandoverSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: 'Invalid handover data', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { owner: true },
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    // Only owner, manager or admin can transfer ownership
    const isOwner = candidate.ownerId === user.id;
    const isManager = user.role === UserRole.MANAGER && (user.subordinateIds?.includes(candidate.ownerId ?? '') || false);
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isOwner && !isManager && !isAdmin) {
      return { success: false, error: 'Forbidden: You cannot transfer this candidate' };
    }

    // Verify new owner exists, is active, and belongs to same organization
    const newOwner = await prisma.user.findUnique({
      where: { id: parsed.data.newOwnerId },
    });

    if (!newOwner || newOwner.organizationId !== user.organizationId || newOwner.status !== 'ACTIVE') {
      return { success: false, error: 'New owner must be an active recruiter in your organization' };
    }

    const previousOwnerName = candidate.owner?.name || candidate.ownerId || 'Unassigned';

    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        ownerId: newOwner.id,
      },
    });

    await writeCandidateAuditLog(
      user.id,
      'candidate.ownership_handover',
      candidateId,
      { previousOwnerId: candidate.ownerId, previousOwnerName },
      { newOwnerId: newOwner.id, newOwnerName: newOwner.name, reason: parsed.data.reason }
    );

    revalidatePath('/candidates');
    revalidatePath(`/candidates/${candidateId}`);

    return { success: true, message: `Candidate successfully reassigned to ${newOwner.name}`, candidate: updated };
  } catch (err) {
    console.error('[handoverCandidateAction] Error:', err);
    return { success: false, error: 'Failed to reassign candidate' };
  }
}

// ---------------------------------------------------------------------------
// 7. Soft Archive & Restore (Never Hard Delete)
// ---------------------------------------------------------------------------
export async function archiveCandidateAction(candidateId: string, rawInput: ArchiveCandidateInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = ArchiveCandidateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: 'Archive reason is required', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    const allowed = can(user, 'delete', {
      type: 'candidate',
      id: candidate.id,
      ownerId: candidate.ownerId,
      organizationId: candidate.organizationId,
    });

    if (!allowed) {
      return { success: false, error: 'Forbidden: You cannot archive this candidate' };
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

    await writeCandidateAuditLog(
      user.id,
      'candidate.archived',
      candidateId,
      { isArchived: false },
      { isArchived: true, reason: parsed.data.reason }
    );

    revalidatePath('/candidates');
    revalidatePath(`/candidates/${candidateId}`);

    return { success: true, message: 'Candidate archived successfully', candidate: updated };
  } catch (err) {
    console.error('[archiveCandidateAction] Error:', err);
    return { success: false, error: 'Failed to archive candidate' };
  }
}

export async function restoreCandidateAction(candidateId: string, rawInput?: RestoreCandidateInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = RestoreCandidateSchema.safeParse(rawInput || {});

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    const allowed = can(user, 'update', {
      type: 'candidate',
      id: candidate.id,
      ownerId: candidate.ownerId,
      organizationId: candidate.organizationId,
    });

    if (!allowed) {
      return { success: false, error: 'Forbidden: You cannot restore this candidate' };
    }

    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
      },
    });

    await writeCandidateAuditLog(
      user.id,
      'candidate.restored',
      candidateId,
      { isArchived: true, previousReason: candidate.archiveReason },
      { isArchived: false, reason: parsed.success ? parsed.data.reason : 'Restored' }
    );

    revalidatePath('/candidates');
    revalidatePath(`/candidates/${candidateId}`);

    return { success: true, message: 'Candidate restored successfully', candidate: updated };
  } catch (err) {
    console.error('[restoreCandidateAction] Error:', err);
    return { success: false, error: 'Failed to restore candidate' };
  }
}

// ---------------------------------------------------------------------------
// 8. Saved Views Management (Stored in Organization.settings.savedViews[userId])
// ---------------------------------------------------------------------------
export async function getSavedViewsAction() {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, views: [] };
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, unknown>) || {};
    const allSavedViews = (settings.savedViews as Record<string, SavedView[]>) || {};
    const userViews = allSavedViews[user.id] || [];

    return { success: true, views: userViews };
  } catch (err) {
    console.error('[getSavedViewsAction] Error:', err);
    return { success: false, views: [] };
  }
}

export async function saveCustomViewAction(name: string, filters: CandidateFilterInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 50) {
    return { success: false, error: 'View name must be 1 to 50 characters' };
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, unknown>) || {};
    const allSavedViews = (settings.savedViews as Record<string, SavedView[]>) || {};
    const userViews = allSavedViews[user.id] || [];

    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: cleanName,
      filters,
      createdAt: new Date().toISOString(),
    };

    allSavedViews[user.id] = [...userViews, newView];

    await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        settings: {
          ...settings,
          savedViews: allSavedViews,
        } as Prisma.InputJsonValue,
      },
    });

    return { success: true, view: newView };
  } catch (err) {
    console.error('[saveCustomViewAction] Error:', err);
    return { success: false, error: 'Failed to save view' };
  }
}

export async function deleteCustomViewAction(viewId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, unknown>) || {};
    const allSavedViews = (settings.savedViews as Record<string, SavedView[]>) || {};
    const userViews = allSavedViews[user.id] || [];

    allSavedViews[user.id] = userViews.filter((v) => v.id !== viewId);

    await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        settings: {
          ...settings,
          savedViews: allSavedViews,
        } as Prisma.InputJsonValue,
      },
    });

    return { success: true };
  } catch (err) {
    console.error('[deleteCustomViewAction] Error:', err);
    return { success: false, error: 'Failed to delete view' };
  }
}
