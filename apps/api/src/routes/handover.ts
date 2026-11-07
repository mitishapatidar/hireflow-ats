/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  HandoverStatus,
  HandoverEntityType,
  CreateHandoverRequestSchema,
  ReviewHandoverRequestSchema,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';

export const handoverRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 1. GET /api/handover/requests — List handover requests
  server.get(
    '/requests',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { organizationId, id: userId, role } = request.user;
      const { status, type } = request.query as { status?: string; type?: string };

      const where: any = { organizationId };

      if (status && Object.values(HandoverStatus).includes(status as any)) {
        where.status = status;
      }

      // Role and direction scoping
      if (role === UserRole.RECRUITER) {
        if (type === 'incoming') {
          where.toUserId = userId;
        } else if (type === 'outgoing') {
          where.fromUserId = userId;
        } else {
          where.OR = [{ fromUserId: userId }, { toUserId: userId }, { requestedById: userId }];
        }
      } else {
        // Manager/Admin can optionally filter by incoming/outgoing for themselves
        if (type === 'incoming') {
          where.toUserId = userId;
        } else if (type === 'outgoing') {
          where.fromUserId = userId;
        }
      }

      const requests = await prisma.handoverRequest.findMany({
        where,
        include: {
          fromUser: { select: { id: true, name: true, email: true, role: true } },
          toUser: { select: { id: true, name: true, email: true, role: true } },
          requestedBy: { select: { id: true, name: true, email: true, role: true } },
          reviewedBy: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: requests,
      });
    }
  );

  // 2. POST /api/handover/requests — Initiate handover request (Manager or Recruiter)
  server.post(
    '/requests',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { organizationId, id: userId, role } = request.user;

      const parseResult = CreateHandoverRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: parseResult.error.flatten() });
      }

      const { fromUserId, toUserId, candidateIds, jobIds, taskIds, reason, notes } = parseResult.data;

      // Recruiters can only initiate handover from themselves
      if (role === UserRole.RECRUITER && fromUserId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Recruiters can only request handover of their own portfolio',
        });
      }

      // Verify both users exist, belong to org, and target is active
      const [fromUser, toUser] = await Promise.all([
        prisma.user.findFirst({ where: { id: fromUserId, organizationId } }),
        prisma.user.findFirst({ where: { id: toUserId, organizationId, status: 'ACTIVE' } }),
      ]);

      if (!fromUser) {
        return reply.status(404).send({ success: false, error: 'Source recruiter not found in organization' });
      }
      if (!toUser) {
        return reply.status(400).send({
          success: false,
          error: 'Destination recruiter is inactive or not found in organization',
        });
      }

      // Client Access Validation: verify destination recruiter is not blocked from clients of transferred jobs
      if (jobIds.length > 0) {
        const jobs = await prisma.job.findMany({
          where: { id: { in: jobIds }, organizationId },
          select: { id: true, clientId: true },
        });

        const clientIds = [...new Set(jobs.map((j) => j.clientId))];
        const clientAccessRestrictions = await prisma.clientAccess.findMany({
          where: {
            clientId: { in: clientIds },
            userId: toUserId,
          },
        });

        // If clientAccess rules exist for this client and toUser, check if any job is excluded
        for (const access of clientAccessRestrictions) {
          if (Array.isArray(access.authorizedJobIds) && (access.authorizedJobIds as string[]).length > 0) {
            const forbiddenJobs = jobs.filter(
              (j) => j.clientId === access.clientId && !(access.authorizedJobIds as string[]).includes(j.id)
            );
            if (forbiddenJobs.length > 0) {
              return reply.status(400).send({
                success: false,
                error: `Target recruiter lacks authorization for ${forbiddenJobs.length} of the selected jobs under client`,
              });
            }
          }
        }
      }

      const handover = await prisma.handoverRequest.create({
        data: {
          organizationId,
          fromUserId,
          toUserId,
          requestedById: userId,
          candidateIds: candidateIds || [],
          jobIds: jobIds || [],
          taskIds: taskIds || [],
          reason,
          notes,
          status: HandoverStatus.PENDING,
        },
        include: {
          fromUser: { select: { id: true, name: true, email: true } },
          toUser: { select: { id: true, name: true, email: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Send in-app notification to destination recruiter
      try {
        await prisma.notification.create({
          data: {
            userId: toUserId,
            title: 'New Handover Request Assigned',
            message: `${request.user.name || 'A team member'} has requested to transfer ${candidateIds.length} candidate(s), ${jobIds.length} job(s), and ${taskIds.length} task(s) to you. Reason: ${reason}`,
            type: 'IN_APP',
            category: 'SYSTEM',
            linkUrl: '/handover',
          },
        });
      } catch (err) {
        server.log.error(err, 'Failed to create handover notification');
      }

      return reply.status(201).send({
        success: true,
        data: handover,
      });
    }
  );

  // 3. GET /api/handover/requests/:id — Handover request details with hydrated entity records
  server.get(
    '/requests/:id',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId, id: userId, role } = request.user;

      const handover = await prisma.handoverRequest.findUnique({
        where: { id },
        include: {
          fromUser: { select: { id: true, name: true, email: true, role: true } },
          toUser: { select: { id: true, name: true, email: true, role: true } },
          requestedBy: { select: { id: true, name: true, email: true, role: true } },
          reviewedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      if (!handover || handover.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Handover request not found' });
      }

      if (
        role === UserRole.RECRUITER &&
        handover.fromUserId !== userId &&
        handover.toUserId !== userId &&
        handover.requestedById !== userId
      ) {
        return reply.status(403).send({ success: false, error: 'Unauthorized to view this handover request' });
      }

      const candidateIds = Array.isArray(handover.candidateIds) ? (handover.candidateIds as string[]) : [];
      const jobIds = Array.isArray(handover.jobIds) ? (handover.jobIds as string[]) : [];
      const taskIds = Array.isArray(handover.taskIds) ? (handover.taskIds as string[]) : [];

      const [candidates, jobs, tasks] = await Promise.all([
        candidateIds.length > 0
          ? prisma.candidate.findMany({
              where: { id: { in: candidateIds } },
              select: { id: true, name: true, email: true, phone: true, currentTitle: true },
            })
          : [],
        jobIds.length > 0
          ? prisma.job.findMany({
              where: { id: { in: jobIds } },
              select: { id: true, title: true, code: true, status: true, client: { select: { legalName: true } } },
            })
          : [],
        taskIds.length > 0
          ? prisma.task.findMany({
              where: { id: { in: taskIds } },
              select: { id: true, title: true, status: true, priority: true, dueDate: true },
            })
          : [],
      ]);

      return reply.send({
        success: true,
        data: {
          ...handover,
          entities: {
            candidates,
            jobs,
            tasks,
          },
        },
      });
    }
  );

  // 4. POST /api/handover/requests/:id/approve — Atomic transfer of candidates, jobs & open tasks
  server.post(
    '/requests/:id/approve',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId, id: userId } = request.user;

      const handover = await prisma.handoverRequest.findUnique({
        where: { id },
      });

      if (!handover || handover.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Handover request not found' });
      }

      if (handover.status !== HandoverStatus.PENDING) {
        return reply.status(400).send({
          success: false,
          error: `Cannot approve request with status ${handover.status}`,
        });
      }

      const candidateIds = Array.isArray(handover.candidateIds) ? (handover.candidateIds as string[]) : [];
      const jobIds = Array.isArray(handover.jobIds) ? (handover.jobIds as string[]) : [];
      const taskIds = Array.isArray(handover.taskIds) ? (handover.taskIds as string[]) : [];

      try {
        // Atomic transaction with optimistic concurrency lock
        const updated = await prisma.$transaction(async (tx) => {
          // 0. Concurrency Guard: conditionally transition from PENDING to APPROVED
          const lockResult = await tx.handoverRequest.updateMany({
            where: {
              id,
              organizationId,
              status: HandoverStatus.PENDING,
            },
            data: {
              status: HandoverStatus.APPROVED,
              reviewedById: userId,
              reviewedAt: new Date(),
            },
          });

          if (lockResult.count === 0) {
            throw new Error('HANDOVER_ALREADY_REVIEWED_OR_INACTIVE');
          }

          // Verify destination recruiter is active inside transaction
          const targetUser = await tx.user.findFirst({
            where: { id: handover.toUserId, organizationId, status: 'ACTIVE' },
          });
          if (!targetUser) {
            throw new Error('TARGET_RECRUITER_INACTIVE');
          }

          // 1. Verify and Transfer Candidates
          if (candidateIds.length > 0) {
            const verifiedCandidates = await tx.candidate.findMany({
              where: {
                id: { in: candidateIds },
                organizationId,
                ownerId: handover.fromUserId,
                isArchived: false,
              },
              select: { id: true, name: true },
            });

            if (verifiedCandidates.length !== candidateIds.length) {
              throw new Error(
                'CANDIDATE_OWNERSHIP_MISMATCH: One or more candidates are not owned by source recruiter or do not exist'
              );
            }

            const verifiedCandIds = verifiedCandidates.map((c) => c.id);
            await tx.candidate.updateMany({
              where: { id: { in: verifiedCandIds } },
              data: { ownerId: handover.toUserId },
            });

            // Record OwnershipHistory strictly for verified transferred candidates
            for (const cand of verifiedCandidates) {
              await tx.ownershipHistory.create({
                data: {
                  organizationId,
                  entityType: HandoverEntityType.CANDIDATE,
                  entityId: cand.id,
                  fromUserId: handover.fromUserId,
                  toUserId: handover.toUserId,
                  handoverRequestId: handover.id,
                  transferredById: userId,
                  reason: handover.reason,
                },
              });
            }
          }

          // 2. Verify and Transfer Jobs & Assignments
          if (jobIds.length > 0) {
            const verifiedJobs = await tx.job.findMany({
              where: {
                id: { in: jobIds },
                organizationId,
                OR: [
                  { ownerId: handover.fromUserId },
                  { assignments: { some: { recruiterId: handover.fromUserId, status: 'ACTIVE' } } },
                ],
              },
              select: { id: true, title: true, clientId: true, ownerId: true },
            });

            if (verifiedJobs.length !== jobIds.length) {
              throw new Error(
                'JOB_OWNERSHIP_MISMATCH: One or more jobs are not assigned to source recruiter or do not exist'
              );
            }

            // Verify target recruiter has client access for every selected job
            const clientIds = [...new Set(verifiedJobs.map((j) => j.clientId))];
            const targetClientAccesses = await tx.clientAccess.findMany({
              where: {
                clientId: { in: clientIds },
                userId: handover.toUserId,
              },
            });

            for (const access of targetClientAccesses) {
              if (Array.isArray(access.authorizedJobIds) && (access.authorizedJobIds as string[]).length > 0) {
                const forbiddenJobs = verifiedJobs.filter(
                  (j) => j.clientId === access.clientId && !(access.authorizedJobIds as string[]).includes(j.id)
                );
                if (forbiddenJobs.length > 0) {
                  throw new Error(
                    `TARGET_LACKS_CLIENT_ACCESS: Target recruiter lacks access to ${forbiddenJobs.length} selected job(s)`
                  );
                }
              }
            }

            const verifiedJobIds = verifiedJobs.map((j) => j.id);
            await tx.job.updateMany({
              where: { id: { in: verifiedJobIds }, ownerId: handover.fromUserId },
              data: { ownerId: handover.toUserId },
            });

            for (const job of verifiedJobs) {
              await tx.jobAssignment.updateMany({
                where: { jobId: job.id, recruiterId: handover.fromUserId, status: 'ACTIVE' },
                data: { status: 'REASSIGNED' },
              });

              const existing = await tx.jobAssignment.findFirst({
                where: { jobId: job.id, recruiterId: handover.toUserId },
              });
              if (existing) {
                await tx.jobAssignment.update({
                  where: { id: existing.id },
                  data: { status: 'ACTIVE', assignedById: userId },
                });
              } else {
                await tx.jobAssignment.create({
                  data: {
                    jobId: job.id,
                    recruiterId: handover.toUserId,
                    assignedById: userId,
                    status: 'ACTIVE',
                  },
                });
              }

              // Record OwnershipHistory strictly for verified transferred jobs
              await tx.ownershipHistory.create({
                data: {
                  organizationId,
                  entityType: HandoverEntityType.JOB,
                  entityId: job.id,
                  fromUserId: handover.fromUserId,
                  toUserId: handover.toUserId,
                  handoverRequestId: handover.id,
                  transferredById: userId,
                  reason: handover.reason,
                },
              });
            }
          }

          // 3. Verify and Transfer Open Tasks (Completed tasks are strictly excluded)
          if (taskIds.length > 0) {
            const eligibleTasks = await tx.task.findMany({
              where: {
                id: { in: taskIds },
                assignedToId: handover.fromUserId,
                status: { not: 'COMPLETED' },
              },
              select: { id: true, title: true },
            });

            if (eligibleTasks.length > 0) {
              const eligibleTaskIds = eligibleTasks.map((t) => t.id);
              await tx.task.updateMany({
                where: { id: { in: eligibleTaskIds } },
                data: { assignedToId: handover.toUserId },
              });

              // Record OwnershipHistory strictly for verified transferred tasks (excluding completed tasks)
              for (const task of eligibleTasks) {
                await tx.ownershipHistory.create({
                  data: {
                    organizationId,
                    entityType: HandoverEntityType.TASK,
                    entityId: task.id,
                    fromUserId: handover.fromUserId,
                    toUserId: handover.toUserId,
                    handoverRequestId: handover.id,
                    transferredById: userId,
                    reason: handover.reason,
                  },
                });
              }
            }
          }

          return tx.handoverRequest.findUniqueOrThrow({
            where: { id },
            include: {
              fromUser: { select: { id: true, name: true, email: true } },
              toUser: { select: { id: true, name: true, email: true } },
              reviewedBy: { select: { id: true, name: true, email: true } },
            },
          });
        });

        // Post-transaction notifications
        try {
          await Promise.all([
            prisma.notification.create({
              data: {
                userId: handover.toUserId,
                title: 'Handover Approved & Portfolio Transferred',
                message: `You are now the active owner of ${candidateIds.length} candidate(s), ${jobIds.length} job(s), and open tasks from handover #${handover.id.slice(0, 8)}.`,
                type: 'IN_APP',
                category: 'SYSTEM',
                linkUrl: '/handover',
              },
            }),
            prisma.notification.create({
              data: {
                userId: handover.fromUserId,
                title: 'Handover Successfully Completed',
                message: `Your handover of ${candidateIds.length} candidate(s) and ${jobIds.length} job(s) to ${updated.toUser.name} has been approved by manager.`,
                type: 'IN_APP',
                category: 'SYSTEM',
                linkUrl: '/handover',
              },
            }),
          ]);
        } catch (err) {
          server.log.error(err, 'Failed to create handover completion notifications');
        }

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (err: any) {
        if (err.message === 'HANDOVER_ALREADY_REVIEWED_OR_INACTIVE') {
          return reply.status(400).send({
            success: false,
            error: 'Handover request is no longer pending or has already been reviewed',
          });
        }
        if (
          err.message &&
          (err.message.startsWith('CANDIDATE_OWNERSHIP_MISMATCH') ||
            err.message.startsWith('JOB_OWNERSHIP_MISMATCH') ||
            err.message.startsWith('TARGET_LACKS_CLIENT_ACCESS') ||
            err.message.startsWith('TARGET_RECRUITER_INACTIVE'))
        ) {
          return reply.status(400).send({
            success: false,
            error: err.message,
          });
        }
        throw err;
      }
    }
  );

  // 5. POST /api/handover/requests/:id/reject — Reject handover request
  server.post(
    '/requests/:id/reject',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId, id: userId } = request.user;
      const { rejectionReason } = (request.body as any) || {};

      const handover = await prisma.handoverRequest.findUnique({
        where: { id },
      });

      if (!handover || handover.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Handover request not found' });
      }

      if (handover.status !== HandoverStatus.PENDING) {
        return reply.status(400).send({
          success: false,
          error: `Cannot reject request with status ${handover.status}`,
        });
      }

      const rejected = await prisma.handoverRequest.update({
        where: { id },
        data: {
          status: HandoverStatus.REJECTED,
          rejectionReason: rejectionReason || 'Rejected by management',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });

      try {
        await prisma.notification.create({
          data: {
            userId: handover.requestedById,
            title: 'Handover Request Rejected',
            message: `Handover request was rejected: ${rejectionReason || 'No reason provided.'}`,
            type: 'IN_APP',
            category: 'SYSTEM',
            linkUrl: '/handover',
          },
        });
      } catch (err) {
        server.log.error(err, 'Failed to notify requester of rejection');
      }

      return reply.send({
        success: true,
        data: rejected,
      });
    }
  );

  // 6. POST /api/handover/requests/:id/cancel — Cancel pending handover request
  server.post(
    '/requests/:id/cancel',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { organizationId, id: userId, role } = request.user;

      const handover = await prisma.handoverRequest.findUnique({
        where: { id },
      });

      if (!handover || handover.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: 'Handover request not found' });
      }

      if (role === UserRole.RECRUITER && handover.requestedById !== userId) {
        return reply.status(403).send({ success: false, error: 'Only the requester can cancel this request' });
      }

      if (handover.status !== HandoverStatus.PENDING) {
        return reply.status(400).send({
          success: false,
          error: `Cannot cancel request with status ${handover.status}`,
        });
      }

      const cancelled = await prisma.handoverRequest.update({
        where: { id },
        data: { status: HandoverStatus.CANCELLED },
      });

      return reply.send({
        success: true,
        data: cancelled,
      });
    }
  );

  // 7. GET /api/handover/recruiter-resources/:recruiterId — Fetches candidates, jobs & tasks for Frame 41 wizard
  server.get(
    '/recruiter-resources/:recruiterId',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { recruiterId } = request.params as { recruiterId: string };
      const { organizationId, id: userId, role } = request.user;

      if (role === UserRole.RECRUITER && recruiterId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Recruiters can only inspect their own resources for handover',
        });
      }

      const [candidates, jobs, tasks] = await Promise.all([
        prisma.candidate.findMany({
          where: { ownerId: recruiterId, organizationId, isArchived: false },
          select: {
            id: true,
            name: true,
            email: true,
            currentTitle: true,
            currentCompany: true,
          },
          orderBy: { name: 'asc' },
        }),
        prisma.job.findMany({
          where: {
            organizationId,
            status: 'ACTIVE',
            OR: [
              { ownerId: recruiterId },
              { assignments: { some: { recruiterId, status: 'ACTIVE' } } },
            ],
          },
          select: {
            id: true,
            title: true,
            code: true,
            status: true,
            client: { select: { id: true, legalName: true } },
          },
          orderBy: { title: 'asc' },
        }),
        prisma.task.findMany({
          where: {
            assignedToId: recruiterId,
            status: { not: 'COMPLETED' },
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            relatedEntity: true,
            relatedEntityId: true,
          },
          orderBy: { dueDate: 'asc' },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          candidates,
          jobs,
          tasks,
        },
      });
    }
  );

  // 8. GET /api/handover/ownership-history — Audit log of ownership transitions
  server.get(
    '/ownership-history',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
      ],
    },
    async (request: any, reply) => {
      const { organizationId } = request.user;
      const {
        entityType,
        entityId,
        recruiterId,
        page = '1',
        limit = '20',
      } = request.query as {
        entityType?: string;
        entityId?: string;
        recruiterId?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const where: any = { organizationId };

      if (entityType && Object.values(HandoverEntityType).includes(entityType as any)) {
        where.entityType = entityType;
      }
      if (entityId) {
        where.entityId = entityId;
      }
      if (recruiterId) {
        where.OR = [{ fromUserId: recruiterId }, { toUserId: recruiterId }];
      }

      const [total, histories] = await Promise.all([
        prisma.ownershipHistory.count({ where }),
        prisma.ownershipHistory.findMany({
          where,
          include: {
            fromUser: { select: { id: true, name: true, email: true } },
            toUser: { select: { id: true, name: true, email: true } },
            transferredBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { transferredAt: 'desc' },
          skip,
          take: limitNum,
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: histories,
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
};
