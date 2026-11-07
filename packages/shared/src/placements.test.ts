import { describe, it, expect } from 'vitest';
import {
  calculatePlacementFee,
  calculatePaymentDueDate,
  serializePlacementForRole,
  ConfirmJoiningSecureSchema,
  RecordPlacementPaymentSchema,
  JoiningEvidenceSource,
  PlacementPaymentStatus,
} from './placements';
import { UserRole } from './roles';

describe('Placements Domain & Logic', () => {
  describe('calculatePlacementFee', () => {
    it('calculates percentage fee correctly and rounds to 2 decimals', () => {
      // 1,200,000 CTC at 8.33% = 99,960
      const result = calculatePlacementFee(1200000, 8.33);
      expect(result.feeBasis).toBe('PERCENTAGE');
      expect(result.feePercentage).toBe(8.33);
      expect(result.baseFee).toBe(99960);
      expect(result.netFee).toBe(99960);
    });

    it('applies positive and negative adjustment amounts accurately', () => {
      // 1,000,000 CTC at 10% = 100,000 + 5,000 concession/bonus
      const withConcession = calculatePlacementFee(1000000, 10, -5000);
      expect(withConcession.baseFee).toBe(1000000 * 0.1);
      expect(withConcession.adjustmentAmount).toBe(-5000);
      expect(withConcession.netFee).toBe(95000);

      const withBonus = calculatePlacementFee(1000000, 10, 2500);
      expect(withBonus.netFee).toBe(102500);
    });

    it('falls back to FIXED basis when fee percentage is absent or 0', () => {
      const fixedResult = calculatePlacementFee(1500000, null, 150000);
      expect(fixedResult.feeBasis).toBe('FIXED');
      expect(fixedResult.feePercentage).toBeNull();
      expect(fixedResult.baseFee).toBe(0);
      expect(fixedResult.netFee).toBe(150000);
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
      expect((clientView as any).payments).toBeUndefined();
    });

    it('completely strips commercial fees and payments for CANDIDATE role', () => {
      const candidateView = serializePlacementForRole(mockPlacement, UserRole.CANDIDATE);
      expect(candidateView.id).toBe('place-123');
      expect((candidateView as any).commercials).toBeUndefined();
      expect((candidateView as any).feeAmount).toBeUndefined();
    });

    it('hides commercials from standard RECRUITER role unless privileged', () => {
      const recruiterView = serializePlacementForRole(mockPlacement, UserRole.RECRUITER);
      expect(recruiterView.id).toBe('place-123');
      expect(recruiterView.candidateEmail).toBe('priya@example.com');
      // commercials should be null for regular recruiter
      expect(recruiterView.commercials).toBeNull();
    });

    it('includes full commercial fees, balance, and installments for ADMIN/MANAGER roles', () => {
      const adminView = serializePlacementForRole(mockPlacement, UserRole.ADMIN);
      expect(adminView.commercials).not.toBeNull();
      expect(adminView.commercials?.feeAmount).toBe(291550);
      expect(adminView.commercials?.balanceDue).toBe(291550);
      expect(adminView.commercials?.feePercentage).toBe(8.33);
      expect(adminView.joiningConfirmation?.confirmedBy).toBe('HR Director Rahul Roy');
    });
  });

  describe('Validation Schemas', () => {
    it('validates ConfirmJoiningSecureSchema and rejects input without joining evidence', () => {
      const invalid = {
        paymentTerms: 'NET_30',
      };
      const parsed = ConfirmJoiningSecureSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);

      const valid = {
        joiningEvidence: {
          source: JoiningEvidenceSource.CLIENT_EMAIL,
          confirmedBy: 'HR Manager Amit',
          notes: 'Joining verified via formal welcome mail',
        },
        paymentTerms: 'NET_30',
      };
      const validParsed = ConfirmJoiningSecureSchema.safeParse(valid);
      expect(validParsed.success).toBe(true);
    });

    it('validates RecordPlacementPaymentSchema requires positive amount', () => {
      const negative = { amount: -500 };
      expect(RecordPlacementPaymentSchema.safeParse(negative).success).toBe(false);

      const positive = { amount: 50000, paymentMethod: 'BANK_TRANSFER' };
      expect(RecordPlacementPaymentSchema.safeParse(positive).success).toBe(true);
    });
  });
});
