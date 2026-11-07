/**
 * Sourcing Integration Provider Framework
 *
 * Provides a standardized abstraction for external candidate sourcing channels:
 * - Naukri eHire / Resdex
 * - Foundit (formerly Monster India)
 * - Inbound Email Mailbox
 */

export interface IntegrationHealthReport {
  provider: 'NAUKRI' | 'FOUNDIT' | 'INBOUND_EMAIL';
  status: 'CONNECTED' | 'DISCONNECTED' | 'SETUP_REQUIRED' | 'ERROR';
  isMock: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface IncomingIntegrationCandidate {
  externalId: string;
  candidateName: string;
  email: string;
  phone?: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  location?: string | null;
  experienceYears?: number | null;
  skills: string[];
  rawResumeText?: string;
  resumeUrl?: string;
  sourceMetadata: Record<string, unknown>;
}

export interface SourcingIntegrationProvider {
  readonly providerName: 'NAUKRI' | 'FOUNDIT' | 'INBOUND_EMAIL';
  checkStatus(encryptedCredentials?: string | null, config?: unknown): Promise<IntegrationHealthReport>;
  validateCredentials(credentials: unknown): Promise<{ valid: boolean; error?: string }>;
  fetchAvailableCandidates(
    encryptedCredentials?: string | null,
    config?: unknown
  ): Promise<IncomingIntegrationCandidate[]>;
}
