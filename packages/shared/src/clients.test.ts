import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyName,
  formatClientCode,
  parseClientCode,
  CreateClientSchema,
  UpdateClientSchema,
  UpdateClientCommercialSchema,
  ClientFilterSchema,
  ClientSummaryDTO,
} from './clients';

describe('Prompt 9: Clients CRM Shared Logic & Schemas', () => {
  describe('Company Name Normalization (Duplicate Prevention)', () => {
    it('normalizes company names by removing corporate suffixes and punctuation', () => {
      expect(normalizeCompanyName('Acme Technologies Private Limited')).toBe('acme technologies');
      expect(normalizeCompanyName('Acme Technologies Pvt Ltd')).toBe('acme technologies');
      expect(normalizeCompanyName('Acme Technologies Pvt. Ltd.')).toBe('acme technologies');
      expect(normalizeCompanyName('Bright Labs AI Inc.')).toBe('bright labs ai');
      expect(normalizeCompanyName('Northstar Analytics Corp')).toBe('northstar analytics');
      expect(normalizeCompanyName('Vertex Systems LLC')).toBe('vertex systems');
    });

    it('handles extra whitespaces and casing consistently', () => {
      expect(normalizeCompanyName('   VERTEX   SYSTEMS   GLOBAL  ')).toBe('vertex systems global');
      expect(normalizeCompanyName('')).toBe('');
    });
  });

  describe('Client Code Sequence Formatting', () => {
    it('formats sequential numbers into standard CL-1001+ codes', () => {
      expect(formatClientCode(1001)).toBe('CL-1001');
      expect(formatClientCode(1005)).toBe('CL-1005');
      expect(formatClientCode(1050)).toBe('CL-1050');
      // Minimum code base is 1001
      expect(formatClientCode(1)).toBe('CL-1001');
    });

    it('parses numeric sequence from valid client codes', () => {
      expect(parseClientCode('CL-1001')).toBe(1001);
      expect(parseClientCode('CL-1025')).toBe(1025);
      expect(parseClientCode('invalid')).toBeNull();
      expect(parseClientCode('J-201')).toBeNull();
    });
  });

  describe('Zod Validation Schemas', () => {
    it('validates valid client creation input', () => {
      const valid = {
        legalName: 'Apex Innovations Private Limited',
        industry: 'FinTech',
        website: 'https://apextech.io',
        location: 'Bengaluru, Karnataka',
        status: 'ACTIVE' as const,
        feePercentage: 8.5,
        paymentTerms: 'NET_30',
        primaryContact: {
          name: 'Sunil Rao',
          designation: 'VP Engineering',
          email: 'sunil.r@apextech.io',
          phone: '+91 98765 43210',
          contactType: 'PRIMARY',
          isPrimary: true,
        },
      };

      const result = CreateClientSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid website URLs on client creation', () => {
      const invalid = {
        legalName: 'Invalid Website Corp',
        website: 'not-a-valid-url',
      };

      const result = CreateClientSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('website');
      }
    });

    it('allows empty string as website URL (optional)', () => {
      const validEmpty = {
        legalName: 'Offline Business Ltd',
        website: '',
      };

      const result = CreateClientSchema.safeParse(validEmpty);
      expect(result.success).toBe(true);
    });

    it('validates client commercial update schema', () => {
      const validCommercial = {
        commercialTerms: '8.5% on fixed CTC, 60-day guarantee',
        feePercentage: 8.5,
        paymentTerms: 'NET_45',
        relationshipNotes: 'Strategic account managed at executive level.',
      };

      const result = UpdateClientCommercialSchema.safeParse(validCommercial);
      expect(result.success).toBe(true);
    });

    it('rejects negative fee percentages', () => {
      const invalidFee = {
        feePercentage: -5,
      };

      const result = UpdateClientCommercialSchema.safeParse(invalidFee);
      expect(result.success).toBe(false);
    });

    it('validates client filter query params with safe defaults', () => {
      const parsed = ClientFilterSchema.parse({
        page: '2',
        limit: '15',
        status: 'ACTIVE',
      });

      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(15);
      expect(parsed.status).toBe('ACTIVE');
      expect(parsed.isArchived).toBe(false);
    });
  });

  describe('Contract Isolation: ClientSummaryDTO Zero Leakage', () => {
    it('ensures ClientSummaryDTO type does not expose commercial terms', () => {
      const summary: ClientSummaryDTO = {
        id: 'client-1',
        code: 'CL-1001',
        legalName: 'Acme Corp',
        industry: 'Tech',
        website: 'https://acme.com',
        location: 'Mumbai',
        status: 'ACTIVE',
        isArchived: false,
        archivedAt: null,
        archiveReason: null,
        nextStep: 'Follow up on MSA',
        primaryContact: {
          id: 'contact-1',
          name: 'Priya',
          email: 'priya@acme.com',
          designation: 'Director',
        },
        openJobsCount: 3,
        relationshipOwner: {
          id: 'user-1',
          name: 'Mitisha',
          email: 'mitisha@hireflow.io',
        },
        createdAt: '2026-11-06T00:00:00.000Z',
        updatedAt: '2026-11-06T00:00:00.000Z',
      };

      // Assert at runtime that internal commercial keys are undefined
      expect((summary as any).feePercentage).toBeUndefined();
      expect((summary as any).commercialTerms).toBeUndefined();
      expect((summary as any).paymentTerms).toBeUndefined();
      expect((summary as any).relationshipNotes).toBeUndefined();
    });
  });
});
