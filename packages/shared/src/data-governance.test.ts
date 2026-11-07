import { describe, it, expect } from 'vitest';
import { UserRole } from './roles';
import {
  sanitizeForCsv,
  generateCsvString,
  redactAuditSecrets,
  validateCustomFieldValue,
  getKolkataDayBounds,
  calculateDownloadUsage,
  EXPORT_ENTITY_CATALOG,
  FORBIDDEN_EXPORT_FIELDS,
} from './data-governance';

describe('Data Governance: CSV Sanitization & RFC-4180 Export', () => {
  it('neutralizes spreadsheet formula injection characters (=, +, -, @, \\t, \\r)', () => {
    expect(sanitizeForCsv('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeForCsv('+12345')).toBe("'+12345");
    expect(sanitizeForCsv('-25000')).toBe("'-25000");
    expect(sanitizeForCsv('@cmd|')).toBe("'@cmd|");
    expect(sanitizeForCsv('\tTABBED')).toBe("'\tTABBED");
    // Carriage return causes RFC-4180 quotes wrapping around the prepended quote
    expect(sanitizeForCsv('\rRETURN')).toContain("'\rRETURN");
    // Safe values unchanged
    expect(sanitizeForCsv('John Doe')).toBe('John Doe');
    expect(sanitizeForCsv('candidate@example.com')).toBe('candidate@example.com');
    expect(sanitizeForCsv(12345)).toBe('12345');
    expect(sanitizeForCsv(null)).toBe('');
    expect(sanitizeForCsv(undefined)).toBe('');
  });

  it('generates compliant RFC-4180 CSV with properly escaped quotes and headers', () => {
    const columns = [
      { key: 'name', label: 'Full Name' },
      { key: 'notes', label: 'Candidate Notes' },
      { key: 'formula', label: 'Dangerous Formula' },
    ];
    const rows = [
      { name: 'Alice, Smith', notes: 'Says "Hello World"\nSecond Line', formula: '=cmd|' },
      { name: 'Bob', notes: 'Normal note', formula: 'Plain text' },
    ];

    const csv = generateCsvString(columns, rows);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Full Name,Candidate Notes,Dangerous Formula');
    expect(lines[1]).toContain('"Alice, Smith"');
    expect(lines[1]).toContain('"Says ""Hello World""\nSecond Line"');
    expect(lines[1]).toContain("'=cmd|");
    expect(lines[lines.length - 1]).toContain('Bob');
  });

  it('includes all 8 entities in EXPORT_ENTITY_CATALOG and identifies sensitive columns', () => {
    const entityKeys = Object.keys(EXPORT_ENTITY_CATALOG);
    expect(entityKeys).toEqual([
      'CANDIDATES',
      'JOBS',
      'CLIENTS',
      'APPLICATIONS',
      'SUBMISSIONS',
      'INTERVIEWS',
      'PLACEMENTS',
      'AUDIT_LOGS',
    ]);

    // Check candidate salary is sensitive
    const candidateSalaryCol = EXPORT_ENTITY_CATALOG.CANDIDATES.columns.find((c) => c.key === 'currentSalary');
    expect(candidateSalaryCol?.isSensitive).toBe(true);

    // Check forbidden fields are defined
    expect(FORBIDDEN_EXPORT_FIELDS.has('passwordHash')).toBe(true);
    expect(FORBIDDEN_EXPORT_FIELDS.has('tokenHash')).toBe(true);
    expect(FORBIDDEN_EXPORT_FIELDS.has('otpHashed')).toBe(true);
    expect(FORBIDDEN_EXPORT_FIELDS.has('recruiterMargin')).toBe(true);
  });
});

describe('Data Governance: Audit Trail Secret Redaction', () => {
  it('recursively redacts passwords, tokens, otp hashes and secrets in audit payloads', () => {
    const rawPayload = {
      user: 'admin@aureva.in',
      credentials: {
        password: 'superSecretPassword123!',
        tokenHash: 'sha256$deadbeef1234567890',
        nested: {
          otpHash: 'secret_otp_hash_code',
          safeField: 'visible_info',
        },
      },
      apiKey: 'sk-123456789',
      status: 'SUCCESS',
      attempts: 2,
    };

    const redacted = redactAuditSecrets(rawPayload);

    expect(redacted.credentials.password).toBe('[REDACTED]');
    expect(redacted.credentials.tokenHash).toBe('[REDACTED]');
    expect(redacted.credentials.nested.otpHash).toBe('[REDACTED]');
    expect(redacted.credentials.nested.safeField).toBe('visible_info');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.status).toBe('SUCCESS');
    expect(redacted.attempts).toBe(2);
  });
});

describe('Data Governance: Custom Field Validation', () => {
  it('validates TEXT fields with optional min/max lengths', () => {
    const def = {
      fieldType: 'TEXT',
      validationRules: { minLength: 3, maxLength: 10 },
    };

    expect(validateCustomFieldValue('Hello', def).isValid).toBe(true);
    expect(validateCustomFieldValue('Hi', def).isValid).toBe(false);
    expect(validateCustomFieldValue('Extremely long text string', def).isValid).toBe(false);
  });

  it('validates NUMBER fields with optional min/max values', () => {
    const def = {
      fieldType: 'NUMBER',
      validationRules: { minValue: 10, maxValue: 100 },
    };

    expect(validateCustomFieldValue(50, def).isValid).toBe(true);
    expect(validateCustomFieldValue('75', def).isValid).toBe(true);
    expect(validateCustomFieldValue(5, def).isValid).toBe(false);
    expect(validateCustomFieldValue(150, def).isValid).toBe(false);
    expect(validateCustomFieldValue('not-a-number', def).isValid).toBe(false);
  });

  it('validates DATE and URL fields', () => {
    const dateDef = { fieldType: 'DATE' };
    expect(validateCustomFieldValue('2026-11-07', dateDef).isValid).toBe(true);
    expect(validateCustomFieldValue('invalid-date', dateDef).isValid).toBe(false);

    const urlDef = { fieldType: 'URL' };
    expect(validateCustomFieldValue('https://github.com/aureva', urlDef).isValid).toBe(true);
    expect(validateCustomFieldValue('not-a-url', urlDef).isValid).toBe(false);
  });

  it('validates SELECT and MULTI_SELECT against configured options', () => {
    const selectDef = {
      fieldType: 'SELECT',
      options: ['On-site', 'Hybrid', 'Remote'],
    };

    expect(validateCustomFieldValue('Hybrid', selectDef).isValid).toBe(true);
    expect(validateCustomFieldValue('Full-time', selectDef).isValid).toBe(false);

    const multiDef = {
      fieldType: 'MULTI_SELECT',
      options: ['Node.js', 'React', 'PostgreSQL', 'Docker'],
    };

    expect(validateCustomFieldValue(['Node.js', 'React'], multiDef).isValid).toBe(true);
    expect(validateCustomFieldValue(['Node.js', 'Java'], multiDef).isValid).toBe(false);
  });
});

describe('Data Governance: Asia/Kolkata Day Bounds & Quota Calculation', () => {
  it('calculates the exact UTC interval for the Indian recruitment business day', () => {
    const bounds = getKolkataDayBounds(new Date('2026-11-07T14:30:00Z'));
    expect(bounds.startUtc).toBeInstanceOf(Date);
    expect(bounds.endUtc).toBeInstanceOf(Date);
    expect(bounds.startUtc.getTime()).toBeLessThan(bounds.endUtc.getTime());
    // Asia/Kolkata is UTC+05:30. At 14:30 UTC, it is 20:00 IST on Nov 7.
    // The start in UTC is Nov 6 18:30:00.000 UTC
    expect(bounds.startUtc.toISOString()).toBe('2026-11-06T18:30:00.000Z');
    expect(bounds.endUtc.toISOString()).toBe('2026-11-07T18:29:59.999Z');
  });

  it('calculates download quota usage and remaining allowance', () => {
    const usage = calculateDownloadUsage({
      role: UserRole.RECRUITER,
      configuredLimit: 25,
      downloadsUsedToday: 17,
    });

    expect(usage.dailyLimit).toBe(25);
    expect(usage.usedToday).toBe(17);
    expect(usage.remaining).toBe(8);
    expect(usage.isExceeded).toBe(false);

    const exhausted = calculateDownloadUsage({
      role: UserRole.RECRUITER,
      configuredLimit: 10,
      downloadsUsedToday: 10,
    });

    expect(exhausted.remaining).toBe(0);
    expect(exhausted.isExceeded).toBe(true);
  });
});
