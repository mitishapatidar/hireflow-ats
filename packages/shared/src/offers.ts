/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { UserRole } from './roles';

export enum OfferStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  RELEASED = 'RELEASED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  JOINED = 'JOINED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
}

export const CreateOfferSchema = z.object({
  applicationId: z.string().min(1, 'Application ID required'),
  clientId: z.string().min(1, 'Client ID required'),
  offeredSalary: z.number().positive('Offered salary must be a positive number'),
  joiningDate: z.string().optional().nullable(),
  releaseDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  offerDocumentUrl: z.string().url().optional().nullable(),
});

export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

export const DeclineOfferSchema = z.object({
  declineReason: z.string().min(3, 'Decline reason must be at least 3 characters'),
});

export type DeclineOfferInput = z.infer<typeof DeclineOfferSchema>;

export const ConfirmJoiningSchema = z.object({
  joinedAt: z.string().optional(),
  feeBasis: z.enum(['PERCENTAGE', 'FLAT']).default('PERCENTAGE'),
  feeAmount: z.number().positive('Fee amount must be greater than zero'),
  paymentTerms: z.string().default('NET_30'),
  dueDate: z.string().optional().nullable(),
});

export type ConfirmJoiningInput = z.infer<typeof ConfirmJoiningSchema>;

export const GlobalSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query required').max(100),
  type: z.enum(['ALL', 'CANDIDATES', 'JOBS', 'CLIENTS']).default('ALL'),
  includeArchived: z.boolean().default(false),
  limit: z.number().int().min(1).max(50).default(20),
});

export type GlobalSearchQueryInput = z.infer<typeof GlobalSearchQuerySchema>;

/**
 * Validates offer state machine transitions
 */
export function isValidOfferTransition(from: OfferStatus, to: OfferStatus): boolean {
  const transitions: Record<OfferStatus, OfferStatus[]> = {
    [OfferStatus.DRAFT]: [OfferStatus.SENT, OfferStatus.RELEASED, OfferStatus.WITHDRAWN],
    [OfferStatus.SENT]: [OfferStatus.RELEASED, OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.EXPIRED, OfferStatus.WITHDRAWN],
    [OfferStatus.RELEASED]: [OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.EXPIRED, OfferStatus.WITHDRAWN],
    [OfferStatus.ACCEPTED]: [OfferStatus.JOINED, OfferStatus.DECLINED, OfferStatus.WITHDRAWN],
    [OfferStatus.DECLINED]: [],
    [OfferStatus.EXPIRED]: [OfferStatus.RELEASED], // allow re-releasing
    [OfferStatus.JOINED]: [], // Terminal placement
    [OfferStatus.WITHDRAWN]: [],
  };

  return transitions[from]?.includes(to) ?? false;
}

/**
 * Strips internal fees, commercial margins, and confidential notes for unprivileged roles
 */
export function serializeOfferForRole(offer: any, role: UserRole) {
  const isPrivileged = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.RECRUITER;
  const isLeadership = role === UserRole.ADMIN || role === UserRole.MANAGER;

  return {
    id: offer.id,
    applicationId: offer.applicationId,
    candidateName: offer.application?.candidate?.name || offer.candidateName,
    candidateEmail: isPrivileged ? (offer.application?.candidate?.email || offer.candidateEmail) : undefined,
    jobTitle: offer.application?.job?.title || offer.jobTitle,
    jobCode: offer.application?.job?.code || offer.jobCode,
    clientName: offer.client?.legalName || offer.clientName,
    status: offer.status,
    offeredSalary: Number(offer.offeredSalary),
    joiningDate: offer.joiningDate,
    releaseDate: offer.releaseDate,
    expiryDate: offer.expiryDate,
    acceptedAt: offer.acceptedAt,
    declinedAt: offer.declinedAt,
    declineReason: isPrivileged ? offer.declineReason : undefined,
    joinedAt: offer.joinedAt,
    notes: isPrivileged ? offer.notes : undefined,
    placementId: isLeadership ? offer.placementId : undefined,
    placementFee: isLeadership && offer.placement ? Number(offer.placement.feeAmount) : undefined,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}
