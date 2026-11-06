import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
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

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    sessionId?: string;
  }
}

const authPlugin: FastifyPluginAsync = async (server) => {
  // PreHandler: Authenticate request
  server.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // 1. Extract session token from cookie or Authorization header
      const cookieToken = request.cookies[SESSION_COOKIE_NAME];
      const authHeader = request.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      const rawToken = cookieToken || bearerToken;

      if (!rawToken) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in.',
          },
        });
      }

      // 2. Hash token and query active session
      const tokenHash = hashToken(rawToken);
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

      // 3. Validate session existence and expiry
      if (!session || session.revokedAt || new Date() > session.expiresAt) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Your session has expired or has been revoked. Please sign in again.',
          },
        });
      }

      const user = session.user;

      // 4. Validate account status
      if (user.isArchived || user.status !== 'ACTIVE') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Your account has been deactivated or suspended. Please contact your administrator.',
          },
        });
      }

      // 5. Build AuthUser DTO
      const subordinateIds = user.managedTeams.flatMap((t) => t.members.map((m) => m.id));
      const clientAccess = user.clientAccesses[0]
        ? {
            clientId: user.clientAccesses[0].clientId,
            authorizedJobIds: user.clientAccesses[0].authorizedJobIds,
          }
        : null;

      const orgSettings = (user.organization?.settings as any) || {};
      const grants = orgSettings.permissionGrants || {};

      const authUser: AuthUser = {
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

      request.user = authUser;
      request.sessionId = session.id;
    }
  );
};

// Reusable Helper: Enforce Role
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: 'You do not have permission to access this resource.',
        },
      });
    }
  };
}

// Reusable Helper: Resource-Level Permission Check
export function requirePermission(
  action: AuthAction,
  resolveResource: (request: FastifyRequest) => Promise<AuthResource> | AuthResource
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const resource = await resolveResource(request);
    const authorized = can(request.user, action, resource);

    if (!authorized) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN_RESOURCE',
          message: 'Access denied: You are not authorized to perform this action on this resource.',
        },
      });
    }
  };
}

export default fp(authPlugin, { name: 'hireflow-auth' });
