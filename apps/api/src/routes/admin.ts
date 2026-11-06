import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  generateSecureToken,
  hashToken,
  isEmailDomainAllowed,
  wouldCreateReportingCycle,
  isManagerEligible,
  InviteMemberSchema,
  UpdateReportingLineSchema,
  UpdateTeamAssignmentSchema,
  ToggleUserStatusSchema,
  InviteClientUserSchema,
  UpdateClientAccessSchema,
  UpdatePermissionGrantSchema,
  UpdateSecurityPolicySchema,
} from '@hireflow/shared';
import { requireRole, requireReverification } from '../plugins/auth.js';

const adminRoutes: FastifyPluginAsync = async (server) => {
  // Helper: Log Admin Audit Event
  async function logAdminEvent(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          before: before || undefined,
          after: after || undefined,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      server.log.error(err, 'Failed to log admin audit event');
    }
  }

  // -------------------------------------------------------------
  // 1. GET /api/admin/members (Team & Reporting Roster)
  // -------------------------------------------------------------
  server.get(
    '/api/admin/members',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN, UserRole.MANAGER),
      ],
    },
    async (request, reply) => {
      const user = request.user!;
      const isManager = user.role === UserRole.MANAGER;

      let whereClause: any = {
        organizationId: user.organizationId,
        isArchived: false,
      };

      // Manager can only view their own team and subordinates!
      if (isManager) {
        whereClause = {
          organizationId: user.organizationId,
          isArchived: false,
          OR: [
            { id: user.id },
            { managerId: user.id },
            user.teamId ? { teamId: user.teamId } : {},
          ],
        };
      }

      const members = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          manager: {
            select: { id: true, name: true, role: true },
          },
          team: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              candidatesOwned: true,
              jobsOwned: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return reply.status(200).send({
        success: true,
        data: { members },
      });
    }
  );

  // -------------------------------------------------------------
  // 2. POST /api/admin/members/invite
  // -------------------------------------------------------------
  server.post(
    '/api/admin/members/invite',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const parseResult = InviteMemberSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid invitation parameters',
            details: parseResult.error.format(),
          },
        });
      }

      const admin = request.user!;
      const { name, email, role, managerId, teamId } = parseResult.data;

      // Domain check
      const org = await prisma.organization.findUnique({
        where: { id: admin.organizationId },
      });
      const orgSettings = (org?.settings as any) || {};
      const domainAllowlist: string[] = orgSettings.allowedDomains || [
        'hireflow.io',
        'aurevacapital.com',
        'acmetech.com',
      ];

      if (!isEmailDomainAllowed(email, domainAllowlist)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'DOMAIN_NOT_ALLOWED',
            message: `Email domain is not authorized. Allowed: ${domainAllowlist.join(', ')}`,
          },
        });
      }

      // Check existing user
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && !existingUser.isArchived && existingUser.status === 'ACTIVE') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'USER_ALREADY_EXISTS',
            message: 'An active user already exists with this email address.',
          },
        });
      }

      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

      const invitation = await prisma.invitation.create({
        data: {
          email,
          role: role as any,
          organizationId: admin.organizationId,
          invitedById: admin.id,
          tokenHash,
          status: 'PENDING',
          expiresAt,
        },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email,
            name,
            role: role as any,
            status: 'DISABLED',
            organizationId: admin.organizationId,
            managerId: managerId || null,
            teamId: teamId || null,
          },
        });
      }

      await logAdminEvent(
        admin.id,
        'MEMBER_INVITED',
        'Invitation',
        invitation.id,
        null,
        { email, role, managerId, teamId },
        request.ip
      );

      return reply.status(201).send({
        success: true,
        data: {
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role,
          message: 'Member invitation sent successfully.',
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 3. PATCH /api/admin/members/:userId/reporting
  // -------------------------------------------------------------
  server.patch(
    '/api/admin/members/:userId/reporting',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const parseResult = UpdateReportingLineSchema.safeParse({
        userId,
        managerId: (request.body as any)?.managerId,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid reporting line input' },
        });
      }

      const admin = request.user!;
      const { managerId } = parseResult.data;

      if (managerId && userId === managerId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'SELF_REPORTING_DENIED', message: 'A user cannot report to themselves.' },
        });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser || targetUser.organizationId !== admin.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      if (managerId) {
        const manager = await prisma.user.findUnique({ where: { id: managerId } });
        if (!manager || manager.organizationId !== admin.organizationId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_MANAGER', message: 'Manager not found in this organization.' },
          });
        }

        if (!isManagerEligible(manager.role, manager.status, manager.isArchived)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MANAGER_INELIGIBLE',
              message: `Only active MANAGERS or ADMINS are eligible as reporting managers.`,
            },
          });
        }

        const hasCycle = await wouldCreateReportingCycle(
          userId,
          managerId,
          async (id: string) => {
            const u = await prisma.user.findUnique({
              where: { id },
              select: { managerId: true },
            });
            return u?.managerId;
          }
        );

        if (hasCycle) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'CIRCULAR_REPORTING_DETECTED',
              message: 'Circular reporting detected. A user cannot report to their subordinate.',
            },
          });
        }
      }

      const prevManagerId = targetUser.managerId;
      await prisma.user.update({
        where: { id: userId },
        data: { managerId: managerId || null },
      });

      await logAdminEvent(
        admin.id,
        'REPORTING_LINE_CHANGED',
        'User',
        userId,
        { managerId: prevManagerId },
        { managerId },
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: { userId, managerId, message: 'Reporting line updated successfully.' },
      });
    }
  );

  // -------------------------------------------------------------
  // 4. PATCH /api/admin/members/:userId/status (Deactivate/Reactivate)
  // -------------------------------------------------------------
  server.patch(
    '/api/admin/members/:userId/status',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const parseResult = ToggleUserStatusSchema.safeParse({
        userId,
        status: (request.body as any)?.status,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid status value' },
        });
      }

      const admin = request.user!;
      const { status } = parseResult.data;

      if (userId === admin.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'CANNOT_SELF_DEACTIVATE', message: 'You cannot deactivate your own account.' },
        });
      }

      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser || targetUser.organizationId !== admin.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const prevStatus = targetUser.status;
      await prisma.user.update({
        where: { id: userId },
        data: { status },
      });

      if (status === 'DISABLED') {
        await prisma.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await logAdminEvent(
        admin.id,
        status === 'DISABLED' ? 'MEMBER_DEACTIVATED' : 'MEMBER_REACTIVATED',
        'User',
        userId,
        { status: prevStatus },
        { status },
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: {
          userId,
          status,
          message: `User account has been ${status === 'DISABLED' ? 'deactivated' : 'reactivated'}. All candidate ownership and records were preserved.`,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // 5. GET /api/admin/client-access
  // -------------------------------------------------------------
  server.get(
    '/api/admin/client-access',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const admin = request.user!;

      const clientAccesses = await prisma.clientAccess.findMany({
        where: {
          client: { organizationId: admin.organizationId },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, status: true, lastLoginAt: true },
          },
          client: {
            select: { id: true, legalName: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.status(200).send({
        success: true,
        data: { clientAccesses },
      });
    }
  );

  // -------------------------------------------------------------
  // 6. GET /api/admin/invitations
  // -------------------------------------------------------------
  server.get(
    '/api/admin/invitations',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const admin = request.user!;

      const invitations = await prisma.invitation.findMany({
        where: { organizationId: admin.organizationId },
        include: {
          invitedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Sanitized without raw tokens
      const sanitized = invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status:
          inv.status === 'PENDING' && new Date() > inv.expiresAt ? 'EXPIRED' : inv.status,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        createdAt: inv.createdAt,
        invitedBy: inv.invitedBy,
      }));

      return reply.status(200).send({
        success: true,
        data: { invitations: sanitized },
      });
    }
  );

  // -------------------------------------------------------------
  // 7. PATCH /api/admin/permissions/grant (Explicit Grants)
  // -------------------------------------------------------------
  server.patch(
    '/api/admin/permissions/grant',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const parseResult = UpdatePermissionGrantSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid permission grant parameters' },
        });
      }

      const admin = request.user!;
      const { grantKey, enabled } = parseResult.data;

      const org = await prisma.organization.findUnique({
        where: { id: admin.organizationId },
      });

      const settings = (org?.settings as any) || {};
      const grants = settings.permissionGrants || {};
      const prev = !!grants[grantKey];
      grants[grantKey] = enabled;

      await prisma.organization.update({
        where: { id: admin.organizationId },
        data: {
          settings: {
            ...settings,
            permissionGrants: grants,
          },
        },
      });

      await logAdminEvent(
        admin.id,
        'PERMISSION_GRANT_UPDATED',
        'Organization',
        admin.organizationId,
        { [grantKey]: prev },
        { [grantKey]: enabled },
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: {
          grantKey,
          enabled,
          message: `Permission grant '${grantKey}' updated to ${enabled}.`,
        },
      });
    }
  );

  // ==========================================
  // 6. SECURITY POLICIES (Prompt 17)
  // ==========================================

  // GET /api/admin/security/policies (Retrieve Organization Security Policy)
  server.get(
    '/api/admin/security/policies',
    {
      preHandler: [(server as any).authenticate, requireRole(UserRole.ADMIN)],
    },
    async (request, reply) => {
      const admin = request.user!;

      let policy = await prisma.securityPolicy.findUnique({
        where: { organizationId: admin.organizationId },
      });

      if (!policy) {
        policy = await prisma.securityPolicy.create({
          data: {
            organizationId: admin.organizationId,
            allowedAuthMethods: ['EMAIL_PASSWORD', 'GOOGLE'],
            requireTwoStepVerification: true,
            otpDeliveryMethod: 'EMAIL',
            otpExpirySeconds: 300,
            otpResendCooldownSeconds: 30,
            otpMaxAttempts: 3,
            maxConcurrentSessions: 2,
            inactivityTimeoutMinutes: 30,
            warningBeforeExpiryMinutes: 5,
            sensitiveActionReverificationMinutes: 15,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { policy },
      });
    }
  );

  // PATCH /api/admin/security/policies (Update Organization Security Policy with Mandatory Re-verification)
  server.patch(
    '/api/admin/security/policies',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(UserRole.ADMIN),
        requireReverification(15),
      ],
    },
    async (request, reply) => {
      const admin = request.user!;
      const parseResult = UpdateSecurityPolicySchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid security policy configuration',
            details: parseResult.error.flatten(),
          },
        });
      }

      const {
        allowedAuthMethods,
        allowedEmailDomains,
        requireTwoStepVerification,
        otpDeliveryMethod,
        otpExpirySeconds,
        otpResendCooldownSeconds,
        otpMaxAttempts,
        maxConcurrentSessions,
        inactivityTimeoutMinutes,
        warningBeforeExpiryMinutes,
        sensitiveActionReverificationMinutes,
        clientAccessPolicy,
        changeReason,
      } = parseResult.data;

      const currentPolicy = await prisma.securityPolicy.findUnique({
        where: { organizationId: admin.organizationId },
      });

      const updatedPolicy = await prisma.securityPolicy.upsert({
        where: { organizationId: admin.organizationId },
        update: {
          allowedAuthMethods,
          allowedEmailDomains,
          requireTwoStepVerification,
          otpDeliveryMethod,
          otpExpirySeconds,
          otpResendCooldownSeconds,
          otpMaxAttempts,
          maxConcurrentSessions,
          inactivityTimeoutMinutes,
          warningBeforeExpiryMinutes,
          sensitiveActionReverificationMinutes,
          clientAccessPolicy: clientAccessPolicy ?? undefined,
          updatedById: admin.id,
        },
        create: {
          organizationId: admin.organizationId,
          allowedAuthMethods,
          allowedEmailDomains,
          requireTwoStepVerification,
          otpDeliveryMethod,
          otpExpirySeconds,
          otpResendCooldownSeconds,
          otpMaxAttempts,
          maxConcurrentSessions,
          inactivityTimeoutMinutes,
          warningBeforeExpiryMinutes,
          sensitiveActionReverificationMinutes,
          clientAccessPolicy: clientAccessPolicy ?? undefined,
          updatedById: admin.id,
        },
      });

      await logAdminEvent(
        admin.id,
        'SECURITY_POLICY_UPDATED',
        'SecurityPolicy',
        updatedPolicy.id,
        currentPolicy ? (currentPolicy as any) : null,
        (updatedPolicy as any),
        request.ip
      );

      return reply.status(200).send({
        success: true,
        data: {
          policy: updatedPolicy,
          message: 'Security policies updated successfully.',
        },
      });
    }
  );
};

export default adminRoutes;
