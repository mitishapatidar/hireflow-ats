/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  NotificationCategoryEnum,
  NotificationChannelEnum,
  UpdateNotificationPreferenceSchema,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';

// In-memory SSE subscriber registry for real-time dispatch
const sseClients = new Map<string, Set<(data: any) => void>>();

export function broadcastNotificationToUser(userId: string, notification: any) {
  const listeners = sseClients.get(userId);
  if (listeners && listeners.size > 0) {
    for (const send of listeners) {
      try {
        send(notification);
      } catch {
        // ignore dead subscriber
      }
    }
  }
}

export const notificationRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const internalRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER];

  // 1. GET /api/notifications — Unified Feed
  server.get(
    '/',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const query = request.query as {
        tab?: string;
        category?: string;
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
      const offset = Math.max(0, parseInt(query.offset || '0', 10));

      const whereClause: any = {
        userId: user.id,
        isArchived: false,
      };

      if (query.tab === 'unread') {
        whereClause.readAt = null;
      }

      if (query.category) {
        whereClause.category = query.category;
      }

      const [items, totalCount, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where: whereClause }),
        prisma.notification.count({
          where: { userId: user.id, readAt: null, isArchived: false },
        }),
      ]);

      // Categorize into Today, Yesterday, Earlier
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart.getTime() - 86400000);

      const grouped = {
        today: items.filter((n) => n.createdAt >= todayStart),
        yesterday: items.filter((n) => n.createdAt >= yesterdayStart && n.createdAt < todayStart),
        earlier: items.filter((n) => n.createdAt < yesterdayStart),
      };

      return reply.send({
        success: true,
        data: {
          items,
          grouped,
          totalCount,
          unreadCount,
          limit,
          offset,
        },
      });
    }
  );

  // 2. POST /api/notifications/:id/read — Mark single as read
  server.post(
    '/:id/read',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const existing = await prisma.notification.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notification not found' },
        });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });

      return reply.send({ success: true, data: updated });
    }
  );

  // 3. POST /api/notifications/read-all — Mark all as read
  server.post(
    '/read-all',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;

      const result = await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null, isArchived: false },
        data: { readAt: new Date() },
      });

      return reply.send({ success: true, data: { updatedCount: result.count } });
    }
  );

  // 4. GET /api/notifications/preferences — Get preferences
  server.get(
    '/preferences',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;

      const prefs = await prisma.notificationPreference.findMany({
        where: { userId: user.id },
      });

      // Default preferences if not yet configured
      const defaultChannels = [
        { channel: NotificationChannelEnum.IN_APP, enabled: true, categories: {} },
        { channel: NotificationChannelEnum.EMAIL, enabled: true, categories: {} },
        { channel: NotificationChannelEnum.WHATSAPP, enabled: false, categories: {} },
      ];

      const merged = defaultChannels.map((def) => {
        const found = prefs.find((p) => p.channel === def.channel);
        return found
          ? { id: found.id, channel: found.channel, enabled: found.enabled, categories: found.categories || {} }
          : def;
      });

      return reply.send({ success: true, data: merged });
    }
  );

  // 5. PUT /api/notifications/preferences — Update preferences
  server.put(
    '/preferences',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;
      const parseResult = UpdateNotificationPreferenceSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid notification preferences payload',
            details: parseResult.error.issues,
          },
        });
      }

      const { channel, enabled, categories } = parseResult.data;

      const updated = await prisma.notificationPreference.upsert({
        where: {
          userId_channel: {
            userId: user.id,
            channel,
          },
        },
        update: {
          enabled,
          categories: categories || {},
        },
        create: {
          userId: user.id,
          channel,
          enabled,
          categories: categories || {},
        },
      });

      return reply.send({ success: true, data: updated });
    }
  );

  // 6. GET /api/notifications/stream — Real-time SSE Stream
  server.get(
    '/stream',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER)],
    },
    async (request, reply) => {
      const user = request.user!;

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');

      reply.raw.write(`data: ${JSON.stringify({ type: 'CONNECTED', userId: user.id })}\n\n`);

      const sendListener = (notification: any) => {
        reply.raw.write(`data: ${JSON.stringify({ type: 'NOTIFICATION', payload: notification })}\n\n`);
      };

      if (!sseClients.has(user.id)) {
        sseClients.set(user.id, new Set());
      }
      sseClients.get(user.id)!.add(sendListener);

      // 15-second heartbeat
      const heartbeat = setInterval(() => {
        reply.raw.write(': ping\n\n');
      }, 15000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        const userListeners = sseClients.get(user.id);
        if (userListeners) {
          userListeners.delete(sendListener);
          if (userListeners.size === 0) {
            sseClients.delete(user.id);
          }
        }
      });
    }
  );
};
