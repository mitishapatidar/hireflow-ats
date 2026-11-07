import { describe, it, expect } from 'vitest';
import {
  OfferStatus,
  isValidOfferTransition,
  serializeOfferForRole,
  CreateOfferSchema,
  DeclineOfferSchema,
  ConfirmJoiningSchema,
  GlobalSearchQuerySchema,
} from './offers';
import { UserRole } from './roles';

describe('Prompt 21: Offers & Placements Lifecycle Tests', () => {
  it('validates permitted Offer state machine transitions', () => {
    expect(isValidOfferTransition(OfferStatus.DRAFT, OfferStatus.RELEASED)).toBe(true);
    expect(isValidOfferTransition(OfferStatus.RELEASED, OfferStatus.ACCEPTED)).toBe(true);
    expect(isValidOfferTransition(OfferStatus.ACCEPTED, OfferStatus.JOINED)).toBe(true);
    expect(isValidOfferTransition(OfferStatus.RELEASED, OfferStatus.DECLINED)).toBe(true);
    expect(isValidOfferTransition(OfferStatus.RELEASED, OfferStatus.EXPIRED)).toBe(true);
    expect(isValidOfferTransition(OfferStatus.EXPIRED, OfferStatus.RELEASED)).toBe(true);
  });

  it('blocks invalid transitions (e.g. from JOINED or directly DRAFT to JOINED)', () => {
    expect(isValidOfferTransition(OfferStatus.JOINED, OfferStatus.DRAFT)).toBe(false);
    expect(isValidOfferTransition(OfferStatus.JOINED, OfferStatus.RELEASED)).toBe(false);
    expect(isValidOfferTransition(OfferStatus.DRAFT, OfferStatus.JOINED)).toBe(false);
    expect(isValidOfferTransition(OfferStatus.DECLINED, OfferStatus.ACCEPTED)).toBe(false);
  });

  it('serializeOfferForRole protects private placement fees and internal notes from external roles', () => {
    const rawOffer = {
      id: 'off-1',
      applicationId: 'app-1',
      candidateName: 'Aarav Patel',
      candidateEmail: 'aarav@example.com',
      jobTitle: 'Senior Backend Engineer',
      jobCode: 'J-201',
      clientName: 'Nexus Tech',
      status: OfferStatus.JOINED,
      offeredSalary: '2400000',
      joiningDate: '2026-12-01T00:00:00Z',
      declineReason: null,
      notes: 'Negotiated joining bonus ₹2L',
      placementId: 'place-1',
      placement: { feeAmount: '200000' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Client serializer
    const clientView = serializeOfferForRole(rawOffer, UserRole.CLIENT);
    expect(clientView.notes).toBeUndefined();
    expect(clientView.candidateEmail).toBeUndefined();
    expect(clientView.placementFee).toBeUndefined();
    expect(clientView.offeredSalary).toBe(2400000);

    // Recruiter serializer
    const recruiterView = serializeOfferForRole(rawOffer, UserRole.RECRUITER);
    expect(recruiterView.notes).toBe('Negotiated joining bonus ₹2L');
    expect(recruiterView.candidateEmail).toBe('aarav@example.com');
    expect(recruiterView.placementFee).toBeUndefined(); // recruiters do not see agency placement fee margin

    // Manager / Admin serializer
    const managerView = serializeOfferForRole(rawOffer, UserRole.MANAGER);
    expect(managerView.placementFee).toBe(200000);
    expect(managerView.notes).toBe('Negotiated joining bonus ₹2L');
  });

  it('validates schemas for create, decline, and confirm joining', () => {
    const validOffer = CreateOfferSchema.safeParse({
      applicationId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      clientId: 'CL-1001',
      offeredSalary: 1800000,
    });
    expect(validOffer.success).toBe(true);

    const invalidSalary = CreateOfferSchema.safeParse({
      applicationId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      clientId: 'CL-1001',
      offeredSalary: -500,
    });
    expect(invalidSalary.success).toBe(false);

    const validDecline = DeclineOfferSchema.safeParse({
      declineReason: 'Accepted competitive counter-offer',
    });
    expect(validDecline.success).toBe(true);

    const validJoining = ConfirmJoiningSchema.safeParse({
      feeBasis: 'PERCENTAGE',
      feeAmount: 150000,
      paymentTerms: 'NET_30',
    });
    expect(validJoining.success).toBe(true);

    const validSearch = GlobalSearchQuerySchema.safeParse({
      q: 'Developer',
      type: 'JOBS',
      includeArchived: false,
    });
    expect(validSearch.success).toBe(true);
  });
});
