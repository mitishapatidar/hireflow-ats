# HireFlow ATS — Job Board Integrations Documentation

**Module:** Sourcing & Ingestion (Prompt 20)  
**Implementation:** `packages/shared/src/sourcing-integrations/`  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Architecture & Provider Abstraction
HireFlow ATS provides an extensible provider framework (`SourcingIntegrationProvider`) for external job boards and resume databases.

```typescript
export interface SourcingIntegrationProvider {
  readonly providerName: 'NAUKRI' | 'FOUNDIT' | 'INBOUND_EMAIL';
  checkStatus(encryptedCredentials?: string | null, config?: unknown): Promise<IntegrationHealthReport>;
  validateCredentials(credentials: unknown): Promise<{ valid: boolean; error?: string }>;
  fetchAvailableCandidates(
    encryptedCredentials?: string | null,
    config?: unknown
  ): Promise<IncomingIntegrationCandidate[]>;
}
```

---

## 2. Supported Providers

### A. Naukri.com (`NaukriProvider`)
- Integration with Naukri Resdex / eHire candidate search API.
- Fields extracted: Candidate Name, Current Role, Current Company, Total Experience, Key Skills, Location, Mobile, Email, Resdex Candidate ID.
- Sandbox fallback: Generates realistic senior full-stack candidate profiles from Bengaluru/Gurugram when partner API keys are omitted.

### B. Foundit India (`FounditProvider`)
- Integration with Foundit (formerly Monster India) employer talent search.
- Fields extracted: Candidate Name, Headline, Current Employer, Experience, Skills, Location, Foundit Candidate ID.
- Sandbox fallback: Generates realistic engineering manager profiles from Pune/Hyderabad.

---

## 3. Credential Encryption & Security
- Partner API keys, client secrets, and OAuth tokens are **never stored in plain text**.
- Encrypted using **AES-256-GCM** before writing to `SourcingIntegration.encryptedCredentials`.
- When credentials are not yet configured in production, the provider transitions to `SETUP_REQUIRED` status with clear configuration instructions, rather than crashing or throwing unhandled errors.

---

## 4. API & Workspace Actions
- `GET /api/sourcing/integrations`: Returns health status and connectivity reports for all three providers.
- `POST /api/sourcing/integrations/:provider/connect`: Tests connection and stores encrypted credentials.
- `POST /api/sourcing/integrations/:provider/disconnect`: Deletes stored integration configuration.
