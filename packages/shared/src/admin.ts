import { z } from 'zod';
import { UserRole } from './roles';

// -------------------------------------------------------------
// 1. Team & Member Management Schemas
// -------------------------------------------------------------

export const InviteMemberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Please enter a valid work email').trim().toLowerCase(),
  role: z.enum([UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN], {
    errorMap: () => ({ message: 'Role must be RECRUITER, MANAGER, or ADMIN' }),
  }),
  managerId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateReportingLineSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  managerId: z.string().min(1, 'Manager ID must be valid').nullable(),
});

export type UpdateReportingLineInput = z.infer<typeof UpdateReportingLineSchema>;

export const UpdateTeamAssignmentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  teamId: z.string().min(1, 'Team ID must be valid').nullable(),
});

export type UpdateTeamAssignmentInput = z.infer<typeof UpdateTeamAssignmentSchema>;

export const ToggleUserStatusSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export type ToggleUserStatusInput = z.infer<typeof ToggleUserStatusSchema>;

// -------------------------------------------------------------
// 2. Client Access Schemas (Frame 30 Side Panel)
// -------------------------------------------------------------

export const InviteClientUserSchema = z.object({
  name: z.string().min(2, 'Client user name must be at least 2 characters').trim(),
  email: z.string().email('Please enter a valid client corporate email').trim().toLowerCase(),
  clientId: z.string().min(1, 'Please select an authorized client organization'),
  authorizedJobIds: z.array(z.string()).default([]),
  downloadLimit: z.coerce.number().int().min(1).max(100).default(10),
});

export type InviteClientUserInput = z.infer<typeof InviteClientUserSchema>;

export const UpdateClientAccessSchema = z.object({
  clientAccessId: z.string().min(1, 'Client access ID is required'),
  authorizedJobIds: z.array(z.string()),
  downloadLimit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

export type UpdateClientAccessInput = z.infer<typeof UpdateClientAccessSchema>;

// -------------------------------------------------------------
// 3. Invitation Management Schemas
// -------------------------------------------------------------

export const RevokeInvitationSchema = z.object({
  invitationId: z.string().min(1, 'Invitation ID is required'),
});

export type RevokeInvitationInput = z.infer<typeof RevokeInvitationSchema>;

export const ResendInvitationSchema = z.object({
  invitationId: z.string().min(1, 'Invitation ID is required'),
});

export type ResendInvitationInput = z.infer<typeof ResendInvitationSchema>;

// -------------------------------------------------------------
// 4. Role Permission Grant Schemas
// -------------------------------------------------------------

export const GrantablePermissionKey = z.enum([
  'recruiterViewInternalFees',
  'adminApproveJob',
  'managerExportReports',
]);

export type GrantablePermissionKey = z.infer<typeof GrantablePermissionKey>;

export const UpdatePermissionGrantSchema = z.object({
  grantKey: GrantablePermissionKey,
  enabled: z.boolean(),
});

export type UpdatePermissionGrantInput = z.infer<typeof UpdatePermissionGrantSchema>;
