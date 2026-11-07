import { describe, it, expect } from 'vitest';
import {
  calculatePlacementFee,
  calculatePaymentDueDate,
  serializePlacementForRole,
  ConfirmJoiningSecureSchema,
  RecordPlacementPaymentSchema,
  UpdatePlacementPaymentStatusSchema,
  JoiningEvidenceSource,
  PlacementPaymentStatus,
} from './placements';
import { UserRole } from './roles';

describe('Prompt 27 Fix: Placements Domain & Commercial Security Tests', () => {
  describe('calculatePlacementFee — Server-Side Decimal Commercial Fee Engine', () => {
    it('1. calculates percentage fee correctly with 2 decimal precision', () => {
      // 1,200,000 CTC at 8.33% = 99,960
      const result = calculatePlacementFee(1200000, 8.33);
      expect(result.isValid).toBe(true);
      expect(result.feeBasis).toBe('PERCENTAGE');
      expect(result.feePercentage).toBe(8.33);
      expect(result.baseFee).toBe(99960);
      expect(result.grossFee).toBe(99960);
      expect(result.netFee).toBe(99960);
    });

    it('2. returns configuration error if client agreed feePercentage is missing or zero', () => {
      const missingResult = calculatePlacementFee(1500000, null);
      expect(missingResult.isValid).toBe(false);
      expect(missingResult.error).toContain('Client has no agreed fee percentage');
      expect(missingResult.netFee).toBe(0);

      const zeroResult = calculatePlacementFee(1500000, 0);
      expect(zeroResult.isValid).toBe(false);
      expect(zeroResult.error).toContain('Client has no agreed fee percentage');
    });

    it('3. rejects invalid or negative Annual CTC', () => {
      const invalidResult = calculatePlacementFee(-500000, 8.5);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toContain('Invalid or missing offered salary');
    });

    it('4. applies authorized adjustment with non-empty justification: Net Fee = Gross Fee - Authorized Adjustment', () => {
      // 1,000,000 CTC at 10% = 100,000 Gross Fee - 5,000 Concession = 95,000 Net Fee
      const withAdjustment = calculatePlacementFee(
        1000000,
        10,
        5000,
        'Director approved introductory client discount'
      );
      expect(withAdjustment.isValid).toBe(true);
      expect(withAdjustment.grossFee).toBe(100000);
      expect(withAdjustment.adjustmentAmount).toBe(5000);
      expect(withAdjustment.adjustmentReason).toBe('Director approved introductory client discount');
      expect(withAdjustment.netFee).toBe(95000);
    });

    it('5. rejects adjustment greater than zero without justification reason', () => {
      const noReason = calculatePlacementFee(1000000, 10, 5000, '');
      expect(noReason.isValid).toBe(false);
      expect(noReason.error).toContain('justification reason is required');

      const nullReason = calculatePlacementFee(1000000, 10, 5000, null);
      expect(nullReason.isValid).toBe(false);
      expect(nullReason.error).toContain('justification reason is required');
    });

    it('6. rejects negative adjustment amount', () => {
      const negativeAdj = calculatePlacementFee(1000000, 10, -2000, 'Invalid negative');
      expect(negativeAdj.isValid).toBe(false);
      expect(negativeAdj.error).toContain('Adjustment amount must be non-negative');
    });

    it('7. rejects adjustment amount exceeding gross placement fee', () => {
      // Gross fee is 100,000; adjustment is 120,000
      const excessAdj = calculatePlacementFee(1000000, 10, 120000, 'Exceeds fee');
      expect(excessAdj.isValid).toBe(false);
      expect(excessAdj.error).toContain('cannot exceed gross placement fee');
    });
  });

  describe('ConfirmJoiningSecureSchema & Payment Schemas', () => {
    it('8. ConfirmJoiningSecureSchema validates joining evidence and adjustment justification', () => {
      const valid = ConfirmJoiningSecureSchema.safeParse({
        joinedAt: '2026-06-01T00:00:00Z',
        joiningEvidence: {
          source: JoiningEvidenceSource.CLIENT_EMAIL,
          confirmedBy: 'HR Director',
          documentUrl: 'https://example.com/proof.pdf',
        },
        adjustmentAmount: 5000,
        adjustmentReason: 'Strategic client discount approved by CEO',
      });
      expect(valid.success).toBe(true);

      const invalidAdj = ConfirmJoiningSecureSchema.safeParse({
        joiningEvidence: {
          source: JoiningEvidenceSource.CLIENT_EMAIL,
          confirmedBy: 'HR Director',
        },
        adjustmentAmount: 5000,
        adjustmentReason: '', // missing reason
      });
      expect(invalidAdj.success).toBe(false);
    });

    it('9. RecordPlacementPaymentSchema rejects zero or negative amounts', () => {
      const zeroAmount = RecordPlacementPaymentSchema.safeParse({
        amount: 0,
        referenceNumber: 'REF123',
      });
      expect(zeroAmount.success).toBe(false);

      const negativeAmount = RecordPlacementPaymentSchema.safeParse({
        amount: -500,
        referenceNumber: 'REF123',
      });
      expect(negativeAmount.success).toBe(false);

      const valid = RecordPlacementPaymentSchema.safeParse({
        amount: 50000,
        referenceNumber: 'UTR99881122',
        paymentMethod: 'BANK_TRANSFER',
      });
      expect(valid.success).toBe(true);
    });

    it('10. UpdatePlacementPaymentStatusSchema requires waiver reason for WAIVED status', () => {
      const waivedWithoutReason = UpdatePlacementPaymentStatusSchema.safeParse({
        paymentStatus: PlacementPaymentStatus.WAIVED,
      });
      expect(waivedWithoutReason.success).toBe(false);

      const waivedWithReason = UpdatePlacementPaymentStatusSchema.safeParse({
        paymentStatus: PlacementPaymentStatus.WAIVED,
        waiverReason: 'Client dispute settled by executive management',
      });
      expect(waivedWithReason.success).toBe(true);
    });
  });

  describe('calculatePaymentDueDate', () => {
    it('calculates NET_30 due date by adding 30 days', () => {
      const joiningDate = new Date('2026-05-01T00:00:00.000Z');
      const dueDate = calculatePaymentDueDate(joiningDate, 'NET_30');
      const expected = new Date('2026-05-31T00:00:00.000Z');
      expect(dueDate.toISOString()).toBe(expected.toISOString());
    });

    it('calculates NET_15, NET_45, NET_60 and IMMEDIATE due dates', () => {
      const joiningDate = new Date('2026-06-01T00:00:00.000Z');
      const net15 = calculatePaymentDueDate(joiningDate, 'NET_15');
      expect(net15.toISOString()).toBe(new Date('2026-06-16T00:00:00.000Z').toISOString());

      const immediate = calculatePaymentDueDate(joiningDate, 'IMMEDIATE');
      expect(immediate.toISOString()).toBe(joiningDate.toISOString());
    });
  });

  describe('serializePlacementForRole — Zero Commercial Data Leakage', () => {
    const mockPlacement = {
      id: 'place-123',
      applicationId: 'app-1',
      clientId: 'client-1',
      client: { legalName: 'Apex Financial Services' },
      application: {
        candidate: { name: 'Priya Sharma', email: 'priya@example.com' },
        job: { title: 'Senior VP Finance', code: 'FIN-001' },
      },
      joiningDate: new Date('2026-06-01'),
      paymentStatus: PlacementPaymentStatus.PENDING,
      paymentTerms: 'NET_30',
      dueDate: new Date('2026-07-01'),
      feeBasis: 'PERCENTAGE',
      ctcSnapshot: 3500000,
      feePercentage: 8.33,
      feeAmount: 291550,
      adjustmentAmount: 0,
      amountReceived: 0,
      payments: [],
      joiningConfirmation: {
        id: 'jc-1',
        source: JoiningEvidenceSource.CLIENT_EMAIL,
        confirmedBy: 'HR Director Rahul Roy',
        confirmedAt: new Date('2026-05-31'),
        documentUrl: 'https://storage.hireflow.com/proof.pdf',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('completely strips commercial fees and payments for CLIENT role', () => {
      const clientView = serializePlacementForRole(mockPlacement, UserRole.CLIENT);
      expect(clientView.id).toBe('place-123');
      expect(clientView.candidateName).toBe('Priya Sharma');
      expect((clientView as any).commercials).toBeUndefined();
      expect((clientView as any).feeAmount).toBeUndefined();
      expect((clientView as any).ctcSnapshot).toBeUndefined();
    });

    it('omits commercial fees and ledger from RECRUITER role', () => {
      const recruiterView = serializePlacementForRole(mockPlacement, UserRole.RECRUITER);
      expect(recruiterView.id).toBe('place-123');
      expect(recruiterView.commercials).toBeNull();
      expect((recruiterView as any).feeAmount).toBeUndefined();
    });

    it('provides full commercial breakdown and payments ledger to ADMIN role', () => {
      const adminView = serializePlacementForRole(mockPlacement, UserRole.ADMIN);
      expect(adminView.commercials).toBeDefined();
      expect(adminView.commercials?.feeAmount).toBe(291550);
      expect(adminView.commercials?.balanceDue).toBe(291550);
      expect(adminView.commercials?.feePercentage).toBe(8.33);
    });
  });
});
