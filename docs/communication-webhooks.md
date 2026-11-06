# Communication Webhooks

## 1. Webhook Endpoints
- `POST /api/communications/webhooks/whatsapp` (Meta WhatsApp Business Cloud API)
- `POST /api/communications/webhooks/sms` (SMS Provider Delivery Notifications)

## 2. Security & Signature Verification
- Inbound webhooks from Meta are validated against `x-hub-signature-256` using HMAC-SHA256 with constant-time equality check (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

## 3. Idempotency & Delivery State Progression
- Webhook payloads process delivery updates idempotently based on `providerMessageId`.
- Delivery status progresses cleanly: `SENT` ➔ `DELIVERED` ➔ `READ` (or `FAILED` with error diagnostics).
