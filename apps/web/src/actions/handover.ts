'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  UserRole,
  HandoverStatus,
  HandoverEntityType,
  CreateHandoverRequestSchema,
  CreateHandoverRequestInput,
} from '@hireflow/shared';

/**
 * 1. GET ACTIVE RECRUITERS
 * Lists active internal recruiters for source / destination selector
 */
export async function getActiveRecruitersAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const recruiters = await prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      status: 'ACTIVE',
      role: { in: [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  });

  return recruiters;
}

/**
 * 2. GET RECRUITER RESOURCES ACTION
 * Returns candidates, jobs, and open tasks owned by a recruiter for Frame 41 wizard
 */
export async function getRecruiterResourcesAction(recruiterId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role === UserRole.RECRUITER && recruiterId !== user.id) {
    throw new Error('Forbidden: Recruiters can only inspect their own resources');
  }

  const [candidates, jobs, tasks] = await Promise.all([
    prisma.candidate.findMany({
      where: { ownerId: recruiterId, organizationId: user.organizationId, isArchived: false },
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
        organizationId: user.organizationId,
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
      },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  return { candidates, jobs, tasks };
}

/**
 * 3. GET HANDOVER REQUESTS ACTION
 * Lists handover requests with filters
 */
export async function getHandoverRequestsAction(params?: {
  status?: string;
  type?: 'incoming' | 'outgoing' | 'all';
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const where: Prisma.HandoverRequestWhereInput = { organizationId: user.organizationId };

  if (params?.status && Object.values(HandoverStatus).includes(params.status as any)) {
    where.status = params.status;
  }

  if (user.role === UserRole.RECRUITER) {
    if (params?.type === 'incoming') {
      where.toUserId = user.id;
    } else if (params?.type === 'outgoing') {
      where.fromUserId = user.id;
    } else {
      where.OR = [{ fromUserId: user.id }, { toUserId: user.id }, { requestedById: user.id }];
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

  return requests.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    fromUserName: r.fromUser?.name,
    fromUserEmail: r.fromUser?.email,
    toUserId: r.toUserId,
    toUserName: r.toUser?.name,
    toUserEmail: r.toUser?.email,
    requestedById: r.requestedById,
    requestedByName: r.requestedBy?.name,
    candidateIds: Array.isArray(r.candidateIds) ? (r.candidateIds as string[]) : [],
    jobIds: Array.isArray(r.jobIds) ? (r.jobIds as string[]) : [],
    taskIds: Array.isArray(r.taskIds) ? (r.taskIds as string[]) : [],
    status: r.status,
    reason: r.reason,
    notes: r.notes,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    reviewedByName: r.reviewedBy?.name,
  }));
}

/**
 * 4. GET HANDOVER REQUEST DETAILS ACTION
 */
export async function getHandoverRequestDetailsAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const handover = await prisma.handoverRequest.findUnique({
    where: { id },
    include: {
      fromUser: { select: { id: true, name: true, email: true, role: true } },
      toUser: { select: { id: true, name: true, email: true, role: true } },
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  if (!handover || handover.organizationId !== user.organizationId) {
    throw new Error('Handover request not found');
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

  return {
    ...handover,
    entities: { candidates, jobs, tasks },
  };
}

/**
 * 5. CREATE HANDOVER REQUEST ACTION
 */
export async function createHandoverRequestAction(input: CreateHandoverRequestInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const parsed = CreateHandoverRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
  }

  const { fromUserId, toUserId, candidateIds, jobIds, taskIds, reason, notes } = parsed.data;

  if (user.role === UserRole.RECRUITER && fromUserId !== user.id) {
    throw new Error('Forbidden: Recruiters can only request handover of their own portfolio');
  }

  const toUser = await prisma.user.findFirst({
    where: { id: toUserId, organizationId: user.organizationId, status: 'ACTIVE' },
  });
  if (!toUser) {
    throw new Error('Destination recruiter is not active or not in organization');
  }

  // Pre-transfer permission check for client jobs
  if (jobIds.length > 0) {
    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIds }, organizationId: user.organizationId },
      select: { id: true, clientId: true },
    });

    const clientIds = [...new Set(jobs.map((j) => j.clientId))];
    const clientAccessRestrictions = await prisma.clientAccess.findMany({
      where: { clientId: { in: clientIds }, userId: toUserId },
    });

    for (const access of clientAccessRestrictions) {
      if (Array.isArray(access.authorizedJobIds) && (access.authorizedJobIds as string[]).length > 0) {
        const forbiddenJobs = jobs.filter(
          (j) => j.clientId === access.clientId && !(access.authorizedJobIds as string[]).includes(j.id)
        );
        if (forbiddenJobs.length > 0) {
          throw new Error(`Target recruiter lacks authorization for ${forbiddenJobs.length} of the selected jobs`);
        }
      }
    }
  }

  const request = await prisma.handoverRequest.create({
    data: {
      organizationId: user.organizationId,
      fromUserId,
      toUserId,
      requestedById: user.id,
      candidateIds,
      jobIds,
      taskIds,
      reason,
      notes: notes || null,
      status: HandoverStatus.PENDING,
    },
  });

  try {
    await prisma.notification.create({
      data: {
        userId: toUserId,
        title: 'New Handover Request Assigned',
        message: `${user.name || 'A team member'} has requested to transfer work to you. Reason: ${reason}`,
        type: 'IN_APP',
        category: 'SYSTEM',
        linkUrl: '/handover',
      },
    });
  } catch (err) {
    console.error('Failed to notify destination recruiter:', err);
  }

  revalidatePath('/handover');
  return { success: true, id: request.id };
}

/**
 * 6. APPROVE HANDOVER REQUEST ACTION
 * Atomic transfer of candidates, jobs & tasks in single transaction
 */
export async function approveHandoverRequestAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new Error('Forbidden: Only managers and admins can approve handovers');
  }

  const handover = await prisma.handoverRequest.findUnique({ where: { id } });
  if (!handover || handover.organizationId !== user.organizationId) {
    throw new Error('Handover request not found');
  }

  if (handover.status !== HandoverStatus.PENDING) {
    throw new Error(`Cannot approve request in status ${handover.status}`);
  }

  const candidateIds = Array.isArray(handover.candidateIds) ? (handover.candidateIds as string[]) : [];
  const jobIds = Array.isArray(handover.jobIds) ? (handover.jobIds as string[]) : [];
  const taskIds = Array.isArray(handover.taskIds) ? (handover.taskIds as string[]) : [];

  await prisma.$transaction(async (tx) => {
    // 1. Transfer Candidates
    if (candidateIds.length > 0) {
      await tx.candidate.updateMany({
        where: { id: { in: candidateIds }, organizationId: user.organizationId },
        data: { ownerId: handover.toUserId },
      });

      for (const candId of candidateIds) {
        await tx.ownershipHistory.create({
          data: {
            organizationId: user.organizationId,
            entityType: HandoverEntityType.CANDIDATE,
            entityId: candId,
            fromUserId: handover.fromUserId,
            toUserId: handover.toUserId,
            handoverRequestId: handover.id,
            transferredById: user.id,
            reason: handover.reason,
          },
        });
      }
    }

    // 2. Transfer Jobs & Assignments
    if (jobIds.length > 0) {
      await tx.job.updateMany({
        where: { id: { in: jobIds }, organizationId: user.organizationId },
        data: { ownerId: handover.toUserId },
      });

      for (const jobId of jobIds) {
        await tx.jobAssignment.updateMany({
          where: { jobId, recruiterId: handover.fromUserId, status: 'ACTIVE' },
          data: { status: 'REASSIGNED' },
        });

        const existing = await tx.jobAssignment.findFirst({
          where: { jobId, recruiterId: handover.toUserId },
        });

        if (existing) {
          await tx.jobAssignment.update({
            where: { id: existing.id },
            data: { status: 'ACTIVE', assignedById: user.id },
          });
        } else {
          await tx.jobAssignment.create({
            data: {
              jobId,
              recruiterId: handover.toUserId,
              assignedById: user.id,
              status: 'ACTIVE',
            },
          });
        }

        await tx.ownershipHistory.create({
          data: {
            organizationId: user.organizationId,
            entityType: HandoverEntityType.JOB,
            entityId: jobId,
            fromUserId: handover.fromUserId,
            toUserId: handover.toUserId,
            handoverRequestId: handover.id,
            transferredById: user.id,
            reason: handover.reason,
          },
        });
      }
    }

    // 3. Transfer Open Tasks (Completed tasks never transfer)
    if (taskIds.length > 0) {
      await tx.task.updateMany({
        where: {
          id: { in: taskIds },
          status: { not: 'COMPLETED' },
        },
        data: { assignedToId: handover.toUserId },
      });

      for (const taskId of taskIds) {
        await tx.ownershipHistory.create({
          data: {
            organizationId: user.organizationId,
            entityType: HandoverEntityType.TASK,
            entityId: taskId,
            fromUserId: handover.fromUserId,
            toUserId: handover.toUserId,
            handoverRequestId: handover.id,
            transferredById: user.id,
            reason: handover.reason,
          },
        });
      }
    }

    // 4. Mark Request Approved
    await tx.handoverRequest.update({
      where: { id },
      data: {
        status: HandoverStatus.APPROVED,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  });

  try {
    await Promise.all([
      prisma.notification.create({
        data: {
          userId: handover.toUserId,
          title: 'Handover Approved & Portfolio Transferred',
          message: `You are now the active owner of ${candidateIds.length} candidate(s) and ${jobIds.length} job(s).`,
          type: 'IN_APP',
          category: 'SYSTEM',
          linkUrl: '/handover',
        },
      }),
      prisma.notification.create({
        data: {
          userId: handover.fromUserId,
          title: 'Handover Approved',
          message: `Your handover request has been approved by manager.`,
          type: 'IN_APP',
          category: 'SYSTEM',
          linkUrl: '/handover',
        },
      }),
    ]);
  } catch (err) {
    console.error('Failed to dispatch notifications:', err);
  }

  revalidatePath('/handover');
  revalidatePath('/candidates');
  revalidatePath('/jobs');
  return { success: true };
}

/**
 * 7. REJECT HANDOVER REQUEST ACTION
 */
export async function rejectHandoverRequestAction(id: string, rejectionReason?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new Error('Forbidden: Only managers and admins can reject handovers');
  }

  const handover = await prisma.handoverRequest.findUnique({ where: { id } });
  if (!handover || handover.organizationId !== user.organizationId) {
    throw new Error('Handover request not found');
  }

  await prisma.handoverRequest.update({
    where: { id },
    data: {
      status: HandoverStatus.REJECTED,
      rejectionReason: rejectionReason || 'Rejected by management',
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath('/handover');
  return { success: true };
}

/**
 * 8. CANCEL HANDOVER REQUEST ACTION
 */
export async function cancelHandoverRequestAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const handover = await prisma.handoverRequest.findUnique({ where: { id } });
  if (!handover || handover.organizationId !== user.organizationId) {
    throw new Error('Handover request not found');
  }

  if (user.role === UserRole.RECRUITER && handover.requestedById !== user.id) {
    throw new Error('Forbidden: You can only cancel requests you initiated');
  }

  await prisma.handoverRequest.update({
    where: { id },
    data: { status: HandoverStatus.CANCELLED },
  });

  revalidatePath('/handover');
  return { success: true };
}

/**
 * 9. GET OWNERSHIP HISTORY ACTION
 */
export async function getOwnershipHistoryAction(params?: {
  entityType?: string;
  entityId?: string;
  recruiterId?: string;
  page?: number;
  limit?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.OwnershipHistoryWhereInput = { organizationId: user.organizationId };

  if (params?.entityType && Object.values(HandoverEntityType).includes(params.entityType as any)) {
    where.entityType = params.entityType;
  }
  if (params?.entityId) {
    where.entityId = params.entityId;
  }
  if (params?.recruiterId) {
    where.OR = [{ fromUserId: params.recruiterId }, { toUserId: params.recruiterId }];
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
      take: limit,
    }),
  ]);

  return {
    items: histories.map((h) => ({
      id: h.id,
      entityType: h.entityType,
      entityId: h.entityId,
      fromUserName: h.fromUser?.name || 'Unassigned',
      toUserName: h.toUser?.name,
      transferredByName: h.transferredBy?.name,
      reason: h.reason,
      transferredAt: h.transferredAt,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
