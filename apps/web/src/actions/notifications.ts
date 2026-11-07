'use server';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  UserRole,
  NotificationChannelEnum,
  UpdateNotificationPreferenceSchema,
} from '@hireflow/shared';

// Helper: Ensure authenticated internal user
async function requireInternalUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Authentication required.');
  }
  if (!([UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] as UserRole[]).includes(user.role)) {
    throw new Error('Forbidden: Only internal recruitment personnel can access notifications.');
  }
  return user;
}

export async function getNotificationsAction(
  tab: 'all' | 'unread' = 'all',
  category?: string,
  limit = 20,
  offset = 0
) {
  const user = await requireInternalUser();

  const whereClause: any = {
    userId: user.id,
    isArchived: false,
  };

  if (tab === 'unread') {
    whereClause.readAt = null;
  }

  if (category) {
    whereClause.category = category;
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

  // Group by Today, Yesterday, Earlier
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const grouped = {
    today: items.filter((n) => n.createdAt >= todayStart),
    yesterday: items.filter((n) => n.createdAt >= yesterdayStart && n.createdAt < todayStart),
    earlier: items.filter((n) => n.createdAt < yesterdayStart),
  };

  return {
    success: true,
    items,
    grouped,
    totalCount,
    unreadCount,
  };
}

export async function markNotificationReadAction(id: string) {
  const user = await requireInternalUser();

  const existing = await prisma.notification.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return { success: false, error: 'Notification not found' };
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const user = await requireInternalUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, isArchived: false },
    data: { readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}

export async function getNotificationPreferencesAction() {
  const user = await requireInternalUser();

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: user.id },
  });

  const defaultChannels = [
    { channel: NotificationChannelEnum.IN_APP, enabled: true, categories: {} },
    { channel: NotificationChannelEnum.EMAIL, enabled: true, categories: {} },
    { channel: NotificationChannelEnum.WHATSAPP, enabled: false, categories: {} },
  ];

  const merged = defaultChannels.map((def) => {
    const found = prefs.find((p) => p.channel === def.channel);
    return found
      ? { id: found.id, channel: found.channel, enabled: found.enabled, categories: (found.categories as any) || {} }
      : def;
  });

  return { success: true, preferences: merged };
}

export async function updateNotificationPreferenceAction(
  channel: NotificationChannelEnum,
  enabled: boolean,
  categories?: Record<string, boolean>
) {
  const user = await requireInternalUser();

  const validated = UpdateNotificationPreferenceSchema.parse({
    channel,
    enabled,
    categories,
  });

  await prisma.notificationPreference.upsert({
    where: {
      userId_channel: {
        userId: user.id,
        channel: validated.channel,
      },
    },
    update: {
      enabled: validated.enabled,
      categories: validated.categories || {},
    },
    create: {
      userId: user.id,
      channel: validated.channel,
      enabled: validated.enabled,
      categories: validated.categories || {},
    },
  });

  revalidatePath('/notifications');
  return { success: true };
}

export async function getDailyDigestAction() {
  const user = await requireInternalUser();
  const todayStr = new Date().toISOString().substring(0, 10);

  const digest = await prisma.dailyDigest.findUnique({
    where: {
      userId_digestDate_channel: {
        userId: user.id,
        digestDate: todayStr,
        channel: 'IN_APP',
      },
    },
  });

  return { success: true, digest };
}
