export * from './types';
export * from './naukri-provider';
export * from './foundit-provider';
export * from './inbound-email-provider';

import { SourcingIntegrationProvider } from './types';
import { NaukriIntegrationProvider } from './naukri-provider';
import { FounditIntegrationProvider } from './foundit-provider';
import { InboundEmailProvider } from './inbound-email-provider';

export function getSourcingProvider(name: 'NAUKRI' | 'FOUNDIT' | 'INBOUND_EMAIL'): SourcingIntegrationProvider {
  switch (name) {
    case 'NAUKRI':
      return new NaukriIntegrationProvider();
    case 'FOUNDIT':
      return new FounditIntegrationProvider();
    case 'INBOUND_EMAIL':
      return new InboundEmailProvider();
    default:
      throw new Error(`Unsupported sourcing provider: ${name}`);
  }
}
