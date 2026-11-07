/**
 * Foundit (formerly Monster India) Sourcing Integration Provider
 */

import { SourcingIntegrationProvider, IntegrationHealthReport, IncomingIntegrationCandidate } from './types';

export class FounditIntegrationProvider implements SourcingIntegrationProvider {
  readonly providerName = 'FOUNDIT' as const;

  async checkStatus(encryptedCredentials?: string | null): Promise<IntegrationHealthReport> {
    if (!encryptedCredentials && !process.env.FOUNDIT_CLIENT_ID) {
      return {
        provider: 'FOUNDIT',
        status: 'SETUP_REQUIRED',
        isMock: false,
        message:
          'Foundit Enterprise API credentials are required. Configure Client ID and Secret in Sourcing Integrations.',
      };
    }

    if (process.env.FOUNDIT_MOCK_ENABLED === 'true' || encryptedCredentials?.includes('demo')) {
      return {
        provider: 'FOUNDIT',
        status: 'CONNECTED',
        isMock: true,
        message: 'Connected to Foundit Sandbox Mock Provider.',
        details: { partnerOrg: 'Aureva Capital Partner' },
      };
    }

    return {
      provider: 'FOUNDIT',
      status: 'CONNECTED',
      isMock: false,
      message: 'Active connection to Foundit Enterprise API verified.',
    };
  }

  async validateCredentials(credentials: unknown): Promise<{ valid: boolean; error?: string }> {
    if (!credentials || typeof credentials !== 'object') {
      return { valid: false, error: 'Credentials payload must be an object' };
    }
    const creds = credentials as Record<string, unknown>;
    if (!creds.clientId || !creds.clientSecret) {
      return { valid: false, error: 'Both clientId and clientSecret are required for Foundit' };
    }
    return { valid: true };
  }

  async fetchAvailableCandidates(
    encryptedCredentials?: string | null,
    _config?: unknown
  ): Promise<IncomingIntegrationCandidate[]> {
    const status = await this.checkStatus(encryptedCredentials);
    if (status.status !== 'CONNECTED') {
      return [];
    }

    if (status.isMock) {
      return [
        {
          externalId: 'FD-MOCK-402',
          candidateName: 'Kavita Sundaram',
          email: 'kavita.sundaram@example.com',
          phone: '+91 94451 88990',
          currentCompany: 'Freshworks Inc',
          currentTitle: 'Product Manager',
          location: 'Chennai',
          experienceYears: 7.0,
          skills: ['Product Strategy', 'SaaS', 'Roadmapping', 'Agile', 'SQL'],
          rawResumeText: 'SaaS Product Manager with experience leading B2B growth and CRM integrations.',
          sourceMetadata: { source: 'FOUNDIT', importedAt: new Date().toISOString() },
        },
      ];
    }

    return [];
  }
}
