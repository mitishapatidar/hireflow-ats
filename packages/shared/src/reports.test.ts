import { describe, it, expect } from 'vitest';
import {
  REPORT_COLUMN_CATALOG,
  ALLOWED_LINKED_ENTITIES,
  FORBIDDEN_REPORT_FIELDS,
  validateReportColumns,
  ReportQuerySchema,
  CreateClientReportScheduleSchema,
  generateSpreadsheetML,
  generateReportExport,
} from './reports.js';
import { UserRole } from './roles.js';

describe('Prompt 26: Shared Reports Module Tests', () => {
  it('should expose column catalogs for all 7 primary entities', () => {
    const entities = [
      'CANDIDATES',
      'JOBS',
      'APPLICATIONS',
      'INTERVIEWS',
      'SUBMISSIONS',
      'CLIENTS',
      'PLACEMENTS',
    ] as const;

    entities.forEach((entity) => {
      expect(REPORT_COLUMN_CATALOG[entity]).toBeDefined();
      expect(REPORT_COLUMN_CATALOG[entity].length).toBeGreaterThan(0);
      expect(ALLOWED_LINKED_ENTITIES[entity]).toBeDefined();
    });
  });

  describe('validateReportColumns', () => {
    it('should allow valid default columns for RECRUITER', () => {
      const res = validateReportColumns(
        'CANDIDATES',
        ['code', 'name', 'email', 'currentTitle'],
        UserRole.RECRUITER
      );
      expect(res.valid).toBe(true);
      expect(res.safeColumns).toEqual(['code', 'name', 'email', 'currentTitle']);
    });

    it('should reject forbidden internal notes or fee fields', () => {
      for (const forbidden of ['internalNotes', 'feePercentage', 'recruiterMargin', 'notes']) {
        const res = validateReportColumns('CANDIDATES', ['name', forbidden], UserRole.ADMIN);
        expect(res.valid).toBe(false);
        expect(res.error).toContain('Access Denied');
      }
    });

    it('should reject sensitive salary columns for RECRUITER but allow for ADMIN', () => {
      const recruiterRes = validateReportColumns(
        'CANDIDATES',
        ['name', 'currentSalary'],
        UserRole.RECRUITER
      );
      expect(recruiterRes.valid).toBe(false);
      expect(recruiterRes.error).toContain('restricted to Administrator');

      const adminRes = validateReportColumns(
        'CANDIDATES',
        ['name', 'currentSalary'],
        UserRole.ADMIN
      );
      expect(adminRes.valid).toBe(true);
      expect(adminRes.safeColumns).toContain('currentSalary');
    });

    it('should reject empty columns list', () => {
      const res = validateReportColumns('CANDIDATES', [], UserRole.ADMIN);
      expect(res.valid).toBe(false);
    });
  });

  describe('Zod Schemas', () => {
    it('should validate valid report query with 5 row limit default', () => {
      const parsed = ReportQuerySchema.parse({
        primaryEntity: 'JOBS',
        selectedColumns: ['code', 'title', 'status'],
      });
      expect(parsed.limit).toBe(5);
      expect(parsed.sortDirection).toBe('desc');
    });

    it('should validate client report schedule schema', () => {
      const valid = CreateClientReportScheduleSchema.parse({
        clientId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        name: 'Weekly Hiring Progress',
        frequency: 'WEEKLY',
        deliveryDay: 'MONDAY',
        deliveryTime: '09:30',
        timezone: 'Asia/Kolkata',
        period: 'LAST_7_DAYS',
        recipientIds: ['b1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'],
        includeSections: ['JOB_PROGRESS', 'SUBMITTED_PROFILES'],
      });
      expect(valid.frequency).toBe('WEEKLY');
      expect(valid.deliveryTime).toBe('09:30');
    });

    it('should reject invalid delivery time format', () => {
      expect(() =>
        CreateClientReportScheduleSchema.parse({
          clientId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
          name: 'Weekly Hiring Progress',
          frequency: 'WEEKLY',
          deliveryTime: '9:30 AM', // Invalid format
          recipientIds: ['b1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'],
          includeSections: ['JOB_PROGRESS'],
        })
      ).toThrow();
    });
  });

  describe('generateSpreadsheetML & Exports', () => {
    it('should generate valid SpreadsheetML XML with formula-injection defense', () => {
      const headers = [
        { key: 'name', label: 'Candidate Name' },
        { key: 'formula', label: 'Suspicious Cell' },
        { key: 'score', label: 'Numeric Score' },
      ];
      const rows = [
        { name: 'Aarav Patel', formula: '=cmd|’ /C calc’!A0', score: 95 },
      ];

      const xml = generateSpreadsheetML(headers, rows, 'Test Sheet');
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<Worksheet ss:Name="Test Sheet">');
      expect(xml).toContain('Aarav Patel');
      // Formula prefix '=' sanitized with single quote and escaped for XML
      expect(xml).toContain('&apos;=cmd|’ /C calc’!A0');
      expect(xml).toContain('<Data ss:Type="Number">95</Data>');
    });

    it('should export CSV format correctly', () => {
      const headers = [
        { key: 'name', label: 'Full Name' },
        { key: 'email', label: 'Email' },
      ];
      const rows = [{ name: 'Mitisha Sen', email: 'mitisha@example.com' }];

      const exportRes = generateReportExport('CSV', headers, rows);
      expect(exportRes.mimeType).toBe('text/csv; charset=utf-8');
      expect(exportRes.extension).toBe('csv');
      expect(exportRes.content).toContain('Full Name,Email');
      expect(exportRes.content).toContain('Mitisha Sen,mitisha@example.com');
    });
  });
});
