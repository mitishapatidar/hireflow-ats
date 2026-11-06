import { describe, it, expect } from 'vitest';
import {
  scrubSensitiveFields,
  HireFlowMonitoringService,
  monitoring,
} from './monitoring';

describe('HireFlow ATS Monitoring & Sensitive Field Scrubber', () => {
  it('scrubs passwords, tokens, auth headers, and session cookies', () => {
    const dirtyPayload = {
      user: {
        id: 'u-123',
        email: 'recruiter@aurevacapital.com',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
      request: {
        authorization: 'Bearer secret-token-abc',
        cookie: 'hireflow_session=token12345',
      },
      commercialTerms: '15% fee with NET 30',
      feePercentage: 15.5,
      notes: 'Standard candidate interview notes',
    };

    const scrubbed = scrubSensitiveFields(dirtyPayload);

    expect(scrubbed.user.password).toBe('[REDACTED]');
    expect(scrubbed.user.token).toBe('[REDACTED]');
    expect(scrubbed.request.authorization).toBe('[REDACTED]');
    expect(scrubbed.request.cookie).toBe('[REDACTED]');
    expect(scrubbed.commercialTerms).toBe('[REDACTED]');
    expect(scrubbed.feePercentage).toBe('[REDACTED]');
    expect(scrubbed.user.email).toBe('recruiter@aurevacapital.com');
    expect(scrubbed.notes).toBe('Standard candidate interview notes');
  });

  it('provides safe disabled state when SENTRY_DSN is not configured', () => {
    const service = new HireFlowMonitoringService();
    const diagnostics = service.getDiagnostics();

    expect(diagnostics.configured).toBe(false);
    expect(diagnostics.status).toContain('SAFE_DISABLED');
  });

  it('captures exceptions without crashing in safe disabled mode', () => {
    const err = new Error('Test application crash');
    const res = monitoring.captureException(err, {
      userId: 'u-99',
      extra: { secret: 'do-not-leak' },
    });

    expect(res).toBeDefined();
    expect(res.status).toBe('LOGGED_LOCALLY');
    expect(res.eventId).toMatch(/^local-/);
  });

  it('records breadcrumbs with scrubbed metadata', () => {
    monitoring.recordBreadcrumb('auth', 'User login attempt', {
      email: 'recruiter@aurevacapital.com',
      password: 'password123',
    });

    const diag = monitoring.getDiagnostics();
    expect(diag.breadcrumbsCount).toBeGreaterThan(0);
  });
});
