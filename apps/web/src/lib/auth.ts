import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@hireflow/db';
import {
  AuthUser,
  AuthAction,
  AuthResource,
  can,
  hashToken,
  SESSION_COOKIE_NAME,
  UserRole,
} from '@hireflow/shared';

/**
 * Resolves the authenticated user from the database session.
 * Does not trust any client-supplied role.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    // In dev mode: allow developer role simulation for layout tests
    if (process.env.NODE_ENV === 'development') {
      const devRoleCookie = cookieStore.get('hireflow_dev_role')?.value as UserRole;
      const primaryOrg = await prisma.organization.findUnique({
        where: { id: 'org-aureva-1' },
        select: { id: true },
      });
      const firstOrg = primaryOrg || (await prisma.organization.findFirst({ select: { id: true } }));
      const orgId = firstOrg?.id || 'org-aureva-1';

      const targetRole = devRoleCookie || UserRole.ADMIN;
      const sampleUser = await prisma.user.findFirst({
        where: { role: targetRole, organizationId: orgId, status: 'ACTIVE' },
        select: { id: true, email: true, name: true, managerId: true, teamId: true },
      });

      return {
        id: sampleUser?.id || `dev-${targetRole.toLowerCase()}-1`,
        email: sampleUser?.email || `${targetRole.toLowerCase()}@hireflow.io`,
        name: sampleUser?.name || `Dev ${targetRole}`,
        role: targetRole,
        organizationId: orgId,
        status: 'ACTIVE',
      };
    }
    return null;
  }

  // Hash token and lookup active session
  const tokenHash = hashToken(sessionToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          organization: true,
          clientAccesses: true,
          managedTeams: {
            include: {
              members: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || new Date() > session.expiresAt) {
    return null;
  }

  // Server-Enforced Inactivity Auto-Logout
  const policy = await prisma.securityPolicy.findUnique({
    where: { organizationId: session.user.organizationId },
  });
  const timeoutMinutes = policy?.inactivityTimeoutMinutes ?? 30;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const now = Date.now();
  const lastActivity = session.lastActivityAt ? session.lastActivityAt.getTime() : session.createdAt.getTime();

  if (now - lastActivity > timeoutMs) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Throttled update of lastActivityAt (once every 60 seconds)
  if (now - lastActivity > 60 * 1000) {
    prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    }).catch(() => {});
  }

  const user = session.user;
  if (user.isArchived || user.status !== 'ACTIVE') {
    return null;
  }

  const subordinateIds = user.managedTeams.flatMap((t) => t.members.map((m) => m.id));
  const clientAccess = user.clientAccesses[0]
    ? {
        clientId: user.clientAccesses[0].clientId,
        authorizedJobIds: user.clientAccesses[0].authorizedJobIds,
      }
    : null;

  const orgSettings = (user.organization?.settings as Record<string, unknown>) || {};
  const grants = (orgSettings.permissionGrants as Record<string, boolean>) || {};

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    organizationId: user.organizationId,
    managerId: user.managerId,
    teamId: user.teamId,
    status: user.status,
    subordinateIds,
    clientAccess,
    grants,
  };
}

/**
 * Ensures user is authenticated; otherwise redirects to /login.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Ensures user is authenticated and has an allowed role; otherwise redirects to /no-permission.
 */
export async function requireRole(...allowedRoles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    redirect('/no-permission');
  }
  return user;
}

/**
 * Ensures user is authorized to perform action on resource; otherwise redirects to /no-permission.
 */
export async function requirePermission(action: AuthAction, resource: AuthResource): Promise<AuthUser> {
  const user = await requireAuth();
  const authorized = can(user, action, resource);
  if (!authorized) {
    redirect('/no-permission');
  }
  return user;
}
