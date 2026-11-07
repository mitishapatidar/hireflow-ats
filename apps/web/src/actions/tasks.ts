'use server';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  CreateTaskSchema,
  CreateTaskInput,
  UpdateTaskSchema,
  UpdateTaskInput,
  SnoozeTaskSchema,
  SnoozeTaskInput,
  NotificationCategoryEnum,
} from '@hireflow/shared';

async function requireInternalUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Authentication required.');
  }
  if (!([UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] as UserRole[]).includes(user.role)) {
    throw new Error('Forbidden: Only internal recruitment personnel can access tasks.');
  }
  return user;
}

export async function getTasksAction(
  filter: 'today' | 'upcoming' | 'overdue' | 'completed' | 'all' = 'all',
  priority?: string,
  assignedToId?: string
) {
  const user = await requireInternalUser();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

  const whereClause: any = {
    isArchived: false,
  };

  if (user.role === UserRole.RECRUITER) {
    whereClause.assignedToId = user.id;
  } else if (assignedToId) {
    whereClause.assignedToId = assignedToId;
  }

  if (priority && priority !== 'ALL') {
    whereClause.priority = priority;
  }

  switch (filter) {
    case 'today':
      whereClause.dueDate = { gte: todayStart, lte: todayEnd };
      whereClause.status = { notIn: ['COMPLETED', 'CANCELLED'] };
      break;
    case 'overdue':
      whereClause.dueDate = { lt: now };
      whereClause.status = { notIn: ['COMPLETED', 'CANCELLED'] };
      break;
    case 'upcoming':
      whereClause.dueDate = { gt: todayEnd };
      whereClause.status = { notIn: ['COMPLETED', 'CANCELLED'] };
      break;
    case 'completed':
      whereClause.status = 'COMPLETED';
      break;
    case 'all':
    default:
      break;
  }

  const [items, totalCount, overdueCount, dueTodayCount] = await Promise.all([
    prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    }),
    prisma.task.count({ where: whereClause }),
    prisma.task.count({
      where: {
        assignedToId: user.role === UserRole.RECRUITER ? user.id : undefined,
        dueDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        isArchived: false,
      },
    }),
    prisma.task.count({
      where: {
        assignedToId: user.role === UserRole.RECRUITER ? user.id : undefined,
        dueDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        isArchived: false,
      },
    }),
  ]);

  return {
    success: true,
    items,
    totalCount,
    counts: {
      overdue: overdueCount,
      dueToday: dueTodayCount,
    },
  };
}

export async function createTaskAction(data: CreateTaskInput) {
  const user = await requireInternalUser();
  const validated = CreateTaskSchema.parse(data);

  if (user.role === UserRole.RECRUITER && validated.assignedToId !== user.id) {
    return { success: false, error: 'Recruiters can only assign tasks to themselves' };
  }

  const task = await prisma.task.create({
    data: {
      title: validated.title,
      description: validated.description,
      assignedToId: validated.assignedToId,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      priority: validated.priority,
      relatedEntity: validated.relatedEntity,
      relatedEntityId: validated.relatedEntityId,
      reminderAt: validated.reminderAt ? new Date(validated.reminderAt) : null,
      creatorNotes: validated.creatorNotes,
      createdById: user.id,
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // If assigned to another user, dispatch in-app notification
  if (task.assignedToId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: task.assignedToId,
        title: `New Task Assigned: ${task.title}`,
        message: `${user.name} assigned you a task: "${task.title}". Priority: ${task.priority}`,
        category: NotificationCategoryEnum.TASK,
        type: 'TASK_ASSIGNED',
        linkUrl: '/notifications?tab=tasks',
      },
    });
  }

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'TASK_CREATED',
        entity: 'TASK',
        entityId: task.id,
        after: { title: task.title, assignee: task.assignedToId },
      },
    });
  } catch {
    // Audit write non-blocking
  }

  revalidatePath('/notifications');
  return { success: true, task };
}

export async function updateTaskAction(id: string, data: UpdateTaskInput) {
  const user = await requireInternalUser();
  const validated = UpdateTaskSchema.parse(data);

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.isArchived) {
    return { success: false, error: 'Task not found' };
  }

  if (user.role === UserRole.RECRUITER && existing.assignedToId !== user.id && existing.createdById !== user.id) {
    return { success: false, error: 'Not authorized to modify this task' };
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: validated.title,
      description: validated.description,
      assignedToId: validated.assignedToId,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
      priority: validated.priority,
      status: validated.status,
      relatedEntity: validated.relatedEntity,
      relatedEntityId: validated.relatedEntityId,
      reminderAt: validated.reminderAt ? new Date(validated.reminderAt) : undefined,
      creatorNotes: validated.creatorNotes,
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'TASK_UPDATED',
        entity: 'TASK',
        entityId: id,
        after: { status: updated.status, priority: updated.priority },
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath('/notifications');
  return { success: true, task: updated };
}

export async function snoozeTaskAction(id: string, data: SnoozeTaskInput) {
  const user = await requireInternalUser();
  const validated = SnoozeTaskSchema.parse(data);

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.isArchived) {
    return { success: false, error: 'Task not found' };
  }

  if (user.role === UserRole.RECRUITER && existing.assignedToId !== user.id) {
    return { success: false, error: 'Not authorized to snooze this task' };
  }

  const snoozedUntilDate = new Date(validated.snoozedUntil);

  const updated = await prisma.task.update({
    where: { id },
    data: {
      snoozedUntil: snoozedUntilDate,
      dueDate: snoozedUntilDate,
      creatorNotes: validated.notes
        ? `${existing.creatorNotes || ''}\n[Snoozed to ${snoozedUntilDate.toISOString()}]: ${validated.notes}`.trim()
        : existing.creatorNotes,
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'TASK_SNOOZED',
        entity: 'TASK',
        entityId: id,
        after: { snoozedUntil: snoozedUntilDate },
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath('/notifications');
  return { success: true, task: updated };
}

export async function completeTaskAction(id: string) {
  const user = await requireInternalUser();

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.isArchived) {
    return { success: false, error: 'Task not found' };
  }

  if (user.role === UserRole.RECRUITER && existing.assignedToId !== user.id) {
    return { success: false, error: 'Not authorized to complete this task' };
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'TASK_COMPLETED',
        entity: 'TASK',
        entityId: id,
        after: { completedAt: updated.completedAt },
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath('/notifications');
  return { success: true, task: updated };
}
