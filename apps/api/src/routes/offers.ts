/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  OfferStatus,
  PaymentStatus,
  CreateOfferSchema,
  DeclineOfferSchema,
  ConfirmJoiningSchema,
  isValidOfferTransition,
  serializeOfferForRole,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';
import { MetricsService } from '../services/metrics.js';

export const offerRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper for audit logs
  async function logOfferAudit(
    actorId: string,
    action: string,
    offerId: string,
    before?: any,
    after?: any
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'Offer',
          entityId: offerId,
          before: before || undefined,
          after: after || undefined,
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to write offer audit log');
    }
  }

  // 1. GET /api/offers/stats - Offers & Placements KPI Cards (Frame 08)
  server.get(
    '/stats',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request: any, reply) => {
      const { id: userId, role, organizationId } = request.user;
      const stats = await MetricsService.getOffersDashboardData(userId, role, organizationId);
      return reply.send({ success: true, data: stats });
    }
  );

  // 2. GET /api/offers - List Offers (role-scoped & anti-leak)
  server.get(
    '/',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT),
      ],
    },
    async (request: any, reply) => {
      const { id: userId, role, organizationId, clientAccess } = request.user;
      const { status, clientId, page = 1, limit = 20 } = request.query as any;

      const take = Math.min(50, Math.max(1, Number(limit) || 20));
      const skip = (Math.max(1, Number(page) || 1) - 1) * take;

      const where: any = {
        organizationId,
      };

      if (status && Object.values(OfferStatus).includes(status)) {
        where.status = status;
      }

      // Role Scoping
      if (role === UserRole.CLIENT) {
        if (!clientAccess?.clientId) {
          return reply.status(403).send({ success: false, error: 'No client access linked' });
        }
        where.clientId = clientAccess.clientId;
      } else if (role === UserRole.RECRUITER) {
        where.application = {
          job: { ownerId: userId },
        };
      }

      if (clientId && role !== UserRole.CLIENT) {
        where.clientId = clientId;
      }

      const [total, records] = await Promise.all([
        prisma.offer.count({ where }),
        prisma.offer.findMany({
          where,
          take,
          skip,
          orderBy: { createdAt: 'desc' },
          include: {
            application: {
              include: {
                candidate: { select: { id: true, name: true, email: true } },
                job: { select: { id: true, title: true, code: true } },
              },
            },
            client: { select: { id: true, legalName: true } },
            placement: { select: { id: true, feeAmount: true, paymentStatus: true } },
          },
        }),
      ]);

      const serialized = records.map((r) => serializeOfferForRole(r, role));

      return reply.send({
        success: true,
        data: serialized,
        pagination: {
          total,
          page: Number(page),
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    }
  );

  // 3. GET /api/offers/:id - Single Offer Dossier
  server.get(
    '/:id',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT),
      ],
    },
    async (request: any, reply) => {
      const { id: userId, role, organizationId, clientAccess } = request.user;
      const { id } = request.params as { id: string };

      const offer = await prisma.offer.findUnique({
        where: { id },
        include: {
          application: {
            include: {
              candidate: { select: { id: true, name: true, email: true, phone: true } },
              job: { select: { id: true, title: true, code: true, ownerId: true } },
            },
          },
          client: { select: { id: true, legalName: true } },
          placement: true,
        },
      });

      if (!offer || offer.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Offer not found' });
      }

      // Role check
      if (role === UserRole.CLIENT && offer.clientId !== clientAccess?.clientId) {
        return reply.status(403).send({ success: false, error: 'Unauthorized to view this offer' });
      }
      if (role === UserRole.RECRUITER && offer.application.job.ownerId !== userId) {
        return reply.status(403).send({ success: false, error: 'Unauthorized to view this offer' });
      }

      return reply.send({ success: true, data: serializeOfferForRole(offer, role) });
    }
  );

  // 4. POST /api/offers - Create Draft Offer
  server.post(
    '/',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request: any, reply) => {
      const { id: userId, organizationId } = request.user;
      const parseResult = CreateOfferSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: parseResult.error.flatten() });
      }

      const input = parseResult.data;

      // Ensure application belongs to client and org
      const application = await prisma.application.findUnique({
        where: { id: input.applicationId },
        include: { job: true },
      });

      if (!application || application.job.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Application not found' });
      }

      const offer = await prisma.offer.create({
        data: {
          applicationId: input.applicationId,
          clientId: input.clientId,
          organizationId,
          offeredSalary: input.offeredSalary,
          joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
          releaseDate: input.releaseDate ? new Date(input.releaseDate) : new Date(),
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          notes: input.notes,
          offerDocumentUrl: input.offerDocumentUrl,
          status: OfferStatus.DRAFT,
          createdById: userId,
        },
      });

      await logOfferAudit(userId, 'OFFER_CREATED', offer.id, null, offer);

      return reply.status(201).send({ success: true, data: offer });
    }
  );

  // 5. POST /api/offers/:id/release
  server.post(
    '/:id/release',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request: any, reply) => {
      const { id: userId, organizationId } = request.user;
      const { id } = request.params as { id: string };

      const offer = await prisma.offer.findUnique({ where: { id } });
      if (!offer || offer.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Offer not found' });
      }

      if (!isValidOfferTransition(offer.status as OfferStatus, OfferStatus.RELEASED)) {
        return reply.status(400).send({
          success: false,
          error: `Cannot transition offer from ${offer.status} to RELEASED`,
        });
      }

      const updated = await prisma.offer.update({
        where: { id },
        data: {
          status: OfferStatus.RELEASED,
          releaseDate: new Date(),
        },
      });

      await logOfferAudit(userId, 'OFFER_RELEASED', id, offer, updated);

      return reply.send({ success: true, data: updated });
    }
  );

  // 6. POST /api/offers/:id/accept
  server.post(
    '/:id/accept',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request: any, reply) => {
      const { id: userId, organizationId } = request.user;
      const { id } = request.params as { id: string };

      const offer = await prisma.offer.findUnique({ where: { id } });
      if (!offer || offer.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Offer not found' });
      }

      if (!isValidOfferTransition(offer.status as OfferStatus, OfferStatus.ACCEPTED)) {
        return reply.status(400).send({
          success: false,
          error: `Cannot transition offer from ${offer.status} to ACCEPTED`,
        });
      }

      const updated = await prisma.offer.update({
        where: { id },
        data: {
          status: OfferStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      await logOfferAudit(userId, 'OFFER_ACCEPTED', id, offer, updated);

      return reply.send({ success: true, data: updated });
    }
  );

  // 7. POST /api/offers/:id/decline
  server.post(
    '/:id/decline',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request: any, reply) => {
      const { id: userId, organizationId } = request.user;
      const { id } = request.params as { id: string };

      const parseResult = DeclineOfferSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: parseResult.error.flatten() });
      }

      const offer = await prisma.offer.findUnique({ where: { id } });
      if (!offer || offer.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Offer not found' });
      }

      if (!isValidOfferTransition(offer.status as OfferStatus, OfferStatus.DECLINED)) {
        return reply.status(400).send({
          success: false,
          error: `Cannot transition offer from ${offer.status} to DECLINED`,
        });
      }

      const updated = await prisma.offer.update({
        where: { id },
        data: {
          status: OfferStatus.DECLINED,
          declinedAt: new Date(),
          declineReason: parseResult.data.declineReason,
        },
      });

      await logOfferAudit(userId, 'OFFER_DECLINED', id, offer, updated);

      return reply.send({ success: true, data: updated });
    }
  );

  // 8. POST /api/offers/:id/confirm-joining (Transactional Placement Generation)
  server.post(
    '/:id/confirm-joining',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER)],
    },
    async (request: any, reply) => {
      const { id: userId, organizationId } = request.user;
      const { id } = request.params as { id: string };

      const parseResult = ConfirmJoiningSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: parseResult.error.flatten() });
      }

      const input = parseResult.data;

      const offer = await prisma.offer.findUnique({
        where: { id },
        include: { placement: true },
      });

      if (!offer || offer.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Offer not found' });
      }

      if (!isValidOfferTransition(offer.status as OfferStatus, OfferStatus.JOINED)) {
        return reply.status(400).send({
          success: false,
          error: `Cannot confirm joining for offer in ${offer.status} status. Offer must be ACCEPTED first.`,
        });
      }

      // Duplicate placement prevention
      const existingPlacement = await prisma.placement.findUnique({
        where: { applicationId: offer.applicationId },
      });

      if (existingPlacement) {
        return reply.status(409).send({
          success: false,
          error: 'A confirmed placement already exists for this candidate application',
        });
      }

      const joinedDate = input.joinedAt ? new Date(input.joinedAt) : new Date();

      // Transactional Placement Creation
      const [updatedOffer, placement] = await prisma.$transaction(async (tx) => {
        const newPlacement = await tx.placement.create({
          data: {
            applicationId: offer.applicationId,
            clientId: offer.clientId,
            organizationId,
            feeBasis: input.feeBasis,
            feeAmount: input.feeAmount,
            paymentTerms: input.paymentTerms,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            paymentStatus: PaymentStatus.PENDING,
            joiningDate: joinedDate,
            createdById: userId,
          },
        });

        const off = await tx.offer.update({
          where: { id },
          data: {
            status: OfferStatus.JOINED,
            joinedAt: joinedDate,
            placementId: newPlacement.id,
          },
        });

        // Update application status to PLACED
        await tx.application.update({
          where: { id: offer.applicationId },
          data: { status: 'PLACED' as any },
        });

        return [off, newPlacement];
      });

      await logOfferAudit(userId, 'OFFER_CONFIRMED_JOINED', id, offer, {
        offer: updatedOffer,
        placement,
      });

      return reply.status(201).send({
        success: true,
        data: {
          offer: updatedOffer,
          placement,
        },
      });
    }
  );
};
