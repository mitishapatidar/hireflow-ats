'use server';

import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@hireflow/db';
import {
  getCurrentUser,
  requireRole,
} from '@/lib/auth';
import {
  UserRole,
  generateSecureToken,
  hashToken,
  isEmailDomainAllowed,
  wouldCreateReportingCycle,
  isManagerEligible,
  InviteMemberSchema,
  InviteMemberInput,
  UpdateReportingLineSchema,
  UpdateReportingLineInput,
  UpdateTeamAssignmentSchema,
  UpdateTeamAssignmentInput,
  ToggleUserStatusSchema,
  ToggleUserStatusInput,
  InviteClientUserSchema,
  InviteClientUserInput,
  UpdateClientAccessSchema,
  UpdateClientAccessInput,
  ResendInvitationSchema,
  ResendInvitationInput,
  RevokeInvitationSchema,
  RevokeInvitationInput,
  UpdatePermissionGrantSchema,
  UpdatePermissionGrantInput,
} from '@hireflow/shared';

export interface AdminActionResult {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// -------------------------------------------------------------
// Helper: Write Audit Log
// -------------------------------------------------------------
async function writeAdminAuditLog(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        before: (before as Prisma.InputJsonValue) || undefined,
        after: (after as Prisma.InputJsonValue) || undefined,
        ipAddress: '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to record admin audit log:', err);
  }
}

// -------------------------------------------------------------
// 1. INVITE TEAM MEMBER ACTION (RECRUITER, MANAGER, ADMIN)
// -------------------------------------------------------------
export async function inviteTeamMemberAction(
  input: InviteMemberInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = InviteMemberSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please correct the validation errors.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const { name, email, role, managerId, teamId } = parseResult.data;

  // Domain allowlist check
  const org = await prisma.organization.findUnique({
    where: { id: admin.organizationId },
  });

  const orgSettings = (org?.settings as Record<string, unknown>) || {};
  const domainAllowlist: string[] = (orgSettings.allowedDomains as string[]) || [
    'hireflow.io',
    'aurevacapital.com',
    'acmetech.com',
  ];

  if (!isEmailDomainAllowed(email, domainAllowlist)) {
    return {
      success: false,
      error: `Email domain is not authorized for this workspace. Allowed domains: ${domainAllowlist.join(', ')}`,
    };
  }

  // Check if active user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && !existingUser.isArchived) {
    return {
      success: false,
      error: 'An active workspace user already exists with this email address.',
    };
  }

  // Check if pending invitation exists
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email,
      organizationId: admin.organizationId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvite) {
    return {
      success: false,
      error: 'An active invitation is already pending for this email address.',
    };
  }

  // Generate secure token
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role: role as UserRole,
      organizationId: admin.organizationId,
      invitedById: admin.id,
      tokenHash,
      status: 'PENDING',
      expiresAt,
    },
  });

  // If user record doesn't exist, create an inactive placeholder user with assigned manager and team
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email,
        name,
        role: role as UserRole,
        status: 'DISABLED', // Inactive until invitation accepted!
        organizationId: admin.organizationId,
        managerId: managerId || null,
        teamId: teamId || null,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: role as UserRole,
        managerId: managerId || null,
        teamId: teamId || null,
      },
    });
  }

  await writeAdminAuditLog(
    admin.id,
    'MEMBER_INVITED',
    'Invitation',
    invitation.id,
    null,
    { email, role, managerId, teamId, invitedById: admin.id }
  );

  revalidatePath('/admin');
  revalidatePath('/admin/team');

  return {
    success: true,
    message: `Invitation successfully sent to ${email} as ${role}.`,
  };
}

// -------------------------------------------------------------
// 2. UPDATE REPORTING LINE ACTION (WITH CYCLE DETECTION)
// -------------------------------------------------------------
export async function updateReportingLineAction(
  input: UpdateReportingLineInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = UpdateReportingLineSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Invalid input parameters.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const { userId, managerId } = parseResult.data;

  // 1. Prevent self-reporting
  if (managerId && userId === managerId) {
    return {
      success: false,
      error: 'A team member cannot report to themselves.',
    };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, managerId: true, organizationId: true },
  });

  if (!targetUser || targetUser.organizationId !== admin.organizationId) {
    return { success: false, error: 'Target user not found in this organization.' };
  }

  // 2. If assigning a manager, validate manager eligibility and cycle detection
  if (managerId) {
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        isArchived: true,
        organizationId: true,
        managerId: true,
      },
    });

    if (!manager || manager.organizationId !== admin.organizationId) {
      return { success: false, error: 'Selected manager not found in this organization.' };
    }

    if (!isManagerEligible(manager.role, manager.status, manager.isArchived)) {
      return {
        success: false,
        error: `Only active MANAGERS or ADMINS can be assigned as reporting managers (Selected user is ${manager.role}).`,
      };
    }

    // Cycle detection traversal
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
      return {
        success: false,
        error:
          'Circular reporting line detected! A user cannot report to someone in their own subordinate hierarchy.',
      };
    }
  }

  const prevManagerId = targetUser.managerId;

  // Update reporting line
  await prisma.user.update({
    where: { id: userId },
    data: { managerId: managerId || null },
  });

  await writeAdminAuditLog(
    admin.id,
    'REPORTING_LINE_CHANGED',
    'User',
    userId,
    { managerId: prevManagerId },
    { managerId }
  );

  revalidatePath('/admin');
  revalidatePath('/admin/team');

  return {
    success: true,
    message: 'Reporting line updated successfully.',
  };
}

// -------------------------------------------------------------
// 3. UPDATE TEAM ASSIGNMENT ACTION
// -------------------------------------------------------------
export async function updateTeamAssignmentAction(
  input: UpdateTeamAssignmentInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = UpdateTeamAssignmentSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid input.' };
  }

  const { userId, teamId } = parseResult.data;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, teamId: true, organizationId: true },
  });

  if (!targetUser || targetUser.organizationId !== admin.organizationId) {
    return { success: false, error: 'Target user not found.' };
  }

  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.organizationId !== admin.organizationId) {
      return { success: false, error: 'Target team does not belong to your organization.' };
    }
  }

  const prevTeamId = targetUser.teamId;

  await prisma.user.update({
    where: { id: userId },
    data: { teamId: teamId || null },
  });

  await writeAdminAuditLog(
    admin.id,
    'TEAM_ASSIGNMENT_CHANGED',
    'User',
    userId,
    { teamId: prevTeamId },
    { teamId }
  );

  revalidatePath('/admin/team');

  return { success: true, message: 'Team assignment updated.' };
}

// -------------------------------------------------------------
// 4. TOGGLE USER STATUS (SAFE DEACTIVATION / REACTIVATION)
// -------------------------------------------------------------
export async function toggleUserStatusAction(
  input: ToggleUserStatusInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = ToggleUserStatusSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid input.' };
  }

  const { userId, status } = parseResult.data;

  // Prevent admin self-deactivation
  if (userId === admin.id) {
    return {
      success: false,
      error: 'Security Commandment: You cannot deactivate your own administrative account.',
    };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, organizationId: true, name: true },
  });

  if (!targetUser || targetUser.organizationId !== admin.organizationId) {
    return { success: false, error: 'User not found.' };
  }

  const prevStatus = targetUser.status;

  // Update status (Preserving all candidates, jobs, and history!)
  await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  // If deactivating, immediately revoke active sessions
  if (status === 'DISABLED') {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await writeAdminAuditLog(
    admin.id,
    status === 'DISABLED' ? 'MEMBER_DEACTIVATED' : 'MEMBER_REACTIVATED',
    'User',
    userId,
    { status: prevStatus },
    { status }
  );

  revalidatePath('/admin/team');

  return {
    success: true,
    message: `Account for ${targetUser.name} has been ${status === 'DISABLED' ? 'deactivated' : 'reactivated'}. All candidate ownership and history were preserved.`,
  };
}

// -------------------------------------------------------------
// 5. INVITE CLIENT USER ACTION (FRAME 30 SIDE PANEL)
// -------------------------------------------------------------
export async function inviteClientUserAction(
  input: InviteClientUserInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = InviteClientUserSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please correct the validation errors.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const { name, email, clientId, authorizedJobIds, downloadLimit } = parseResult.data;

  // Validate client belongs to organization
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client || client.organizationId !== admin.organizationId) {
    return { success: false, error: 'Invalid client organization selected.' };
  }

  // Upsert user account as CLIENT role
  const clientUser = await prisma.user.upsert({
    where: { email },
    update: {
      role: UserRole.CLIENT,
    },
    create: {
      email,
      name,
      role: UserRole.CLIENT,
      organizationId: admin.organizationId,
      status: 'DISABLED', // Inactive until invitation accepted
    },
  });

  // Upsert ClientAccess record
  await prisma.clientAccess.upsert({
    where: {
      userId_clientId: {
        userId: clientUser.id,
        clientId,
      },
    },
    update: {
      authorizedJobIds,
      status: 'ACTIVE',
    },
    create: {
      userId: clientUser.id,
      clientId,
      authorizedJobIds,
      status: 'ACTIVE',
    },
  });

  // Store downloadLimit in organization settings
  const org = await prisma.organization.findUnique({ where: { id: admin.organizationId } });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const clientLimits = (settings.clientDownloadLimits as Record<string, number>) || {};
  clientLimits[clientUser.id] = downloadLimit;

  await prisma.organization.update({
    where: { id: admin.organizationId },
    data: {
      settings: {
        ...settings,
        clientDownloadLimits: clientLimits,
      },
    },
  });

  // Issue invitation
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role: UserRole.CLIENT,
      organizationId: admin.organizationId,
      invitedById: admin.id,
      tokenHash,
      status: 'PENDING',
      expiresAt,
    },
  });

  await writeAdminAuditLog(
    admin.id,
    'CLIENT_USER_INVITED',
    'ClientAccess',
    clientUser.id,
    null,
    { email, clientId, authorizedJobIds, downloadLimit, invitationId: invitation.id }
  );

  revalidatePath('/admin/team');

  return {
    success: true,
    message: `Client invitation sent to ${email} for client ${client.legalName}.`,
  };
}

// -------------------------------------------------------------
// 6. UPDATE CLIENT ACCESS ACTION (ADD / REMOVE JOBS)
// -------------------------------------------------------------
export async function updateClientAccessAction(
  input: UpdateClientAccessInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = UpdateClientAccessSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid input.' };
  }

  const { clientAccessId, authorizedJobIds, downloadLimit, status } = parseResult.data;

  const access = await prisma.clientAccess.findUnique({
    where: { id: clientAccessId },
    include: { client: true, user: true },
  });

  if (!access || access.client.organizationId !== admin.organizationId) {
    return { success: false, error: 'Client access record not found.' };
  }

  const prevJobs = access.authorizedJobIds;
  const prevStatus = access.status;

  await prisma.clientAccess.update({
    where: { id: clientAccessId },
    data: {
      authorizedJobIds,
      status: status || access.status,
    },
  });

  if (downloadLimit !== undefined) {
    const org = await prisma.organization.findUnique({ where: { id: admin.organizationId } });
    const settings = (org?.settings as Record<string, unknown>) || {};
    const clientLimits = (settings.clientDownloadLimits as Record<string, number>) || {};
    clientLimits[access.userId] = downloadLimit;

    await prisma.organization.update({
      where: { id: admin.organizationId },
      data: {
        settings: {
          ...settings,
          clientDownloadLimits: clientLimits,
        },
      },
    });
  }

  await writeAdminAuditLog(
    admin.id,
    'CLIENT_ACCESS_MODIFIED',
    'ClientAccess',
    clientAccessId,
    { authorizedJobIds: prevJobs, status: prevStatus },
    { authorizedJobIds, status, downloadLimit }
  );

  revalidatePath('/admin/team');

  return { success: true, message: 'Client access permissions updated successfully.' };
}

// -------------------------------------------------------------
// 7. RESEND INVITATION ACTION
// -------------------------------------------------------------
export async function resendInvitationAction(
  input: ResendInvitationInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = ResendInvitationSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid invitation ID.' };
  }

  const { invitationId } = parseResult.data;

  const invite = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invite || invite.organizationId !== admin.organizationId) {
    return { success: false, error: 'Invitation not found.' };
  }

  if (invite.status === 'ACCEPTED') {
    return { success: false, error: 'This invitation has already been accepted.' };
  }

  const newToken = generateSecureToken();
  const tokenHash = hashToken(newToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  await prisma.invitation.update({
    where: { id: invitationId },
    data: {
      tokenHash,
      status: 'PENDING',
      expiresAt,
    },
  });

  await writeAdminAuditLog(
    admin.id,
    'INVITATION_RESENT',
    'Invitation',
    invitationId,
    { status: invite.status },
    { status: 'PENDING', expiresAt }
  );

  revalidatePath('/admin/team');

  return { success: true, message: `Invitation resent to ${invite.email}.` };
}

// -------------------------------------------------------------
// 8. REVOKE INVITATION ACTION
// -------------------------------------------------------------
export async function revokeInvitationAction(
  input: RevokeInvitationInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = RevokeInvitationSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid invitation ID.' };
  }

  const { invitationId } = parseResult.data;

  const invite = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invite || invite.organizationId !== admin.organizationId) {
    return { success: false, error: 'Invitation not found.' };
  }

  if (invite.status === 'ACCEPTED') {
    return { success: false, error: 'Cannot revoke an already accepted invitation.' };
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'REVOKED' },
  });

  await writeAdminAuditLog(
    admin.id,
    'INVITATION_REVOKED',
    'Invitation',
    invitationId,
    { status: invite.status },
    { status: 'REVOKED' }
  );

  revalidatePath('/admin/team');

  return { success: true, message: `Invitation for ${invite.email} has been revoked.` };
}

// -------------------------------------------------------------
// 9. UPDATE PERMISSION GRANT ACTION (ADMIN ONLY)
// -------------------------------------------------------------
export async function updatePermissionGrantAction(
  input: UpdatePermissionGrantInput
): Promise<AdminActionResult> {
  const admin = await requireRole(UserRole.ADMIN);

  const parseResult = UpdatePermissionGrantSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid grant parameters.' };
  }

  const { grantKey, enabled } = parseResult.data;

  const org = await prisma.organization.findUnique({
    where: { id: admin.organizationId },
  });

  const settings = (org?.settings as Record<string, unknown>) || {};
  const grants = (settings.permissionGrants as Record<string, boolean>) || {};
  const prevValue = !!grants[grantKey];

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

  await writeAdminAuditLog(
    admin.id,
    'PERMISSION_GRANT_UPDATED',
    'Organization',
    admin.organizationId,
    { [grantKey]: prevValue },
    { [grantKey]: enabled }
  );

  revalidatePath('/admin/team');

  return {
    success: true,
    message: `Permission '${grantKey}' successfully updated to ${enabled ? 'Enabled' : 'Disabled'}.`,
  };
}

// -------------------------------------------------------------
// 10. GET ADMIN TEAM DATA ACTION
// -------------------------------------------------------------
export async function getAdminTeamDataAction() {
  const user = await getCurrentUser();
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    return { success: false, error: 'Unauthorized' };
  }

  const [rawMembers, rawTeams, rawClients, rawJobs, rawClientAccesses, rawInvitations, org] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
          role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT] },
          isArchived: false,
        },
        include: {
          manager: { select: { id: true, name: true, email: true, role: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      prisma.team.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.client.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, legalName: true, website: true },
        orderBy: { legalName: 'asc' },
      }),
      prisma.job.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, title: true, clientId: true, client: { select: { legalName: true } } },
        orderBy: { title: 'asc' },
      }),
      prisma.clientAccess.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
          client: { select: { id: true, legalName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.invitation.findMany({
        where: { organizationId: user.organizationId },
        include: {
          invitedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { settings: true },
      }),
    ]);

  const settings = (org?.settings as Record<string, unknown>) || {};
  const permissionGrants = (settings.permissionGrants as Record<string, boolean>) || {};

  const members = rawMembers.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as UserRole,
    status: m.status,
    manager: m.manager
      ? {
          id: m.manager.id,
          name: m.manager.name,
          email: m.manager.email,
          role: m.manager.role as UserRole,
        }
      : null,
    team: m.team ? { id: m.team.id, name: m.team.name } : null,
  }));

  const eligibleManagers = rawMembers
    .filter(
      (m) =>
        (m.role === UserRole.ADMIN || m.role === UserRole.MANAGER) &&
        m.status === 'ACTIVE'
    )
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role as UserRole,
    }));

  const clients = rawClients.map((c) => ({
    id: c.id,
    name: c.legalName,
    domain: c.website,
  }));

  const jobs = rawJobs.map((j) => ({
    id: j.id,
    title: j.title,
    clientId: j.clientId,
    clientName: j.client?.legalName || 'Unknown Client',
  }));

  const clientAccesses = rawClientAccesses.map((ca) => ({
    id: ca.id,
    userId: ca.userId,
    userName: ca.user.name,
    userEmail: ca.user.email,
    clientId: ca.clientId,
    clientName: ca.client.legalName,
    authorizedJobIds: ca.authorizedJobIds,
    downloadLimit: 10,
    status: ca.user.status,
    updatedAt: ca.updatedAt.toISOString(),
  }));

  const invitations = rawInvitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role as UserRole,
    status: inv.status,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    invitedByName: inv.invitedBy?.name || 'System Admin',
    teamName: null as string | null,
  }));

  return {
    success: true,
    data: {
      members,
      teams: rawTeams,
      eligibleManagers,
      clients,
      jobs,
      clientAccesses,
      invitations,
      permissionGrants,
      currentUserRole: user.role,
      currentUserId: user.id,
    },
  };
}

// -------------------------------------------------------------
// 11. GET AUDIT LOGS ACTION
// -------------------------------------------------------------
export async function getAuditLogsAction(limit: number = 20) {
  const user = await getCurrentUser();
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    return { success: false, error: 'Unauthorized' };
  }

  const logs = await prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter(Boolean)));
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, role: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  return {
    success: true,
    data: logs.map((l) => {
      const actor = actorMap.get(l.actorId);
      return {
        id: l.id,
        actorId: l.actorId,
        actorName: actor?.name || 'System Admin',
        actorRole: (actor?.role as string) || 'ADMIN',
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        before: l.before,
        after: l.after,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
      };
    }),
  };
}
