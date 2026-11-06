# Microsoft 365 / Outlook Integration

## 1. Overview
- **Service:** Microsoft Graph API (OAuth 2.0 Authorization Code flow with PKCE).
- **Required Delegated Scopes:**
  - `Mail.Send` (Send recruiter correspondence via Microsoft 365 mailbox)
  - `Mail.ReadWrite` (Ingest replies into conversation threads)
  - `offline_access` (Long-term background token refresh)
- **Status:** Staged with `DEMO_MODE` adapter until production client secret registration in Prompt 25.
