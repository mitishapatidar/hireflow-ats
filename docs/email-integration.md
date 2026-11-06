# Google Workspace / Gmail Integration

## 1. Architecture & Protocol
- **Provider:** Google Workspace OAuth 2.0 with offline access (`refresh_token`).
- **Scopes:**
  - `https://www.googleapis.com/auth/gmail.send` (outbound email dispatch)
  - `https://www.googleapis.com/auth/gmail.readonly` (thread reply synchronization)
- **Phase 1 State:** Configured in `DEMO_MODE`. Mock provider emits verifiable tracking IDs (`mock-email-[hex]`) with UI badges indicating demonstration mode.

## 2. Dispatch Workflow
1. Recruiter drafts or selects template in `/communications`.
2. Merge fields are resolved and sanitized against candidate profile.
3. Corporate team signature is automatically appended.
4. Outbound message is dispatched through provider abstraction.
5. Delivery state is recorded as `SENT` and candidate timeline activity is logged.
