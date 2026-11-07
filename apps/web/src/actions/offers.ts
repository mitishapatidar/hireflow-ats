'use server';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  CreateOfferSchema,
  CreateOfferInput,
  DeclineOfferSchema,
  DeclineOfferInput,
  ConfirmJoiningSchema,
  ConfirmJoiningInput,
  serializeOfferForRole,
  isValidOfferTransition,
  calculatePlacementFee,
  calculatePaymentDueDate,
  UserRole,
  OfferStatus,
} from '@hireflow/shared';

// Helper for audit logging
async function logOfferEvent(
  actorId: string,
  action: string,
  offerId: string,
  before?: Prisma.InputJsonValue | null,
  after?: Prisma.InputJsonValue | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'offer',
        entityId: offerId,
        before: before ?? Prisma.JsonNull,
        after: after ?? Prisma.JsonNull,
        ipAddress: '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('[Offers Action] Failed to write audit log:', err);
  }
}

/**
 * 1. GET OFFERS DASHBOARD STATS
 * 4 live KPI cards matching Frame 08:
 * - Released MTD + MoM delta
 * - Accepted count + % rate
 * - Pending response count
 * - Confirmed Placements count + Total Fee Sum (INR)
 */
export async function getOffersDashboardStatsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPriorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPriorMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const orgId = user.organizationId;

  // Base scope for recruiter if not manager/admin
  const recruiterScope: Prisma.OfferWhereInput = user.role === UserRole.RECRUITER
    ? { application: { job: { ownerId: user.id } } }
    : {};

  const [
    releasedCurrentMtd,
    releasedPriorMtd,
    acceptedCurrentMtd,
    pendingResponseCount,
    placementsCurrentMtd,
  ] = await Promise.all([
    prisma.offer.count({
      where: {
        organizationId: orgId,
        status: { in: ['RELEASED', 'ACCEPTED', 'JOINED'] },
        releaseDate: { gte: startOfCurrentMonth },
        ...recruiterScope,
      },
    }),
    prisma.offer.count({
      where: {
        organizationId: orgId,
        status: { in: ['RELEASED', 'ACCEPTED', 'JOINED'] },
        releaseDate: { gte: startOfPriorMonth, lte: endOfPriorMonth },
        ...recruiterScope,
      },
    }),
    prisma.offer.count({
      where: {
        organizationId: orgId,
        status: { in: ['ACCEPTED', 'JOINED'] },
        acceptedAt: { gte: startOfCurrentMonth },
        ...recruiterScope,
      },
    }),
    prisma.offer.count({
      where: {
        organizationId: orgId,
        status: 'RELEASED',
        ...recruiterScope,
      },
    }),
    prisma.placement.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: startOfCurrentMonth },
        ...(user.role === UserRole.RECRUITER ? { application: { job: { ownerId: user.id } } } : {}),
      },
      select: {
        id: true,
        feeAmount: true,
      },
    }),
  ]);

  const momDelta = releasedPriorMtd === 0
    ? (releasedCurrentMtd > 0 ? 100 : 0)
    : Math.round(((releasedCurrentMtd - releasedPriorMtd) / releasedPriorMtd) * 100);

  const acceptanceRate = releasedCurrentMtd === 0
    ? 0
    : Math.round((acceptedCurrentMtd / releasedCurrentMtd) * 100);

  const totalFeeSum = placementsCurrentMtd.reduce((acc, curr) => acc + Number(curr.feeAmount), 0);

  // If client or candidate, do not expose internal agency revenue
  const isExternal = user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE;

  return {
    releasedMtd: {
      count: releasedCurrentMtd,
      momDeltaPercent: momDelta,
    },
    acceptedMtd: {
      count: acceptedCurrentMtd,
      acceptanceRatePercent: acceptanceRate,
    },
    pendingResponse: {
      count: pendingResponseCount,
    },
    confirmedPlacements: {
      count: placementsCurrentMtd.length,
      totalFeeSum: isExternal ? undefined : totalFeeSum,
    },
  };
}

/**
 * 2. GET OFFERS LIST
 * Retrieves paginated/filtered offers with role-based data serialization.
 */
export async function getOffersAction(filters?: {
  status?: string;
  clientId?: string;
  query?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const orgId = user.organizationId;
  const where: Prisma.OfferWhereInput = {
    organizationId: orgId,
  };

  if (filters?.status && filters.status !== 'ALL') {
    where.status = filters.status as any;
  }
  if (filters?.clientId) {
    where.clientId = filters.clientId;
  }
  if (filters?.query) {
    where.OR = [
      { application: { candidate: { name: { contains: filters.query, mode: 'insensitive' } } } },
      { application: { candidate: { email: { contains: filters.query, mode: 'insensitive' } } } },
      { application: { job: { title: { contains: filters.query, mode: 'insensitive' } } } },
      { client: { legalName: { contains: filters.query, mode: 'insensitive' } } },
    ];
  }

  // Role scoping
  if (user.role === UserRole.RECRUITER) {
    where.application = { job: { ownerId: user.id } };
  } else if (user.role === UserRole.CLIENT) {
    const access = await prisma.clientAccess.findFirst({
      where: { userId: user.id },
    });
    if (!access) return { offers: [] };
    where.clientId = access.clientId;
  }

  const rawOffers = await prisma.offer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      application: {
        include: {
          candidate: { select: { id: true, name: true, email: true, phone: true } },
          job: {
            select: {
              id: true,
              title: true,
              code: true,
              owner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      client: { select: { id: true, legalName: true, code: true, feePercentage: true } },
      placement: {
        select: {
          id: true,
          feeAmount: true,
          paymentStatus: true,
          joiningDate: true,
        },
      },
    },
  });

  const serialized = rawOffers.map((raw) => {
    const feePct = raw.client?.feePercentage ? Number(raw.client.feePercentage) : 8.33;
    const salary = Number(raw.offeredSalary);
    const agencyMarginAmount = Math.round((salary * feePct) / 100);

    const base = {
      id: raw.id,
      applicationId: raw.applicationId,
      clientId: raw.clientId,
      candidate: raw.application.candidate,
      candidateName: raw.application.candidate?.name || 'Candidate',
      candidateEmail: raw.application.candidate?.email,
      job: {
        id: raw.application.job.id,
        title: raw.application.job.title,
        code: raw.application.job.code,
        recruiterName: raw.application.job.owner?.name || 'Unassigned',
      },
      jobTitle: raw.application.job.title,
      jobCode: raw.application.job.code,
      client: {
        id: raw.client.id,
        name: raw.client.legalName,
        code: raw.client.code,
      },
      clientName: raw.client.legalName,
      offeredSalary: salary,
      agencyMarginAmount,
      agencyMarginPercent: feePct,
      status: raw.status,
      joiningDate: raw.joiningDate?.toISOString() || null,
      releaseDate: raw.releaseDate?.toISOString() || null,
      expiryDate: raw.expiryDate?.toISOString() || null,
      acceptedAt: raw.acceptedAt?.toISOString() || null,
      declinedAt: raw.declinedAt?.toISOString() || null,
      declineReason: raw.declineReason,
      joinedAt: raw.joinedAt?.toISOString() || null,
      notes: raw.notes,
      placementId: raw.placementId,
      placement: raw.placement,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
    };

    return {
      ...serializeOfferForRole(base, user.role),
      candidate: raw.application.candidate,
      job: base.job,
      client: base.client,
      agencyMarginAmount: user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE ? undefined : agencyMarginAmount,
      agencyMarginPercent: user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE ? undefined : feePct,
    };
  });

  return { offers: serialized };
}

/**
 * 3. CREATE DRAFT OFFER
 */
export async function createOfferAction(data: CreateOfferInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const parsed = CreateOfferSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
  }

  const { applicationId, clientId, offeredSalary, joiningDate, expiryDate, notes } = parsed.data;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });
  if (!app) throw new Error('Application not found');

  const offer = await prisma.offer.create({
    data: {
      applicationId,
      clientId,
      organizationId: user.organizationId,
      offeredSalary: new Prisma.Decimal(offeredSalary),
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      notes: notes || null,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  await logOfferEvent(user.id, 'OFFER_CREATED', offer.id, null, {
    status: 'DRAFT',
    offeredSalary,
    clientId,
  });

  revalidatePath('/offers');
  return { success: true, offerId: offer.id };
}

/**
 * 4. RELEASE OFFER
 */
export async function releaseOfferAction(offerId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const existing = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!existing) throw new Error('Offer not found');

  if (!isValidOfferTransition(existing.status as any, OfferStatus.RELEASED)) {
    throw new Error(`Invalid offer transition from ${existing.status} to RELEASED`);
  }

  const updated = await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'RELEASED',
      releaseDate: new Date(),
    },
  });

  await logOfferEvent(user.id, 'OFFER_RELEASED', offerId, { status: existing.status }, { status: 'RELEASED' });

  revalidatePath('/offers');
  return { success: true, offer: updated };
}

/**
 * 5. ACCEPT OFFER
 */
export async function acceptOfferAction(offerId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const existing = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!existing) throw new Error('Offer not found');

  if (!isValidOfferTransition(existing.status as any, OfferStatus.ACCEPTED)) {
    throw new Error(`Invalid offer transition from ${existing.status} to ACCEPTED`);
  }

  const updated = await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });

  await logOfferEvent(user.id, 'OFFER_ACCEPTED', offerId, { status: existing.status }, { status: 'ACCEPTED' });

  revalidatePath('/offers');
  return { success: true, offer: updated };
}

/**
 * 6. DECLINE OFFER
 */
export async function declineOfferAction(offerId: string, input: DeclineOfferInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const parsed = DeclineOfferSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
  }

  const existing = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!existing) throw new Error('Offer not found');

  if (!isValidOfferTransition(existing.status as any, OfferStatus.DECLINED)) {
    throw new Error(`Invalid offer transition from ${existing.status} to DECLINED`);
  }

  const updated = await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'DECLINED',
      declinedAt: new Date(),
      declineReason: parsed.data.declineReason,
    },
  });

  await logOfferEvent(user.id, 'OFFER_DECLINED', offerId, { status: existing.status }, {
    status: 'DECLINED',
    declineReason: parsed.data.declineReason,
  });

  revalidatePath('/offers');
  return { success: true, offer: updated };
}

/**
 * 7. CONFIRM JOINING -> CREATES PLACEMENT TRANSACTIONALLY
 * Placement is ONLY created when candidate joins.
 */
export async function confirmJoiningAction(offerId: string, input: ConfirmJoiningInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER && user.role !== UserRole.RECRUITER) {
    throw new Error('Forbidden: Insufficient privileges to confirm candidate joining');
  }

  const parsed = ConfirmJoiningSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
  }

  const existingOffer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      application: true,
      client: true,
      placement: true,
    },
  });

  if (!existingOffer) throw new Error('Offer not found');

  if (existingOffer.status !== 'ACCEPTED') {
    throw new Error(`Cannot confirm joining: Offer must be ACCEPTED, current status is ${existingOffer.status}`);
  }

  if (existingOffer.placementId || existingOffer.placement) {
    throw new Error('Placement already confirmed for this offer');
  }

  const existingAppPlacement = await prisma.placement.findUnique({
    where: { applicationId: existingOffer.applicationId },
  });
  if (existingAppPlacement) {
    throw new Error('Placement already exists for this application');
  }

  const joiningDate = (input as any).joinedAt ? new Date((input as any).joinedAt) : new Date();

  // Server-side calculated placement commercial fee
  const feeCalc = calculatePlacementFee(
    Number(existingOffer.offeredSalary),
    existingOffer.client?.feePercentage ? Number(existingOffer.client.feePercentage) : null,
    (input as any).adjustmentAmount ?? 0
  );
  const finalFeeAmount = feeCalc.baseFee > 0 ? feeCalc.netFee : ((input as any).feeAmount || feeCalc.netFee);
  const feeBasis = feeCalc.baseFee > 0 ? feeCalc.feeBasis : ((input as any).feeBasis || 'PERCENTAGE');
  const paymentTerms = (input as any).paymentTerms || 'NET_30';
  const dueDate = (input as any).dueDate
    ? new Date((input as any).dueDate)
    : calculatePaymentDueDate(joiningDate, paymentTerms);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Placement
    const placement = await tx.placement.create({
      data: {
        applicationId: existingOffer.applicationId,
        clientId: existingOffer.clientId,
        organizationId: existingOffer.organizationId,
        feeBasis,
        ctcSnapshot: existingOffer.offeredSalary,
        feePercentage: existingOffer.client?.feePercentage ?? null,
        feeAmount: new Prisma.Decimal(finalFeeAmount),
        adjustmentAmount: new Prisma.Decimal(feeCalc.adjustmentAmount),
        adjustmentReason: (input as any).adjustmentReason || null,
        paymentTerms,
        dueDate,
        paymentStatus: 'PENDING',
        amountReceived: new Prisma.Decimal(0),
        invoiceNumber: (input as any).invoiceNumber || null,
        notes: (input as any).notes || null,
        joiningDate,
        createdById: user.id,
      },
    });

    // 2. Create JoiningConfirmation evidence
    await tx.joiningConfirmation.create({
      data: {
        placementId: placement.id,
        source: (input as any).joiningEvidence?.source || 'RECRUITER_VERIFIED',
        confirmedBy: (input as any).joiningEvidence?.confirmedBy || user.name || user.email || 'Recruiter',
        confirmedAt: (input as any).joiningEvidence?.confirmedAt ? new Date((input as any).joiningEvidence.confirmedAt) : new Date(),
        documentUrl: (input as any).joiningEvidence?.documentUrl || null,
        notes: (input as any).joiningEvidence?.notes || null,
        createdById: user.id,
      },
    });

    // 3. Create initial PlacementHistory
    await tx.placementHistory.create({
      data: {
        placementId: placement.id,
        eventType: 'CREATED',
        actorId: user.id,
        actorRole: user.role,
        newState: {
          feeAmount: finalFeeAmount,
          status: 'PENDING',
          ctc: Number(existingOffer.offeredSalary),
        },
        notes: 'Candidate joining confirmed and placement created.',
      },
    });

    // 4. Update Offer
    const updatedOffer = await tx.offer.update({
      where: { id: offerId },
      data: {
        status: 'JOINED',
        joinedAt: joiningDate,
        placementId: placement.id,
      },
    });

    // 5. Update Application status to PLACED
    await tx.application.update({
      where: { id: existingOffer.applicationId },
      data: {
        status: 'PLACED',
      },
    });

    return { placement, updatedOffer };
  });

  await logOfferEvent(user.id, 'OFFER_CONFIRMED_JOINED', offerId, { status: 'ACCEPTED' }, {
    status: 'JOINED',
    placementId: result.placement.id,
    feeAmount: finalFeeAmount,
  });

  revalidatePath('/offers');
  revalidatePath('/placements');
  revalidatePath('/reports');
  return {
    success: true,
    offer: result.updatedOffer,
    placement: result.placement,
  };
}
