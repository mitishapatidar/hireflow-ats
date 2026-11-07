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
 * NOTICE: feeAmount is STRICTLY computed on the server from Offer.offeredSalary and Client.feePercentage.
 * It is never accepted from the client request.
 */
export const ConfirmJoiningSecureSchema = z.object({
  joinedAt: z.string().optional(),
  joiningEvidence: JoiningEvidenceSchema,
  paymentTerms: z.string().default('NET_30'),
  adjustmentAmount: z.number().default(0).optional(),
  adjustmentReason: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ConfirmJoiningSecureInput = z.infer<typeof ConfirmJoiningSecureSchema>;

export const RecordPlacementPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHEQUE', 'UPI', 'CREDIT', 'OTHER']).default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type RecordPlacementPaymentInput = z.infer<typeof RecordPlacementPaymentSchema>;

export const UpdatePlacementPaymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(PlacementPaymentStatus),
  invoiceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdatePlacementPaymentStatusInput = z.infer<typeof UpdatePlacementPaymentStatusSchema>;

/**
 * Calculates placement commercial fees with Decimal rounding (2 decimal places).
 * If client feePercentage is provided, baseFee = ctc * (feePercentage / 100).
 * If feePercentage is absent or 0, fallback to fixed calculation or 0.
 * netFee = baseFee + adjustmentAmount.
 */
export function calculatePlacementFee(
  ctc: number | string,
  feePercentage?: number | string | null,
  adjustmentAmount?: number | string | null
): {
  baseFee: number;
  netFee: number;
  feePercentage: number | null;
  feeBasis: 'PERCENTAGE' | 'FIXED';
  adjustmentAmount: number;
} {
  const numericCtc = Math.max(0, Number(ctc) || 0);
  const numericAdjustment = Number(adjustmentAmount) || 0;
  const numFeePercentage = feePercentage !== null && feePercentage !== undefined ? Number(feePercentage) : null;

  let baseFee = 0;
  let feeBasis: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE';

  if (numFeePercentage !== null && !isNaN(numFeePercentage) && numFeePercentage > 0) {
    baseFee = Math.round((numericCtc * (numFeePercentage / 100)) * 100) / 100;
    feeBasis = 'PERCENTAGE';
  } else {
    feeBasis = 'FIXED';
    baseFee = 0;
  }

  const netFee = Math.max(0, Math.round((baseFee + numericAdjustment) * 100) / 100);

  return {
    baseFee,
    netFee,
    feePercentage: numFeePercentage,
    feeBasis,
    adjustmentAmount: Math.round(numericAdjustment * 100) / 100,
  };
}

/**
 * Calculates due date based on joiningDate and standard payment terms.
 */
export function calculatePaymentDueDate(joiningDate: Date | string, paymentTerms: string): Date {
  const date = new Date(joiningDate);
  const terms = (paymentTerms || 'NET_30').toUpperCase();

  let days = 30;
  if (terms.includes('15') || terms === 'NET_15') days = 15;
  else if (terms.includes('45') || terms === 'NET_45') days = 45;
  else if (terms.includes('60') || terms === 'NET_60') days = 60;
  else if (terms.includes('90') || terms === 'NET_90') days = 90;
  else if (terms === 'IMMEDIATE' || terms.includes('DUE_ON_RECEIPT')) days = 0;

  const dueDate = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return dueDate;
}

/**
 * Zero Commercial Data Leakage Serializer for Placements.
 * Strict rules:
 * - CLIENT & CANDIDATE: never see feeAmount, ctcSnapshot, feePercentage, adjustments, amountReceived, or payments.
 * - Non-leadership internal roles: see basic operational info, but not agency fee breakdown unless leadership.
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
    joiningConfirmation: placement.joiningConfirmation ? {
      id: placement.joiningConfirmation.id,
      source: placement.joiningConfirmation.source,
      confirmedBy: placement.joiningConfirmation.confirmedBy,
      confirmedAt: placement.joiningConfirmation.confirmedAt,
      documentUrl: placement.joiningConfirmation.documentUrl,
      notes: placement.joiningConfirmation.notes,
    } : null,
    // Commercial fee fields are strictly leadership-only
    commercials: isLeadership ? {
      feeBasis: placement.feeBasis,
      ctcSnapshot: Number(placement.ctcSnapshot ?? 0),
      feePercentage: placement.feePercentage !== null && placement.feePercentage !== undefined ? Number(placement.feePercentage) : null,
      feeAmount: Number(placement.feeAmount ?? 0),
      adjustmentAmount: Number(placement.adjustmentAmount ?? 0),
      adjustmentReason: placement.adjustmentReason,
      amountReceived: Number(placement.amountReceived ?? 0),
      balanceDue: Math.max(0, Number(placement.feeAmount ?? 0) - Number(placement.amountReceived ?? 0)),
      paidAt: placement.paidAt,
      payments: Array.isArray(placement.payments) ? placement.payments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        createdAt: p.createdAt,
      })) : [],
    } : null,
  };
}
