import { z } from 'zod';
import crypto from 'crypto';

export const SlotOptionInputSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export const CreateSlotInvitationSchema = z.object({
  applicationId: z.string().min(1),
  roundId: z.string().optional().nullable(),
  duration: z.number().int().min(15).max(180).default(45),
  timezone: z.string().default('Asia/Kolkata'),
  panelMemberIds: z.array(z.string().min(1)).min(1),
  notes: z.string().max(1000).optional().nullable(),
  expiresInHours: z.number().int().min(1).max(336).default(48), // up to 14 days
  slots: z.array(SlotOptionInputSchema).min(1),
});

export type CreateSlotInvitationInput = z.infer<typeof CreateSlotInvitationSchema>;

export const ConfirmSlotBookingSchema = z.object({
  slotOptionId: z.string().min(1),
  timezone: z.string().default('Asia/Kolkata'),
  candidateNotes: z.string().max(500).optional().nullable(),
});

export type ConfirmSlotBookingInput = z.infer<typeof ConfirmSlotBookingSchema>;

export const PublicSlotOptionSchema = z.object({
  id: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  isAvailable: z.boolean(),
});

export const PublicSlotInvitationDTOSchema = z.object({
  token: z.string(),
  status: z.enum(['PENDING', 'BOOKED', 'EXPIRED', 'CANCELLED']),
  expiresAt: z.string(),
  candidateName: z.string(),
  jobTitle: z.string(),
  roundName: z.string(),
  duration: z.number(),
  timezone: z.string(),
  slotOptions: z.array(PublicSlotOptionSchema),
  bookedInterview: z
    .object({
      scheduledAt: z.string(),
      duration: z.number(),
      timezone: z.string(),
      meetingLink: z.string().nullable().optional(),
    })
    .optional()
    .nullable(),
});

export type PublicSlotInvitationDTO = z.infer<typeof PublicSlotInvitationDTOSchema>;

/**
 * Generate a cryptographically secure 32-byte hex token and its SHA-256 hash.
 */
export function generateSlotInvitationToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSlotToken(token);
  return { token, tokenHash };
}

/**
 * Deterministically hash an invitation token using SHA-256 for safe database indexing.
 */
export function hashSlotToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}
