/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  CreateTaskSchema,
  UpdateTaskSchema,
  SnoozeTaskSchema,
  NotificationCategoryEnum,
  NotificationChannelEnum,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';
import { taskReminderQueue } from '../queue/task-reminder-queue.js';
import { notificationQueue } from '../queue/notification-queue.js';

export const taskRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const internalRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER];

  // Helper: Write Audit Log
  async function logTaskAudit(
    actorId: string,
    action: string,
    taskId: string,
    details?: Record<string, any>
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity: 'TASK',
          entityId: taskId,
          after: details || {},
        },
      });
    } catch {
      // Non-blocking audit log
    }
  }

  // 1. GET /api/tasks — Filterable Due & Overdue List
  server.get(
    '/',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const query = request.query as {
        filter?: 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';
        priority?: string;
        assignedToId?: string;
        relatedEntity?: string;
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
      const offset = Math.max(0, parseInt(query.offset || '0', 10));

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

      const whereClause: any = {
        isArchived: false,
      };

      // Role Scoping
      if (user.role === UserRole.RECRUITER) {
        whereClause.assignedToId = user.id;
      } else if (query.assignedToId) {
        whereClause.assignedToId = query.assignedToId;
      }

      if (query.priority) {
        whereClause.priority = query.priority;
      }

      if (query.relatedEntity) {
        whereClause.relatedEntity = query.relatedEntity;
      }

      // Filter modes
      switch (query.filter) {
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
          skip: offset,
          take: limit,
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

      return reply.send({
        success: true,
        data: {
          items,
          totalCount,
          counts: {
            overdue: overdueCount,
            dueToday: dueTodayCount,
          },
          limit,
          offset,
        },
      });
    }
  );

  // 2. POST /api/tasks — Create Task
  server.post(
    '/',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const parseResult = CreateTaskSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid task input',
            details: parseResult.error.issues,
          },
        });
      }

      const data = parseResult.data;

      // Authorization: Recruiters can only assign tasks to themselves
      if (user.role === UserRole.RECRUITER && data.assignedToId !== user.id) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Recruiters can only assign tasks to themselves',
          },
        });
      }

      const task = await prisma.task.create({
        data: {
          title: data.title,
          description: data.description,
          assignedToId: data.assignedToId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          priority: data.priority,
          relatedEntity: data.relatedEntity,
          relatedEntityId: data.relatedEntityId,
          reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
          creatorNotes: data.creatorNotes,
          createdById: user.id,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Schedule automated reminder if dueDate exists
      if (task.dueDate) {
        // Schedule reminder 15 mins before due date
        const reminder15m = new Date(task.dueDate.getTime() - 15 * 60 * 1000);
        if (reminder15m.getTime() > Date.now()) {
          await taskReminderQueue.scheduleReminder(task.id, '15_MIN_BEFORE', reminder15m);
        }
      }

      // If assigned to another user, dispatch an in-app & email notification
      if (task.assignedToId !== user.id) {
        await notificationQueue.dispatch({
          userId: task.assignedToId,
          title: `New Task Assigned: ${task.title}`,
          message: `${user.name} assigned you a task: "${task.title}". Priority: ${task.priority}`,
          category: NotificationCategoryEnum.TASK,
          type: 'TASK_ASSIGNED',
          linkUrl: '/notifications?tab=tasks',
          channels: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
          recipientEmail: task.assignedTo.email,
        });
      }

      await logTaskAudit(user.id, 'TASK_CREATED', task.id, { title: task.title, assignee: task.assignedToId });

      return reply.status(201).send({ success: true, data: task });
    }
  );

  // 3. PATCH /api/tasks/:id — Update Task
  server.patch(
    '/:id',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const parseResult = UpdateTaskSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid task update payload',
            details: parseResult.error.issues,
          },
        });
      }

      const existing = await prisma.task.findUnique({ where: { id } });
      if (!existing || existing.isArchived) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found' },
        });
      }

      // Check permission: Recruiter can only modify their own tasks
      if (user.role === UserRole.RECRUITER && existing.assignedToId !== user.id && existing.createdById !== user.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized to modify this task' },
        });
      }

      const data = parseResult.data;
      const updated = await prisma.task.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          assignedToId: data.assignedToId,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          priority: data.priority,
          status: data.status,
          relatedEntity: data.relatedEntity,
          relatedEntityId: data.relatedEntityId,
          reminderAt: data.reminderAt ? new Date(data.reminderAt) : undefined,
          creatorNotes: data.creatorNotes,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // If status changed to COMPLETED, cancel reminders
      if (data.status === 'COMPLETED') {
        taskReminderQueue.cancelReminder(id);
      }

      await logTaskAudit(user.id, 'TASK_UPDATED', id, { status: updated.status, priority: updated.priority });

      return reply.send({ success: true, data: updated });
    }
  );

  // 4. POST /api/tasks/:id/snooze — Snooze Task
  server.post(
    '/:id/snooze',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const parseResult = SnoozeTaskSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid snooze payload',
            details: parseResult.error.issues,
          },
        });
      }

      const existing = await prisma.task.findUnique({ where: { id } });
      if (!existing || existing.isArchived) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found' },
        });
      }

      if (user.role === UserRole.RECRUITER && existing.assignedToId !== user.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized to snooze this task' },
        });
      }

      const snoozedUntilDate = new Date(parseResult.data.snoozedUntil);

      const updated = await prisma.task.update({
        where: { id },
        data: {
          snoozedUntil: snoozedUntilDate,
          dueDate: snoozedUntilDate, // Update effective due date
          creatorNotes: parseResult.data.notes
            ? `${existing.creatorNotes || ''}\n[Snoozed to ${snoozedUntilDate.toISOString()}]: ${parseResult.data.notes}`.trim()
            : existing.creatorNotes,
        },
      });

      // Reschedule reminder to the new snoozed time
      await taskReminderQueue.scheduleReminder(id, 'AT_DUE', snoozedUntilDate);

      await logTaskAudit(user.id, 'TASK_SNOOZED', id, { snoozedUntil: snoozedUntilDate });

      return reply.send({ success: true, data: updated });
    }
  );

  // 5. POST /api/tasks/:id/complete — Mark Task Completed
  server.post(
    '/:id/complete',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const existing = await prisma.task.findUnique({ where: { id } });
      if (!existing || existing.isArchived) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found' },
        });
      }

      if (user.role === UserRole.RECRUITER && existing.assignedToId !== user.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized to complete this task' },
        });
      }

      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Cancel any pending reminders
      taskReminderQueue.cancelReminder(id);

      await logTaskAudit(user.id, 'TASK_COMPLETED', id, { completedAt: updated.completedAt });

      return reply.send({ success: true, data: updated });
    }
  );
};
