/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { UserRole } from './roles';
import { PaymentStatus } from './offers';

export { PaymentStatus };
export const PlacementPaymentStatus = PaymentStatus;
export type PlacementPaymentStatus = PaymentStatus;

export enum JoiningEvidenceSource {
  CLIENT_EMAIL = 'CLIENT_EMAIL',
  HR_CONFIRMATION = 'HR_CONFIRMATION',
  CLIENT_FINANCE = 'CLIENT_FINANCE',
  RECRUITER_VERIFIED = 'RECRUITER_VERIFIED',
}

export const JoiningEvidenceSchema = z.object({
  source: z.nativeEnum(JoiningEvidenceSource),
  confirmedBy: z.string().min(1, 'Name or contact of person confirming is required'),
  confirmedAt: z.string().optional(),
  documentUrl: z.string().url('Document URL must be valid').optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type JoiningEvidenceInput = z.infer<typeof JoiningEvidenceSchema>;

/**
 * Secure joining confirmation schema.
 * Commercial values (gross fee, net fee, fee percentage, ctc, fee basis) are NEVER accepted from the client.
 * They are calculated strictly on the server from authoritative database records.
 */
export const ConfirmJoiningSecureSchema = z
  .object({
    joinedAt: z.string().optional(),
    joiningEvidence: JoiningEvidenceSchema,
    adjustmentAmount: z.number().min(0, 'Adjustment amount must be non-negative').default(0).optional(),
    adjustmentReason: z.string().optional().nullable(),
    invoiceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    // Client-supplied commercial fields are rejected or ignored
    feeAmount: z.never().optional(),
    grossFee: z.never().optional(),
    netFee: z.never().optional(),
    feeBasis: z.never().optional(),
    dueDate: z.never().optional(),
  })
  .refine(
    (data) => {
      if (data.adjustmentAmount && data.adjustmentAmount > 0) {
        return typeof data.adjustmentReason === 'string' && data.adjustmentReason.trim().length > 0;
      }
      return true;
    },
    {
      message: 'A non-empty justification reason is required whenever a commercial fee adjustment is specified',
      path: ['adjustmentReason'],
    }
  );

export type ConfirmJoiningSecureInput = z.infer<typeof ConfirmJoiningSecureSchema>;

export const RecordPlacementPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHEQUE', 'UPI', 'CREDIT', 'OTHER']).default('BANK_TRANSFER'),
  referenceNumber: z.string().min(1, 'Transaction reference number is required').max(100),
  notes: z.string().optional().nullable(),
});

export type RecordPlacementPaymentInput = z.infer<typeof RecordPlacementPaymentSchema>;

export const UpdatePlacementPaymentStatusSchema = z
  .object({
    paymentStatus: z.nativeEnum(PlacementPaymentStatus),
    invoiceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    waiverReason: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.paymentStatus === PlacementPaymentStatus.WAIVED) {
        return (
          (typeof data.waiverReason === 'string' && data.waiverReason.trim().length > 0) ||
          (typeof data.notes === 'string' && data.notes.trim().length > 0)
        );
      }
      return true;
    },
    {
      message: 'A mandatory justification reason is required to waive a placement balance',
      path: ['waiverReason'],
    }
  );

export type UpdatePlacementPaymentStatusInput = z.infer<typeof UpdatePlacementPaymentStatusSchema>;

export interface PlacementFeeCalculationResult {
  baseFee: number;
  grossFee: number;
  netFee: number;
  feePercentage: number | null;
  feeBasis: 'PERCENTAGE' | 'FIXED';
  adjustmentAmount: number;
  adjustmentReason: string | null;
  isValid: boolean;
  error?: string;
}

/**
 * Calculates placement commercial fees using Decimal-grade integer-cents arithmetic.
 * Commercial rule:
 * Net Fee = Gross Fee - Authorized Adjustment
 *
 * Requirements:
 * - Gross Fee = CTC * (feePercentage / 100)
 * - Adjustment must be non-negative
 * - Adjustment cannot exceed Gross Fee
 * - Adjustment > 0 requires a non-empty adjustmentReason
 * - If client has no valid agreed feePercentage, isValid = false with an explicit configuration error
 */
export function calculatePlacementFee(
  ctc: number | string,
  feePercentage?: number | string | null,
  adjustmentAmount?: number | string | null,
  adjustmentReason?: string | null
): PlacementFeeCalculationResult {
  const numCtc = Number(ctc);
  if (isNaN(numCtc) || numCtc <= 0) {
    return {
      baseFee: 0,
      grossFee: 0,
      netFee: 0,
      feePercentage: null,
      feeBasis: 'PERCENTAGE',
      adjustmentAmount: 0,
      adjustmentReason: null,
      isValid: false,
      error: 'Invalid or missing offered salary (Annual CTC) on accepted offer',
    };
  }

  const numFeePercentage =
    feePercentage !== null && feePercentage !== undefined && feePercentage !== ''
      ? Number(feePercentage)
      : null;

  if (numFeePercentage === null || isNaN(numFeePercentage) || numFeePercentage <= 0) {
    return {
      baseFee: 0,
      grossFee: 0,
      netFee: 0,
      feePercentage: null,
      feeBasis: 'PERCENTAGE',
      adjustmentAmount: 0,
      adjustmentReason: null,
      isValid: false,
      error: 'Client has no agreed fee percentage or valid commercial agreement configured',
    };
  }

  // Exact 2-decimal arithmetic via integer cents
  const ctcCents = Math.round(numCtc * 100);
  const grossFeeCents = Math.round((ctcCents * numFeePercentage) / 100);
  const grossFee = grossFeeCents / 100;

  const numAdjustment = Number(adjustmentAmount || 0);
  if (isNaN(numAdjustment) || numAdjustment < 0) {
    return {
      baseFee: grossFee,
      grossFee,
      netFee: grossFee,
      feePercentage: numFeePercentage,
      feeBasis: 'PERCENTAGE',
      adjustmentAmount: 0,
      adjustmentReason: null,
      isValid: false,
      error: 'Adjustment amount must be non-negative',
    };
  }

  const adjustmentCents = Math.round(numAdjustment * 100);
  if (adjustmentCents > grossFeeCents) {
    return {
      baseFee: grossFee,
      grossFee,
      netFee: grossFee,
      feePercentage: numFeePercentage,
      feeBasis: 'PERCENTAGE',
      adjustmentAmount: numAdjustment,
      adjustmentReason: adjustmentReason || null,
      isValid: false,
      error: 'Adjustment amount cannot exceed gross placement fee',
    };
  }

  if (adjustmentCents > 0 && (!adjustmentReason || adjustmentReason.trim().length === 0)) {
    return {
      baseFee: grossFee,
      grossFee,
      netFee: grossFee,
      feePercentage: numFeePercentage,
      feeBasis: 'PERCENTAGE',
      adjustmentAmount: numAdjustment,
      adjustmentReason: null,
      isValid: false,
      error: 'A non-empty justification reason is required for fee adjustments',
    };
  }

  const netFeeCents = grossFeeCents - adjustmentCents;
  const netFee = netFeeCents / 100;

  return {
    baseFee: grossFee,
    grossFee,
    netFee,
    feePercentage: numFeePercentage,
    feeBasis: 'PERCENTAGE',
    adjustmentAmount: adjustmentCents / 100,
    adjustmentReason: adjustmentReason ? adjustmentReason.trim() : null,
    isValid: true,
  };
}

/**
 * Calculates due date based on joiningDate and authoritative client payment terms.
 */
export function calculatePaymentDueDate(joiningDate: Date | string, paymentTerms?: string | null): Date {
  const date = new Date(joiningDate);
  const terms = (paymentTerms || 'NET_30').toUpperCase().trim();

  let days = 30;
  if (terms === 'IMMEDIATE' || terms.includes('DUE_ON_RECEIPT')) {
    days = 0;
  } else if (terms.includes('15') || terms === 'NET_15') {
    days = 15;
  } else if (terms.includes('45') || terms === 'NET_45') {
    days = 45;
  } else if (terms.includes('60') || terms === 'NET_60') {
    days = 60;
  } else if (terms.includes('90') || terms === 'NET_90') {
    days = 90;
  }

  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Zero Commercial Data Leakage Serializer for Placements.
 * Strict rules:
 * - CLIENT & CANDIDATE: never see feeAmount, ctcSnapshot, feePercentage, adjustments, amountReceived, or payments.
 * - Non-leadership internal roles (RECRUITER): see basic operational info, but not agency fee breakdown.
 * - ADMIN & MANAGER: Full commercial receivables and payments ledger.
 */
export function serializePlacementForRole(placement: any, role: UserRole) {
  const isLeadership = role === UserRole.ADMIN || role === UserRole.MANAGER;
  const isInternal = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.RECRUITER;

  // External roles: CLIENT, CANDIDATE
  if (!isInternal) {
    return {
      id: placement.id,
      applicationId: placement.applicationId,
      clientId: placement.clientId,
      clientName: placement.client?.legalName,
      candidateName: placement.application?.candidate?.name,
      jobTitle: placement.application?.job?.title,
      jobCode: placement.application?.job?.code,
      joiningDate: placement.joiningDate,
      paymentStatus: placement.paymentStatus,
      createdAt: placement.createdAt,
    };
  }

  // Internal Recruiters vs Leadership
  return {
    id: placement.id,
    applicationId: placement.applicationId,
    clientId: placement.clientId,
    clientName: placement.client?.legalName,
    candidateName: placement.application?.candidate?.name,
    candidateEmail: placement.application?.candidate?.email,
    jobTitle: placement.application?.job?.title,
    jobCode: placement.application?.job?.code,
    joiningDate: placement.joiningDate,
    paymentStatus: placement.paymentStatus,
    paymentTerms: placement.paymentTerms,
    dueDate: placement.dueDate,
    invoiceNumber: placement.invoiceNumber,
    notes: placement.notes,
    createdAt: placement.createdAt,
    updatedAt: placement.updatedAt,
    joiningConfirmation: placement.joiningConfirmation
      ? {
          id: placement.joiningConfirmation.id,
          source: placement.joiningConfirmation.source,
          confirmedBy: placement.joiningConfirmation.confirmedBy,
          confirmedAt: placement.joiningConfirmation.confirmedAt,
          documentUrl: placement.joiningConfirmation.documentUrl,
          notes: placement.joiningConfirmation.notes,
        }
      : null,
    // Commercial fee fields are strictly leadership-only
    commercials: isLeadership
      ? {
          feeBasis: placement.feeBasis,
          ctcSnapshot: Number(placement.ctcSnapshot ?? 0),
          feePercentage:
            placement.feePercentage !== null && placement.feePercentage !== undefined
              ? Number(placement.feePercentage)
              : null,
          feeAmount: Number(placement.feeAmount ?? 0),
          adjustmentAmount: Number(placement.adjustmentAmount ?? 0),
          adjustmentReason: placement.adjustmentReason,
          amountReceived: Number(placement.amountReceived ?? 0),
          balanceDue: Math.max(0, Number(placement.feeAmount ?? 0) - Number(placement.amountReceived ?? 0)),
          paidAt: placement.paidAt,
          payments: Array.isArray(placement.payments)
            ? placement.payments.map((p: any) => ({
                id: p.id,
                amount: Number(p.amount),
                paymentDate: p.paymentDate,
                paymentMethod: p.paymentMethod,
                referenceNumber: p.referenceNumber,
                notes: p.notes,
                createdAt: p.createdAt,
              }))
            : [],
        }
      : null,
  };
}
