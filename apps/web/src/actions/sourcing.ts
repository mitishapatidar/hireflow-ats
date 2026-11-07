'use server';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  can,
  CreateImportBatchSchema,
  CreateImportBatchInput,
  UpdateImportItemReviewSchema,
  ApproveImportItemSchema,
  CandidateMergeSchema,
  CandidateMergeInput,
  SourcingQueueFilterSchema,
  SourcingQueueFilter,
  generateExtensionCaptureToken,
  isExtensionTokenExpired,
  evaluateCandidateDuplicate,
  normalizeEmail,
  normalizePhone,
  validateMergeEligibility,
  MERGE_FIELD_CATALOG,
  mergeCandidateSkills,
  getResumeParser,
  getSourcingProvider,
} from '@hireflow/shared';

// ---------------------------------------------------------------------------
// Authorization Guard
// ---------------------------------------------------------------------------
async function requireSourcingUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Authentication required.');
  }

  const isAllowed = can(user, 'read', { type: 'sourcing' });
  if (!isAllowed) {
    throw new Error('Forbidden: Sourcing workspace is restricted to recruiters and hiring managers.');
  }

  return user;
}

// ---------------------------------------------------------------------------
// Helper: Audit Logging
// ---------------------------------------------------------------------------
async function logSourcingAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  before?: Record<string, any> | null,
  after?: Record<string, any> | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        before: before ? (before as any) : undefined,
        after: after ? (after as any) : undefined,
        ipAddress: '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('[SourcingAudit] Failed to record audit log:', err);
  }
}

// ===========================================================================
// BULK RESUME IMPORT ACTIONS
// ===========================================================================

export async function getImportBatchesAction() {
  const user = await requireSourcingUser();

  const batches = await prisma.importBatch.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return { success: true, data: batches };
}

export async function getImportBatchAction(batchId: string) {
  const user = await requireSourcingUser();

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, organizationId: user.organizationId },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!batch) {
    return { success: false, error: 'Import batch not found.' };
  }

  return { success: true, data: batch };
}

export async function createImportBatchAction(input: {
  fileName: string;
  files: Array<{
    fileName: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
    fileChecksum?: string;
    rawText?: string;
  }>;
}) {
  const user = await requireSourcingUser();

  const files = input.files || [];
  if (files.length === 0) {
    return { success: false, error: 'At least one file is required' };
  }

  const batchCode = `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const parser = getResumeParser();

  const batch = await prisma.$transaction(async (tx) => {
    const newBatch = await tx.importBatch.create({
      data: {
        organizationId: user.organizationId,
        batchCode,
        fileName: input.fileName || `Bulk Import ${new Date().toLocaleDateString()}`,
        importType: 'BULK_RESUME',
        uploadedById: user.id,
        totalRecords: files.length,
        processedRecords: 0,
        parsedRecords: 0,
        duplicateRecords: 0,
        failedRecords: 0,
        pendingReviewCount: files.length,
        status: 'PROCESSING',
        createdById: user.id,
      },
    });

    let duplicateCount = 0;
    let parsedCount = 0;

    const existingCandidates = await tx.candidate.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phone: true,
        currentCompany: true,
        currentTitle: true,
        isArchived: true,
      },
    });

    for (const file of files) {
      let parsedData: any = null;
      let parserConfidence = 0.8;

      if (file.rawText) {
        try {
          const parsedResult = await parser.parseResume(file.rawText);
          parsedData = {
            name: parsedResult.name?.value || file.fileName.replace(/\.[^/.]+$/, ''),
            email: parsedResult.email?.value || null,
            phone: parsedResult.phone?.value || null,
            currentCompany: parsedResult.currentCompany?.value || null,
            currentTitle: parsedResult.currentTitle?.value || null,
            skills: parsedResult.skills?.value || [],
            experienceYears: parsedResult.experienceYears?.value || null,
            location: parsedResult.location?.value || null,
          };
          parserConfidence = 0.9;
          parsedCount++;
        } catch {
          parsedData = { name: file.fileName.replace(/\.[^/.]+$/, '') };
        }
      }

      // Check duplicates
      let duplicateStatus = 'NO_MATCH';
      let duplicateCandidateId: string | null = null;
      let duplicateScore = 0;
      let duplicateReasons: string[] = [];

      for (const existing of existingCandidates) {
        const dupEval = evaluateCandidateDuplicate(
          {
            name: parsedData?.name,
            email: parsedData?.email,
            phone: parsedData?.phone,
            company: parsedData?.currentCompany,
          },
          existing
        );

        if (dupEval.isDuplicate && dupEval.score > duplicateScore) {
          duplicateStatus = dupEval.category;
          duplicateScore = Math.round(dupEval.score * 100);
          duplicateReasons = dupEval.reasons;
          duplicateCandidateId = existing.id;
        }
      }

      if (duplicateStatus !== 'NO_MATCH') {
        duplicateCount++;
      }

      await tx.importItem.create({
        data: {
          organizationId: user.organizationId,
          importBatchId: newBatch.id,
          fileName: file.fileName,
          fileKey: file.fileKey,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          fileChecksum: file.fileChecksum || null,
          recordData: parsedData || {},
          parserConfidence: new Prisma.Decimal(parserConfidence),
          duplicateStatus,
          duplicateCandidateId,
          duplicateScore: new Prisma.Decimal(duplicateScore),
          duplicateReasons,
          status: 'AWAITING_REVIEW',
          createdById: user.id,
        },
      });
    }

    const updatedBatch = await tx.importBatch.update({
      where: { id: newBatch.id },
      data: {
        status: 'COMPLETED',
        processedRecords: files.length,
        parsedRecords: parsedCount,
        duplicateRecords: duplicateCount,
        pendingReviewCount: files.length,
        completedAt: new Date(),
      },
    });

    return updatedBatch;
  });

  await logSourcingAudit(user.id, 'CREATE_IMPORT_BATCH', 'ImportBatch', batch.id, null, {
    batchCode,
    totalRecords: files.length,
  });

  revalidatePath('/sourcing');
  revalidatePath('/sourcing/import');
  return { success: true, data: batch };
}

export async function reviewImportItemAction(itemId: string, input: any) {
  const user = await requireSourcingUser();

  const item = await prisma.importItem.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });

  if (!item) {
    return { success: false, error: 'Import item not found.' };
  }

  const existingData = (item.recordData as any) || {};
  const updatedData = { ...existingData, ...input };

  const updated = await prisma.importItem.update({
    where: { id: itemId },
    data: {
      recordData: updatedData,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath(`/sourcing/import`);
  return { success: true, data: updated };
}

export async function createCandidateFromImportAction(itemId: string, input: { jobId?: string; recruiterNotes?: string }) {
  const user = await requireSourcingUser();

  const item = await prisma.importItem.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });

  if (!item) {
    return { success: false, error: 'Import item not found.' };
  }

  if (item.status === 'APPROVED' && item.createdCandidateId) {
    return { success: false, error: 'Candidate has already been created from this item.' };
  }

  const data = (item.recordData as any) || {};
  const candidateName = data.name || item.fileName.replace(/\.[^/.]+$/, '');
  const email = data.email ? normalizeEmail(data.email) : `candidate-${Date.now()}@temp.hireflow.internal`;
  const phone = data.phone ? normalizePhone(data.phone) : null;
  const candidateCode = `CAND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const result = await prisma.$transaction(async (tx) => {
    // Explicit human review candidate creation
    const candidate = await tx.candidate.create({
      data: {
        organizationId: user.organizationId,
        code: candidateCode,
        name: candidateName,
        email,
        phone,
        currentCompany: data.currentCompany || null,
        currentTitle: data.currentTitle || null,
        location: data.location || null,
        skills: Array.isArray(data.skills) ? data.skills : [],
        experienceYears: typeof data.experienceYears === 'number' ? new Prisma.Decimal(data.experienceYears) : null,
        source: 'BULK_IMPORT',
        ownerId: user.id,
      },
    });

    // If job mapping provided, create application
    if (input.jobId) {
      await tx.application.create({
        data: {
          candidateId: candidate.id,
          jobId: input.jobId,
          status: 'SOURCED',
        },
      });
    }

    // Link resume document if fileKey is available
    if (item.fileKey) {
      await tx.candidateDocument.create({
        data: {
          candidateId: candidate.id,
          fileName: item.fileName,
          fileUrl: item.fileKey,
          storageBucket: 'resumes',
          documentType: 'CV',
          uploadedById: user.id,
        },
      });
    }

    // Update import item status
    await tx.importItem.update({
      where: { id: itemId },
      data: {
        status: 'APPROVED',
        createdCandidateId: candidate.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    // Update batch counter
    await tx.importBatch.update({
      where: { id: item.importBatchId },
      data: {
        pendingReviewCount: { decrement: 1 },
      },
    });

    return candidate;
  });

  await logSourcingAudit(user.id, 'CREATE_CANDIDATE_FROM_IMPORT', 'Candidate', result.id, null, {
    importItemId: itemId,
    candidateName: result.name,
  });

  revalidatePath('/sourcing');
  revalidatePath('/candidates');
  revalidatePath(`/sourcing/import`);
  return { success: true, data: result };
}

// ===========================================================================
// DUPLICATE DETECTION & MERGE ACTIONS
// ===========================================================================

export async function checkDuplicatesAction(params: {
  email?: string;
  phone?: string;
  name?: string;
  company?: string;
  candidateId?: string;
}) {
  const user = await requireSourcingUser();

  const existingCandidates = await prisma.candidate.findMany({
    where: {
      organizationId: user.organizationId,
      id: params.candidateId ? { not: params.candidateId } : undefined,
    },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      phone: true,
      currentCompany: true,
      currentTitle: true,
      isArchived: true,
    },
  });

  let bestMatch: any = null;
  let highestScore = 0;

  for (const candidate of existingCandidates) {
    const res = evaluateCandidateDuplicate(
      {
        email: params.email,
        phone: params.phone,
        name: params.name,
        company: params.company,
      },
      candidate
    );

    if (res.isDuplicate && res.score > highestScore) {
      highestScore = res.score;
      bestMatch = {
        candidateId: candidate.id,
        candidateName: candidate.name,
        score: Math.round(res.score * 100),
        category: res.category,
        reasons: res.reasons,
      };
    }
  }

  return {
    success: true,
    data: {
      isDuplicate: highestScore > 0,
      bestMatch,
    },
  };
}

export async function getDuplicatePairsAction(status?: string) {
  const user = await requireSourcingUser();

  const pairs = await prisma.duplicatePair.findMany({
    where: {
      organizationId: user.organizationId,
      status: status || undefined,
    },
    orderBy: { createdAt: 'desc' },
  });

  const candidateIds = new Set<string>();
  pairs.forEach((p) => {
    candidateIds.add(p.primaryCandidateId);
    candidateIds.add(p.duplicateCandidateId);
  });

  const candidates = await prisma.candidate.findMany({
    where: { id: { in: Array.from(candidateIds) } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      currentCompany: true,
      currentTitle: true,
      isArchived: true,
    },
  });

  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  const enrichedPairs = pairs.map((pair) => ({
    id: pair.id,
    primaryCandidateId: pair.primaryCandidateId,
    duplicateCandidateId: pair.duplicateCandidateId,
    score: Number(pair.matchScore),
    reasons: pair.matchReasons,
    status: pair.status,
    createdAt: pair.createdAt,
    primaryCandidate: candidateMap.get(pair.primaryCandidateId)
      ? {
          id: candidateMap.get(pair.primaryCandidateId)!.id,
          fullName: candidateMap.get(pair.primaryCandidateId)!.name,
          email: candidateMap.get(pair.primaryCandidateId)!.email,
          phone: candidateMap.get(pair.primaryCandidateId)!.phone,
          currentCompany: candidateMap.get(pair.primaryCandidateId)!.currentCompany,
          currentTitle: candidateMap.get(pair.primaryCandidateId)!.currentTitle,
        }
      : null,
    duplicateCandidate: candidateMap.get(pair.duplicateCandidateId)
      ? {
          id: candidateMap.get(pair.duplicateCandidateId)!.id,
          fullName: candidateMap.get(pair.duplicateCandidateId)!.name,
          email: candidateMap.get(pair.duplicateCandidateId)!.email,
          phone: candidateMap.get(pair.duplicateCandidateId)!.phone,
          currentCompany: candidateMap.get(pair.duplicateCandidateId)!.currentCompany,
          currentTitle: candidateMap.get(pair.duplicateCandidateId)!.currentTitle,
        }
      : null,
  }));

  return { success: true, data: enrichedPairs };
}

export async function resolveDuplicateDifferentAction(pairId: string, reason?: string) {
  const user = await requireSourcingUser();

  const updated = await prisma.duplicatePair.update({
    where: { id: pairId, organizationId: user.organizationId },
    data: {
      status: 'RESOLVED_DIFFERENT',
      resolvedAt: new Date(),
      resolvedById: user.id,
    },
  });

  await logSourcingAudit(user.id, 'RESOLVE_DUPLICATE_DIFFERENT', 'DuplicatePair', pairId, null, {
    reason,
  });

  revalidatePath('/sourcing/duplicates');
  return { success: true, data: updated };
}

export async function previewMergeCandidatesAction(masterCandidateId: string, secondaryCandidateId: string) {
  const user = await requireSourcingUser();

  const master = await prisma.candidate.findFirst({
    where: { id: masterCandidateId, organizationId: user.organizationId },
    include: {
      documents: true,
      notes: true,
      tags: true,
      applications: {
        include: {
          interviews: true,
          submissions: true,
          offers: true,
          placement: true,
        },
      },
    },
  });

  const secondary = await prisma.candidate.findFirst({
    where: { id: secondaryCandidateId, organizationId: user.organizationId },
    include: {
      documents: true,
      notes: true,
      tags: true,
      applications: {
        include: {
          interviews: true,
          submissions: true,
          offers: true,
          placement: true,
        },
      },
    },
  });

  if (!master || !secondary) {
    return { success: false, error: 'One or both candidates not found.' };
  }

  const eligibility = validateMergeEligibility(master as any, secondary as any);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.error };
  }

  const comparison: Record<string, { master: any; secondary: any; label: string }> = {};
  MERGE_FIELD_CATALOG.forEach((f) => {
    comparison[f.key] = {
      label: f.label,
      master: (master as any)[f.key],
      secondary: (secondary as any)[f.key],
    };
  });

  const mergedSkills = mergeCandidateSkills(master.skills || [], secondary.skills || []);

  let interviewCount = 0;
  let submissionCount = 0;
  let offerCount = 0;
  let placementCount = 0;

  secondary.applications.forEach((app) => {
    interviewCount += app.interviews.length;
    submissionCount += app.submissions.length;
    offerCount += app.offers.length;
    if (app.placement) placementCount += 1;
  });

  const preservedCounts = {
    documents: secondary.documents.length,
    notes: secondary.notes.length,
    tags: secondary.tags.length,
    applications: secondary.applications.length,
    interviews: interviewCount,
    submissions: submissionCount,
    offers: offerCount,
    placements: placementCount,
  };

  return {
    success: true,
    data: {
      master: { ...master, fullName: master.name },
      secondary: { ...secondary, fullName: secondary.name },
      comparison,
      mergedSkills,
      preservedCounts,
    },
  };
}

export async function executeMergeCandidatesAction(input: CandidateMergeInput) {
  const user = await requireSourcingUser();
  const parsed = CandidateMergeSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || 'Invalid merge request' };
  }

  const { masterCandidateId, secondaryCandidateId, mergeReason, fieldsRetained } = parsed.data;

  const master = await prisma.candidate.findFirst({
    where: { id: masterCandidateId, organizationId: user.organizationId },
  });

  const secondary = await prisma.candidate.findFirst({
    where: { id: secondaryCandidateId, organizationId: user.organizationId },
    include: {
      documents: true,
      notes: true,
      tags: true,
      applications: true,
    },
  });

  if (!master || !secondary) {
    return { success: false, error: 'One or both candidate records not found.' };
  }

  const eligibility = validateMergeEligibility(master as any, secondary as any);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.error };
  }

  const masterUpdateData: Record<string, any> = {};
  for (const [field, source] of Object.entries(fieldsRetained)) {
    if (source === 'SECONDARY') {
      masterUpdateData[field] = (secondary as any)[field];
    }
  }

  // Always merge skills union
  masterUpdateData.skills = mergeCandidateSkills(master.skills || [], secondary.skills || []);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Move documents, notes, tags to master
    await tx.candidateDocument.updateMany({
      where: { candidateId: secondary.id },
      data: { candidateId: master.id },
    });

    await tx.candidateNote.updateMany({
      where: { candidateId: secondary.id },
      data: { candidateId: master.id },
    });

    await tx.candidateTag.updateMany({
      where: { candidateId: secondary.id },
      data: { candidateId: master.id },
    });

    // 2. Move applications that do not collide with master
    const existingMasterJobIds = (
      await tx.application.findMany({
        where: { candidateId: master.id },
        select: { jobId: true },
      })
    ).map((a) => a.jobId);

    const nonCollidingApps = secondary.applications.filter(
      (app) => !existingMasterJobIds.includes(app.jobId)
    );

    if (nonCollidingApps.length > 0) {
      await tx.application.updateMany({
        where: { id: { in: nonCollidingApps.map((a) => a.id) } },
        data: { candidateId: master.id },
      });
    }

    // 3. Update master candidate profile
    const updatedMaster = await tx.candidate.update({
      where: { id: master.id },
      data: masterUpdateData,
    });

    // 4. Soft-archive secondary candidate (NEVER hard delete)
    await tx.candidate.update({
      where: { id: secondary.id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archiveReason: `Merged into candidate ${master.id}: ${mergeReason}`,
        isMerged: true,
        mergedIntoCandidateId: master.id,
        mergedAt: new Date(),
        mergedById: user.id,
        mergeReason,
      },
    });

    // 5. Record CandidateMerge record
    const mergeRecord = await tx.candidateMerge.create({
      data: {
        organizationId: user.organizationId,
        masterCandidateId: master.id,
        secondaryCandidateId: secondary.id,
        mergedById: user.id,
        mergeReason,
        fieldsRetained: fieldsRetained,
        preservedCounts: {
          documents: secondary.documents.length,
          notes: secondary.notes.length,
          tags: secondary.tags.length,
          applications: secondary.applications.length,
        },
      },
    });

    // 6. Resolve duplicate pairs referencing these candidates
    await tx.duplicatePair.updateMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { primaryCandidateId: master.id, duplicateCandidateId: secondary.id },
          { primaryCandidateId: secondary.id, duplicateCandidateId: master.id },
        ],
      },
      data: {
        status: 'MERGED',
        mergeId: mergeRecord.id,
        resolvedAt: new Date(),
        resolvedById: user.id,
      },
    });

    return { master: updatedMaster, mergeRecord };
  });

  await logSourcingAudit(user.id, 'MERGE_CANDIDATES', 'Candidate', master.id, { secondaryId: secondary.id }, {
    mergeId: result.mergeRecord.id,
    fieldsRetained: fieldsRetained,
  });

  revalidatePath('/sourcing/duplicates');
  revalidatePath('/candidates');
  return { success: true, data: result };
}

// ===========================================================================
// SOURCING WORKSPACE QUEUE ACTIONS
// ===========================================================================

export async function getSourcingQueueAction(filters?: Partial<SourcingQueueFilter>) {
  const user = await requireSourcingUser();
  const parsed = SourcingQueueFilterSchema.safeParse(filters || {});

  const filterData = parsed.success ? parsed.data : {};
  const { source, status, jobId, recruiterId, page = 1, limit = 20 } = filterData as any;

  const whereClause: any = {
    organizationId: user.organizationId,
  };

  if (source) whereClause.source = source;
  if (status) whereClause.status = status;
  if (jobId) whereClause.jobId = jobId;
  if (recruiterId) whereClause.assignedRecruiterId = recruiterId;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.sourcingItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.sourcingItem.count({ where: whereClause }),
  ]);

  // Aggregate stats across sources
  const [totalCount, pendingReview, duplicateFound, approved] = await Promise.all([
    prisma.sourcingItem.count({ where: { organizationId: user.organizationId } }),
    prisma.sourcingItem.count({ where: { organizationId: user.organizationId, status: 'PENDING_REVIEW' } }),
    prisma.sourcingItem.count({ where: { organizationId: user.organizationId, duplicateStatus: { not: 'NO_MATCH' } } }),
    prisma.sourcingItem.count({ where: { organizationId: user.organizationId, status: 'APPROVED' } }),
  ]);

  return {
    success: true,
    data: {
      items: items.map((i) => ({
        ...i,
        candidateName: i.candidateName || 'Unknown Candidate',
        experienceYears: i.experienceYears ? Number(i.experienceYears) : null,
        duplicateScore: i.duplicateScore ? Number(i.duplicateScore) : 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: totalCount,
        pendingReview,
        duplicateFound,
        approved,
      },
    },
  };
}

export async function updateSourcingItemAction(itemId: string, data: any) {
  const user = await requireSourcingUser();

  const item = await prisma.sourcingItem.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });

  if (!item) {
    return { success: false, error: 'Sourcing item not found.' };
  }

  const updated = await prisma.sourcingItem.update({
    where: { id: itemId },
    data: {
      candidateName: data.candidateName ?? item.candidateName,
      email: data.email ?? item.email,
      phone: data.phone ?? item.phone,
      currentCompany: data.currentCompany ?? item.currentCompany,
      currentTitle: data.currentTitle ?? item.currentTitle,
      location: data.location ?? item.location,
      skills: Array.isArray(data.skills) ? data.skills : item.skills,
      experienceYears: data.experienceYears !== undefined && data.experienceYears !== null ? new Prisma.Decimal(data.experienceYears) : item.experienceYears,
      assignedRecruiterId: data.assignedRecruiterId ?? item.assignedRecruiterId,
      jobId: data.jobId ?? item.jobId,
      notes: data.notes ?? item.notes,
      tags: Array.isArray(data.tags) ? data.tags : item.tags,
    },
  });

  revalidatePath('/sourcing');
  return { success: true, data: updated };
}

export async function approveSourcingItemAction(itemId: string, options?: { jobId?: string; notes?: string }) {
  const user = await requireSourcingUser();

  const item = await prisma.sourcingItem.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });

  if (!item) {
    return { success: false, error: 'Sourcing item not found.' };
  }

  if (item.status === 'APPROVED' && item.createdCandidateId) {
    return { success: false, error: 'Sourcing item has already been approved.' };
  }

  const email = item.email ? normalizeEmail(item.email) : `sourced-${Date.now()}@temp.hireflow.internal`;
  const phone = item.phone ? normalizePhone(item.phone) : null;
  const targetJobId = options?.jobId || item.jobId;
  const candidateCode = `CAND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const candidate = await prisma.$transaction(async (tx) => {
    // 1. Create candidate record
    const newCandidate = await tx.candidate.create({
      data: {
        organizationId: user.organizationId,
        code: candidateCode,
        name: item.candidateName || 'Unknown Candidate',
        email,
        phone,
        currentCompany: item.currentCompany,
        currentTitle: item.currentTitle,
        location: item.location,
        skills: item.skills,
        experienceYears: item.experienceYears,
        source: item.source,
        ownerId: item.assignedRecruiterId || user.id,
      },
    });

    // 2. Link job application if requested
    if (targetJobId) {
      await tx.application.create({
        data: {
          candidateId: newCandidate.id,
          jobId: targetJobId,
          status: 'SOURCED',
        },
      });
    }

    // 3. Mark sourcing item as APPROVED
    await tx.sourcingItem.update({
      where: { id: itemId },
      data: {
        status: 'APPROVED',
        createdCandidateId: newCandidate.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    return newCandidate;
  });

  await logSourcingAudit(user.id, 'APPROVE_SOURCING_ITEM', 'Candidate', candidate.id, null, {
    sourcingItemId: itemId,
    source: item.source,
  });

  revalidatePath('/sourcing');
  revalidatePath('/candidates');
  return { success: true, data: candidate };
}

export async function rejectSourcingItemAction(itemId: string, reason?: string) {
  const user = await requireSourcingUser();

  const item = await prisma.sourcingItem.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });

  if (!item) {
    return { success: false, error: 'Sourcing item not found.' };
  }

  const updated = await prisma.sourcingItem.update({
    where: { id: itemId },
    data: {
      status: 'REJECTED',
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  await logSourcingAudit(user.id, 'REJECT_SOURCING_ITEM', 'SourcingItem', itemId, null, {
    reason,
  });

  revalidatePath('/sourcing');
  return { success: true, data: updated };
}

// ===========================================================================
// CHROME EXTENSION TOKEN ACTIONS
// ===========================================================================

export async function issueExtensionTokenAction() {
  const user = await requireSourcingUser();

  const { rawToken, tokenHash, expiresAt } = generateExtensionCaptureToken();

  await prisma.extensionCaptureToken.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  await logSourcingAudit(user.id, 'ISSUE_EXTENSION_TOKEN', 'User', user.id, null, {
    expiresAt,
  });

  return {
    success: true,
    data: {
      token: rawToken,
      expiresAt,
      ttlMinutes: 15,
    },
  };
}

export async function getActiveExtensionTokensAction() {
  const user = await requireSourcingUser();

  const tokens = await prisma.extensionCaptureToken.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { success: true, data: tokens };
}

export async function revokeExtensionTokensAction() {
  const user = await requireSourcingUser();

  await prisma.extensionCaptureToken.updateMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return { success: true };
}

// ===========================================================================
// INTEGRATIONS ACTIONS
// ===========================================================================

export async function getSourcingIntegrationsAction() {
  const user = await requireSourcingUser();

  const integrations = await prisma.sourcingIntegration.findMany({
    where: { organizationId: user.organizationId },
  });

  const providers = ['NAUKRI', 'FOUNDIT', 'INBOUND_EMAIL'];
  const dbMap = new Map(integrations.map((i) => [i.provider, i]));

  const reports = await Promise.all(
    providers.map(async (p) => {
      const record = dbMap.get(p);
      const providerInstance = getSourcingProvider(p as any);
      return providerInstance.checkStatus(record?.encryptedCredentials, record?.config);
    })
  );

  return { success: true, data: reports };
}

export async function connectSourcingIntegrationAction(provider: string, config?: any) {
  const user = await requireSourcingUser();

  const providerInstance = getSourcingProvider(provider as any);
  const testRes = await providerInstance.validateCredentials({ sandboxMode: true });

  const record = await prisma.sourcingIntegration.upsert({
    where: {
      organizationId_provider: {
        organizationId: user.organizationId,
        provider,
      },
    },
    create: {
      organizationId: user.organizationId,
      provider,
      status: testRes.valid ? 'CONNECTED' : 'ERROR',
      encryptedCredentials: 'enc_sandbox_credentials_mock',
      config: config || { sandboxMode: true },
      lastSyncAt: new Date(),
      lastError: testRes.valid ? null : testRes.error,
      connectedById: user.id,
    },
    update: {
      status: testRes.valid ? 'CONNECTED' : 'ERROR',
      config: config || { sandboxMode: true },
      lastSyncAt: new Date(),
      lastError: testRes.valid ? null : testRes.error,
      connectedById: user.id,
    },
  });

  revalidatePath('/sourcing');
  return { success: true, data: record };
}

export async function disconnectSourcingIntegrationAction(provider: string) {
  const user = await requireSourcingUser();

  await prisma.sourcingIntegration.deleteMany({
    where: {
      organizationId: user.organizationId,
      provider,
    },
  });

  revalidatePath('/sourcing');
  return { success: true };
}
