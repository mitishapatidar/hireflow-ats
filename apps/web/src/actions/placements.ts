'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  UserRole,
  PaymentStatus,
  OfferStatus,
  serializePlacementForRole,
  RecordPlacementPaymentSchema,
  RecordPlacementPaymentInput,
  UpdatePlacementPaymentStatusSchema,
  UpdatePlacementPaymentStatusInput,
} from '@hireflow/shared';

/**
 * 1. GET PLACEMENT STATS ACTION
 * 5 live KPI cards matching Figma Frame 40
 */
export async function getPlacementStatsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const isLeadership = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;

  const [totalConfirmedPlacements, placementsMtd, upcomingJoiningDates, pendingFeePayments, mtdPlacements] =
    await Promise.all([
      prisma.placement.count({ where: { organizationId: user.organizationId } }),
      prisma.placement.count({
        where: {
          organizationId: user.organizationId,
          joiningDate: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.offer.count({
        where: {
          organizationId: user.organizationId,
          status: OfferStatus.ACCEPTED,
          placementId: null,
        },
      }),
      prisma.placement.count({
        where: {
          organizationId: user.organizationId,
          paymentStatus: {
            in: [PaymentStatus.PENDING, PaymentStatus.INVOICED, PaymentStatus.PARTIALLY_PAID, PaymentStatus.OVERDUE],
          },
        },
      }),
      isLeadership
        ? prisma.placement.findMany({
            where: {
              organizationId: user.organizationId,
              joiningDate: { gte: startOfMonth, lte: endOfMonth },
            },
            select: { feeAmount: true },
          })
        : Promise.resolve([]),
    ]);

  const totalFeeBookedMtd = isLeadership
    ? mtdPlacements.reduce((sum, p) => sum + Number(p.feeAmount || 0), 0)
    : null;

  return {
    totalConfirmedPlacements,
    placementsMtd,
    upcomingJoiningDates,
    pendingFeePayments,
    totalFeeBookedMtd,
    asOfTimestamp: now.toISOString(),
  };
}

/**
 * 2. GET UPCOMING OFFERS ACTION
 * Accepted offers whose joining date is in the future or not confirmed yet
 */
export async function getUpcomingJoiningOffersAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const offers = await prisma.offer.findMany({
    where: {
      organizationId: user.organizationId,
      status: OfferStatus.ACCEPTED,
      placementId: null,
    },
    include: {
      client: { select: { id: true, legalName: true, code: true, feePercentage: true } },
      application: {
        include: {
          candidate: { select: { id: true, name: true, email: true, phone: true } },
          job: { select: { id: true, title: true, code: true } },
        },
      },
    },
    orderBy: { joiningDate: 'asc' },
  });

  return offers.map((o) => ({
    id: o.id,
    applicationId: o.applicationId,
    candidateName: o.application?.candidate?.name || 'Candidate',
    candidateEmail: o.application?.candidate?.email,
    candidatePhone: o.application?.candidate?.phone,
    jobTitle: o.application?.job?.title || 'Job',
    jobCode: o.application?.job?.code,
    clientName: o.client?.legalName || 'Client',
    clientId: o.clientId,
    clientFeePercentage: o.client?.feePercentage ? Number(o.client.feePercentage) : null,
    offeredSalary: Number(o.offeredSalary),
    joiningDate: o.joiningDate,
    acceptedAt: o.acceptedAt,
    status: o.status,
  }));
}

/**
 * 3. GET PLACEMENTS LIST ACTION
 * Paginated placements list with status and search filters
 */
export async function getPlacementsAction(params?: {
  page?: number;
  limit?: number;
  paymentStatus?: string;
  clientId?: string;
  search?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.PlacementWhereInput = { organizationId: user.organizationId };

  if (params?.paymentStatus && Object.values(PaymentStatus).includes(params.paymentStatus as any)) {
    where.paymentStatus = params.paymentStatus as PaymentStatus;
  }

  if (params?.clientId) {
    where.clientId = params.clientId;
  }

  if (params?.search && params.search.trim().length > 0) {
    const queryStr = params.search.trim();
    where.OR = [
      { invoiceNumber: { contains: queryStr, mode: 'insensitive' } },
      { client: { legalName: { contains: queryStr, mode: 'insensitive' } } },
      { application: { candidate: { name: { contains: queryStr, mode: 'insensitive' } } } },
      { application: { job: { title: { contains: queryStr, mode: 'insensitive' } } } },
    ];
  }

  const [total, placements] = await Promise.all([
    prisma.placement.count({ where }),
    prisma.placement.findMany({
      where,
      include: {
        client: { select: { id: true, legalName: true, code: true, feePercentage: true } },
        application: {
          include: {
            candidate: { select: { id: true, name: true, email: true } },
            job: { select: { id: true, title: true, code: true } },
          },
        },
        joiningConfirmation: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const items = placements.map((p) => serializePlacementForRole(p, user.role));

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 4. GET PLACEMENT DETAILS ACTION
 * Fetches placement by ID with candidate, job, evidence, installments & timeline
 */
export async function getPlacementDetailsAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const placement = await prisma.placement.findUnique({
    where: { id },
    include: {
      client: true,
      application: {
        include: {
          candidate: true,
          job: true,
        },
      },
      offer: true,
      joiningConfirmation: true,
      payments: { orderBy: { paymentDate: 'desc' } },
      history: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!placement || placement.organizationId !== user.organizationId) {
    throw new Error('Placement record not found');
  }

  return serializePlacementForRole(placement, user.role);
}

/**
 * 5. RECORD PLACEMENT PAYMENT ACTION
 * Records installment and auto-transitions status to PARTIALLY_PAID or PAID
 */
export async function recordPlacementPaymentAction(id: string, input: RecordPlacementPaymentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new Error('Forbidden: Only managers and admins can record payments');
  }

  const parsed = RecordPlacementPaymentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
  }

  await prisma.$transaction(async (tx) => {
    const placement = await tx.placement.findUnique({ where: { id } });
    if (!placement || placement.organizationId !== user.organizationId) {
      throw new Error('Placement record not found');
    }

    const totalFee = new Prisma.Decimal(placement.feeAmount);
    const paymentAmount = new Prisma.Decimal(parsed.data.amount);

    // Sum all existing ledger entries to prevent balance corruption from race conditions
    const aggregate = await tx.placementPayment.aggregate({
      where: { placementId: id },
      _sum: { amount: true },
    });
    const currentReceived = new Prisma.Decimal(aggregate._sum.amount || 0);
    const newReceived = currentReceived.add(paymentAmount);

    if (newReceived.greaterThan(totalFee)) {
      const remainingBalance = totalFee.minus(currentReceived);
      throw new Error(
        `Overpayment not permitted: Payment amount ₹${parsed.data.amount} exceeds outstanding balance of ₹${remainingBalance.toString()}`
      );
    }

    const isFullyPaid = newReceived.greaterThanOrEqualTo(totalFee);
    const newPaymentStatus = isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

    const payment = await tx.placementPayment.create({
      data: {
        placementId: id,
        amount: paymentAmount,
        paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : new Date(),
        paymentMethod: parsed.data.paymentMethod,
        referenceNumber: parsed.data.referenceNumber,
        notes: parsed.data.notes || null,
        createdById: user.id,
      },
    });

    await tx.placement.update({
      where: { id },
      data: {
        amountReceived: newReceived,
        paymentStatus: newPaymentStatus,
        paidAt: isFullyPaid ? (placement.paidAt || new Date()) : placement.paidAt,
      },
    });

    await tx.placementHistory.create({
      data: {
        placementId: id,
        eventType: 'PAYMENT_RECORDED',
        actorId: user.id,
        actorRole: user.role,
        newState: {
          paymentId: payment.id,
          amount: parsed.data.amount,
          totalReceived: newReceived.toString(),
          paymentStatus: newPaymentStatus,
        },
        notes: `Recorded installment payment of ₹${parsed.data.amount.toLocaleString('en-IN')} (Ref: ${parsed.data.referenceNumber}).`,
      },
    });
  });

  revalidatePath('/placements');
  revalidatePath(`/placements/${id}`);
  return { success: true };
}

/**
 * 6. UPDATE PLACEMENT PAYMENT STATUS ACTION
 */
export async function updatePlacementPaymentStatusAction(id: string, input: UpdatePlacementPaymentStatusInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new Error('Forbidden: Only managers and admins can update payment status');
  }

  const parsed = UpdatePlacementPaymentStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
  }

  const placement = await prisma.placement.findUnique({ where: { id } });
  if (!placement || placement.organizationId !== user.organizationId) {
    throw new Error('Placement record not found');
  }

  const previousStatus = placement.paymentStatus;
  const newStatus = parsed.data.paymentStatus;

  const currentReceived = new Prisma.Decimal(placement.amountReceived || 0);
  const totalFee = new Prisma.Decimal(placement.feeAmount);

  // Prevent arbitrary status changes contradicting the ledger
  if (newStatus === PaymentStatus.PAID && currentReceived.lessThan(totalFee)) {
    throw new Error(
      `Cannot mark placement as PAID when outstanding balance of ₹${totalFee.minus(currentReceived).toString()} remains`
    );
  }
  if (newStatus === PaymentStatus.PENDING && currentReceived.greaterThan(0)) {
    throw new Error('Cannot reset placement to PENDING when installment payments have already been received');
  }
  if (newStatus === PaymentStatus.WAIVED) {
    const reason = (parsed.data as any).waiverReason || parsed.data.notes;
    if (!reason || reason.trim().length === 0) {
      throw new Error('A mandatory justification reason is required to waive a placement balance');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.placement.update({
      where: { id },
      data: {
        paymentStatus: newStatus as PaymentStatus,
        invoiceNumber: parsed.data.invoiceNumber !== undefined ? parsed.data.invoiceNumber : placement.invoiceNumber,
        paidAt: newStatus === PaymentStatus.PAID ? (placement.paidAt || new Date()) : placement.paidAt,
      },
    });

    await tx.placementHistory.create({
      data: {
        placementId: id,
        eventType: 'STATUS_CHANGED',
        actorId: user.id,
        actorRole: user.role,
        previousState: { paymentStatus: String(previousStatus) },
        newState: {
          paymentStatus: String(newStatus),
          invoiceNumber: parsed.data.invoiceNumber || null,
          waiverReason: (parsed.data as any).waiverReason || null,
        },
        notes:
          parsed.data.notes ||
          ((parsed.data as any).waiverReason
            ? `Placement balance waived: ${(parsed.data as any).waiverReason}`
            : `Payment status changed from ${previousStatus} to ${newStatus}.`),
      },
    });
  });

  revalidatePath('/placements');
  revalidatePath(`/placements/${id}`);
  return { success: true };
}
