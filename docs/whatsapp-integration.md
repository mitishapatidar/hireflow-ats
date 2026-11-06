# Meta WhatsApp Business Cloud API Integration

## 1. Compliance & Regulatory Rules
- **Candidate Opt-in:** Outbound messages require `candidate.whatsappOptIn == true`. If candidate has unsubscribed, dispatch is blocked with HTTP 400.
- **24-Hour Customer Care Window:**
  - If candidate sent an inbound message within the last 24 hours: Freeform conversational replies are permitted.
  - If outside the 24-hour window (or first outreach): **Only Meta-approved templates** (`providerApprovalState == 'APPROVED'`) may be sent. Freeform messages outside the 24h window are blocked at the engine layer.
- **Formatting Rule:** Strictly plain text. Corporate email HTML signatures must **never** be appended to WhatsApp messages.

## 2. Webhook Delivery Lifecycle
- Meta Cloud API sends status callbacks for `SENT`, `DELIVERED`, `READ`, and `FAILED`.
- Verified using HMAC-SHA256 signatures via `x-hub-signature-256`.
- Updates are idempotent based on `providerMessageId`.
