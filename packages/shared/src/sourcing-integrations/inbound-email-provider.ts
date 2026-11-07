/**
 * Inbound Email Ingestion Provider
 *
 * Simulates and interfaces with inbound resume mailbox webhooks (e.g., SendGrid Inbound Parse, Postmark, AWS SES).
 */

import { SourcingIntegrationProvider, IntegrationHealthReport, IncomingIntegrationCandidate } from './types';

export class InboundEmailProvider implements SourcingIntegrationProvider {
  readonly providerName = 'INBOUND_EMAIL' as const;

  async checkStatus(encryptedCredentials?: string | null): Promise<IntegrationHealthReport> {
    if (!encryptedCredentials && !process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
      return {
        provider: 'INBOUND_EMAIL',
        status: 'SETUP_REQUIRED',
        isMock: false,
        message: 'Inbound email webhook secret is not configured. Configure CV inbox forwarding in Admin settings.',
      };
    }

    return {
      provider: 'INBOUND_EMAIL',
      status: 'CONNECTED',
      isMock: true,
      message: 'Inbound resume email listener active (cv-inbox@hireflow.internal).',
    };
  }

  async validateCredentials(credentials: unknown): Promise<{ valid: boolean; error?: string }> {
    if (!credentials || typeof credentials !== 'object') {
      return { valid: false, error: 'Inbound email configuration must be an object' };
    }
    const creds = credentials as Record<string, unknown>;
    if (!creds.mailboxAddress || typeof creds.mailboxAddress !== 'string') {
      return { valid: false, error: 'mailboxAddress string is required' };
    }
    return { valid: true };
  }

  async fetchAvailableCandidates(): Promise<IncomingIntegrationCandidate[]> {
    // Inbound email is push-based via webhook / API endpoint
    return [];
  }
}
