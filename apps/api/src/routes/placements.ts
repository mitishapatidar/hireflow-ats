/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, Prisma } from '@hireflow/db';
import {
  UserRole,
  PaymentStatus,
  OfferStatus,
  serializePlacementForRole,
  RecordPlacementPaymentSchema,
  UpdatePlacementPaymentStatusSchema,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';

export const placementRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 1. GET /api/placements/stats — 5 KPI summary cards for Frame 40 Placement Dashboard
  server.get(
    '/stats',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { organizationId, role } = request.user;
      const isLeadership = role === UserRole.ADMIN || role === UserRole.MANAGER;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // KPI 1: Total Confirmed Placements
      const totalConfirmedPlacements = await prisma.placement.count({
        where: { organizationId },
      });

      // KPI 2: Placements MTD
      const placementsMtd = await prisma.placement.count({
        where: {
          organizationId,
          joiningDate: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      // KPI 3: Upcoming Joining Dates (Accepted offers not yet confirmed)
      const upcomingJoiningDates = await prisma.offer.count({
        where: {
          organizationId,
          status: OfferStatus.ACCEPTED,
          placementId: null,
        },
      });

      // KPI 4: Pending Fee Payments (Placements with unpaid fee balance)
      const pendingFeePayments = await prisma.placement.count({
        where: {
          organizationId,
          paymentStatus: {
            in: [PaymentStatus.PENDING, PaymentStatus.INVOICED, PaymentStatus.PARTIALLY_PAID, PaymentStatus.OVERDUE],
          },
        },
      });

      // KPI 5: Total Fee Booked MTD (Commercial numbers strictly for Leadership)
      let totalFeeBookedMtd = 0;
      if (isLeadership) {
        const mtdPlacements = await prisma.placement.findMany({
          where: {
            organizationId,
            joiningDate: { gte: startOfMonth, lte: endOfMonth },
          },
          select: { feeAmount: true },
        });
        totalFeeBookedMtd = mtdPlacements.reduce(
          (sum, p) => sum + Number(p.feeAmount || 0),
          0
        );
      }

      return reply.send({
        success: true,
        data: {
          totalConfirmedPlacements,
          placementsMtd,
          upcomingJoiningDates,
          pendingFeePayments,
          totalFeeBookedMtd: isLeadership ? totalFeeBookedMtd : null,
          asOfTimestamp: now.toISOString(),
        },
      });
    }
  );

  // 2. GET /api/placements/upcoming-offers — Accepted offers awaiting verified joining
  server.get(
    '/upcoming-offers',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { organizationId, role } = request.user;
      const isLeadership = role === UserRole.ADMIN || role === UserRole.MANAGER;

      const upcomingOffers = await prisma.offer.findMany({
        where: {
          organizationId,
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

      const formatted = upcomingOffers.map((o) => ({
        id: o.id,
        applicationId: o.applicationId,
        candidateName: o.application?.candidate?.name || 'Candidate',
        candidateEmail: isLeadership ? o.application?.candidate?.email : undefined,
        jobTitle: o.application?.job?.title || 'Job',
        jobCode: o.application?.job?.code,
        clientName: o.client?.legalName || 'Client',
        clientId: o.clientId,
        offeredSalary: isLeadership ? Number(o.offeredSalary) : undefined,
        clientFeePercentage: isLeadership && o.client?.feePercentage ? Number(o.client.feePercentage) : undefined,
        joiningDate: o.joiningDate,
        acceptedAt: o.acceptedAt,
        status: o.status,
      }));

      return reply.send({
        success: true,
        data: formatted,
      });
    }
  );

  // 3. GET /api/placements — Paginated placements list with status filters & search
  server.get(
    '/',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { organizationId, role } = request.user;
      const {
        page = '1',
        limit = '20',
        paymentStatus,
        clientId,
        search,
      } = request.query as {
        page?: string;
        limit?: string;
        paymentStatus?: string;
        clientId?: string;
        search?: string;
      };

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const where: any = { organizationId };

      if (paymentStatus && Object.values(PaymentStatus).includes(paymentStatus as any)) {
        where.paymentStatus = paymentStatus;
      }

      if (clientId) {
        where.clientId = clientId;
      }

      if (search && search.trim().length > 0) {
        const queryStr = search.trim();
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
          take: limitNum,
        }),
      ]);

      const serialized = placements.map((p) => serializePlacementForRole(p, role));

      return reply.send({
        success: true,
        data: {
          items: serialized,
          meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    }
  );

  // 4. GET /api/placements/:id — Placement details with evidence, payments & history
  server.get(
    '/:id',
    {
      preHandler: [(server as any).authenticate],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId, role } = request.user;

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

      if (!placement || placement.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Placement record not found' });
      }

      // Check client authorization if role is CLIENT
      if (role === UserRole.CLIENT) {
        const clientAccess = await prisma.clientAccess.findFirst({
          where: { userId: request.user.id, clientId: placement.clientId },
        });
        if (!clientAccess) {
          return reply.status(403).send({ success: false, error: 'Unauthorized access to placement' });
        }
        if (
          Array.isArray(clientAccess.authorizedJobIds) &&
          (clientAccess.authorizedJobIds as string[]).length > 0 &&
          !(clientAccess.authorizedJobIds as string[]).includes(placement.application.jobId)
        ) {
          return reply.status(403).send({
            success: false,
            error: 'Unauthorized: Client lacks access to the job for this placement',
          });
        }
      } else if (role === UserRole.CANDIDATE) {
        // Enforce candidate ownership: candidate can only view their own placement
        const candidate = await prisma.candidate.findFirst({
          where: {
            organizationId,
            isArchived: false,
            OR: [
              { userId: request.user.id },
              ...(request.user.email ? [{ email: request.user.email }] : []),
            ],
          },
        });
        if (!candidate || placement.application.candidateId !== candidate.id) {
          return reply.status(403).send({
            success: false,
            error: 'Unauthorized: Candidates can only access their own placement record',
          });
        }
      }

      const serialized = serializePlacementForRole(placement, role);

      return reply.send({
        success: true,
        data: serialized,
      });
    }
  );

  // 5. PATCH /api/placements/:id/payment-status — Update payment status & invoice number
  server.patch(
    '/:id/payment-status',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId, id: userId, role } = request.user;

      const parseResult = UpdatePlacementPaymentStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: parseResult.error.flatten() });
      }

      const { paymentStatus, invoiceNumber, notes, waiverReason } = parseResult.data as any;

      const placement = await prisma.placement.findUnique({
        where: { id },
      });

      if (!placement || placement.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Placement record not found' });
      }

      const currentReceived = new Prisma.Decimal(placement.amountReceived || 0);
      const totalFee = new Prisma.Decimal(placement.feeAmount);

      // Ledger consistency check: prevent arbitrary status changes contradicting the ledger
      if (paymentStatus === PaymentStatus.PAID) {
        if (currentReceived.lessThan(totalFee)) {
          return reply.status(400).send({
            success: false,
            error: `Cannot mark placement as PAID when outstanding balance of ₹${totalFee.minus(currentReceived).toString()} remains. Record payments or waive balance.`,
          });
        }
      } else if (paymentStatus === PaymentStatus.PENDING) {
        if (currentReceived.greaterThan(0)) {
          return reply.status(400).send({
            success: false,
            error: 'Cannot reset placement to PENDING when installment payments have already been received.',
          });
        }
      } else if (paymentStatus === PaymentStatus.WAIVED) {
        const reason = waiverReason || notes;
        if (!reason || reason.trim().length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'A mandatory justification reason is required to waive a placement balance.',
          });
        }
      }

      const previousStatus = placement.paymentStatus;

      const updated = await prisma.$transaction(async (tx) => {
        const p = await tx.placement.update({
          where: { id },
          data: {
            paymentStatus: paymentStatus as any,
            invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : placement.invoiceNumber,
            notes: notes ? `${placement.notes ? placement.notes + '\n' : ''}${notes}` : placement.notes,
            paidAt: paymentStatus === PaymentStatus.PAID ? (placement.paidAt || new Date()) : placement.paidAt,
          },
          include: {
            client: true,
            application: { include: { candidate: true, job: true } },
            joiningConfirmation: true,
            payments: true,
          },
        });

        await tx.placementHistory.create({
          data: {
            placementId: id,
            eventType: 'STATUS_CHANGED',
            actorId: userId,
            actorRole: role,
            previousState: { paymentStatus: String(previousStatus) },
            newState: {
              paymentStatus: String(paymentStatus),
              invoiceNumber: invoiceNumber || null,
              waiverReason: waiverReason || null,
            },
            notes:
              (notes as string) ||
              (waiverReason
                ? `Placement balance waived: ${waiverReason}`
                : `Payment status updated from ${previousStatus} to ${paymentStatus}`),
          },
        });

        return p;
      });

      return reply.send({
        success: true,
        data: serializePlacementForRole(updated, role),
      });
    }
  );

  // 6. POST /api/placements/:id/payments — Record installment payment against placement
  server.post(
    '/:id/payments',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId, id: userId, role } = request.user;

      const parseResult = RecordPlacementPaymentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: parseResult.error.flatten() });
      }

      const input = parseResult.data;

      try {
        const [paymentRecord, updatedPlacement] = await prisma.$transaction(async (tx) => {
          const p = await tx.placement.findUnique({
            where: { id },
          });

          if (!p || p.organizationId !== organizationId) {
            throw new Error('PLACEMENT_NOT_FOUND');
          }

          const totalFee = new Prisma.Decimal(p.feeAmount);
          const paymentAmount = new Prisma.Decimal(input.amount);

          // Recompute current amount received strictly by summing ledger entries
          const aggregate = await tx.placementPayment.aggregate({
            where: { placementId: id },
            _sum: { amount: true },
          });
          const currentReceived = new Prisma.Decimal(aggregate._sum.amount || 0);
          const newReceived = currentReceived.add(paymentAmount);

          // Reject overpayment beyond total commercial fee
          if (newReceived.greaterThan(totalFee)) {
            const remainingBalance = totalFee.minus(currentReceived);
            throw new Error(`OVERPAYMENT: Payment amount ₹${input.amount} exceeds outstanding balance of ₹${remainingBalance.toString()}`);
          }

          const isFullyPaid = newReceived.greaterThanOrEqualTo(totalFee);
          const newPaymentStatus = isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

          const payment = await tx.placementPayment.create({
            data: {
              placementId: id,
              amount: paymentAmount,
              paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
              paymentMethod: input.paymentMethod,
              referenceNumber: input.referenceNumber,
              notes: input.notes || null,
              createdById: userId,
            },
          });

          const updatedP = await tx.placement.update({
            where: { id },
            data: {
              amountReceived: newReceived,
              paymentStatus: newPaymentStatus,
              paidAt: isFullyPaid ? (p.paidAt || new Date()) : p.paidAt,
            },
            include: {
              client: true,
              application: { include: { candidate: true, job: true } },
              joiningConfirmation: true,
              payments: true,
            },
          });

          await tx.placementHistory.create({
            data: {
              placementId: id,
              eventType: 'PAYMENT_RECORDED',
              actorId: userId,
              actorRole: role,
              previousState: {
                amountReceived: currentReceived.toString(),
                paymentStatus: p.paymentStatus,
              },
              newState: {
                paymentId: payment.id,
                amount: paymentAmount.toString(),
                totalReceived: newReceived.toString(),
                paymentStatus: newPaymentStatus,
              },
              notes: `Payment of ₹${input.amount.toLocaleString('en-IN')} recorded via ${input.paymentMethod} (Ref: ${input.referenceNumber}).`,
            },
          });

          return [payment, updatedP];
        });

        return reply.status(201).send({
          success: true,
          data: {
            payment: paymentRecord,
            placement: serializePlacementForRole(updatedPlacement, role),
          },
        });
      } catch (err: any) {
        if (err.message === 'PLACEMENT_NOT_FOUND') {
          return reply.status(404).send({ success: false, error: 'Placement record not found' });
        }
        if (err.message && err.message.startsWith('OVERPAYMENT:')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'OVERPAYMENT_NOT_PERMITTED',
              message: err.message.replace('OVERPAYMENT: ', ''),
            },
          });
        }
        throw err;
      }
    }
  );

  // 7. GET /api/placements/:id/history — Immutable placement event history
  server.get(
    '/:id/history',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId } = request.user;

      const placement = await prisma.placement.findUnique({
        where: { id },
        select: { id: true, organizationId: true },
      });

      if (!placement || placement.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Placement record not found' });
      }

      const history = await prisma.placementHistory.findMany({
        where: { placementId: id },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: history,
      });
    }
  );
};
