import { describe, it, expect } from 'vitest';
import {
  OpportunityStage,
  isValidStageTransition,
  validateOpportunityConversionPrerequisites,
  serializeOpportunitySafe,
  CreateOpportunitySchema,
  ConvertOpportunityToJobSchema,
} from './sales';

describe('Prompt 15 — Sales CRM & Opportunity Conversion Engine Tests', () => {
  describe('Sales Pipeline Stage State Machine', () => {
    it('allows valid forward stage transitions', () => {
      expect(isValidStageTransition(OpportunityStage.PROSPECTING, OpportunityStage.MEETING)).toBe(true);
      expect(isValidStageTransition(OpportunityStage.MEETING, OpportunityStage.PROPOSAL)).toBe(true);
      expect(isValidStageTransition(OpportunityStage.PROPOSAL, OpportunityStage.WON)).toBe(true);
      expect(isValidStageTransition(OpportunityStage.PROPOSAL, OpportunityStage.LOST)).toBe(true);
    });

    it('rejects invalid or backwards leaps in pipeline', () => {
      expect(isValidStageTransition(OpportunityStage.PROSPECTING, OpportunityStage.WON)).toBe(false);
      expect(isValidStageTransition(OpportunityStage.LOST, OpportunityStage.WON)).toBe(false);
    });

    it('allows same-stage no-op updates', () => {
      expect(isValidStageTransition(OpportunityStage.PROSPECTING, OpportunityStage.PROSPECTING)).toBe(true);
    });
  });

  describe('Won Opportunity Conversion Prerequisites', () => {
    const validConversionInput = {
      opportunityId: 'opp-101',
      opportunityStage: OpportunityStage.WON,
      isAlreadyConverted: false,
      companyName: 'FinEdge Technologies',
      primaryContact: {
        name: 'Sunita Mehra',
        email: 'sunita.mehra@finedge.com',
        phone: '+91 98765 43210',
      },
      commercialTerms: {
        feePercentage: 8.33,
        paymentTerms: 'NET_30',
      },
      jobDetails: {
        title: 'VP of Engineering',
        recruiterOwnerId: 'user-mitisha-patidar',
        openings: 2,
        location: 'Bengaluru / Hybrid',
        employmentType: 'FULL_TIME',
        description: 'Lead core payments engineering group',
      },
    };

    it('succeeds when all strict prerequisites are satisfied', () => {
      const res = validateOpportunityConversionPrerequisites(validConversionInput);
      expect(res.allowed).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('blocks conversion if opportunity is not in WON stage', () => {
      const input = { ...validConversionInput, opportunityStage: OpportunityStage.PROPOSAL };
      const res = validateOpportunityConversionPrerequisites(input);
      expect(res.allowed).toBe(false);
      expect(res.errors[0]).toContain("Opportunity must be in 'WON' stage");
    });

    it('blocks conversion if already converted (race condition prevention)', () => {
      const input = { ...validConversionInput, isAlreadyConverted: true };
      const res = validateOpportunityConversionPrerequisites(input);
      expect(res.allowed).toBe(false);
      expect(res.errors[0]).toContain('already been converted');
    });

    it('blocks conversion if primary contact details are missing', () => {
      const input = { ...validConversionInput, primaryContact: null };
      const res = validateOpportunityConversionPrerequisites(input);
      expect(res.allowed).toBe(false);
      expect(res.errors.some((e) => e.includes('primary client contact'))).toBe(true);
    });

    it('blocks conversion if commercial terms are missing', () => {
      const input = {
        ...validConversionInput,
        commercialTerms: { feePercentage: 0, paymentTerms: '' },
      };
      const res = validateOpportunityConversionPrerequisites(input);
      expect(res.allowed).toBe(false);
      expect(res.errors.some((e) => e.includes('commercial terms'))).toBe(true);
    });

    it('blocks conversion if recruiter owner is missing', () => {
      const input = {
        ...validConversionInput,
        jobDetails: { ...validConversionInput.jobDetails, recruiterOwnerId: '' },
      };
      const res = validateOpportunityConversionPrerequisites(input);
      expect(res.allowed).toBe(false);
      expect(res.errors.some((e) => e.includes('recruiter owner'))).toBe(true);
    });
  });

  describe('Zod Validation Schemas', () => {
    it('validates opportunity creation payload', () => {
      const valid = {
        title: 'FinTech Tech Leadership Mandate',
        companyName: 'RazorEdge Payments',
        contactName: 'Rohit Verma',
        contactEmail: 'rohit@razoredge.io',
        ownerId: 'user-001',
        estimatedValue: 450000,
        estimatedOpenings: 3,
        stage: OpportunityStage.PROSPECTING,
      };

      const parsed = CreateOpportunitySchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('validates conversion input schema', () => {
      const valid = {
        opportunityId: 'opp-101',
        contactName: 'Rohit Verma',
        contactEmail: 'rohit@razoredge.io',
        feePercentage: 8.33,
        paymentTerms: 'NET_30',
        jobTitle: 'Principal Architect',
        recruiterOwnerId: 'user-001',
        openings: 1,
      };

      const parsed = ConvertOpportunityToJobSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Anti-Leak Safe DTO Serializer', () => {
    it('serializes opportunity without exposing sensitive internal margins', () => {
      const raw = {
        id: 'opp-1',
        title: 'New Enterprise Client',
        companyName: 'Stripe India',
        clientId: 'client-1',
        stage: OpportunityStage.MEETING,
        priority: 'HIGH',
        estimatedValue: 1200000,
        estimatedOpenings: 5,
        industry: 'FinTech',
        location: 'Mumbai',
        nextFollowUpAt: new Date('2026-11-10T10:00:00Z'),
        owner: { id: 'u1', name: 'Aarav Gupta', email: 'aarav@aureva.com' },
        client: { id: 'c1', legalName: 'Stripe India Pvt Ltd', status: 'ACTIVE' },
        internalMarginNotes: 'SUPER CONFIDENTIAL 30% REVENUE MARGIN',
      };

      const safe = serializeOpportunitySafe(raw);
      expect(safe.companyName).toBe('Stripe India');
      expect(safe.stage).toBe(OpportunityStage.MEETING);
      expect(safe.owner?.name).toBe('Aarav Gupta');
      expect((safe as any).internalMarginNotes).toBeUndefined();
    });
  });
});
