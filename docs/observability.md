# Observability, Structured Logging & Monitoring

**Module:** System Observability & Telemetry  
**Playbook Phase:** Phase 1 — Prompt 16  

## 1. Overview

HireFlow ATS implements structured logging, automated request ID propagation, centralized error boundaries, and a privacy-preserving monitoring integration.

## 2. Request ID Generation & Propagation

Every HTTP request to the Fastify API is assigned a unique identifier:

- **Incoming Headers**: If an external `x-request-id` header is supplied (e.g. from a cloud load balancer or reverse proxy), it is validated and preserved.
- **Auto-Generation**: If absent, Fastify generates an RFC-4122 v4 UUID (`crypto.randomUUID()`).
- **Response Header**: The `x-request-id` header is attached to every HTTP response via an `onSend` hook.
- **Log Correlation**: The request ID is attached to all Pino structured logs and included in error responses under `meta.requestId`.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid activity details provided"
  },
  "meta": {
    "timestamp": "2026-11-06T17:15:00.000Z",
    "requestId": "9c8a2b5e-4f1d-487a-b962-d3a0e48227b1"
  }
}
```

## 3. Sensitive Data Scrubbing Protocol

In accordance with strict ATS privacy rules, sensitive data is stripped before logging or transmitting telemetry.

`scrubSensitiveFields()` recursively masks:
- Authentication credentials (`password`, `secret`).
- Tokens & hashes (`sessionToken`, `tokenHash`, `refreshToken`, `accessToken`).
- Request headers (`authorization`, `cookie`).
- Confidential notes and internal recruiter margins.
- Resume binary buffers and full extracted resume text.
- Client commercial terms and fee percentages.

## 4. Sentry Monitoring Integration

The monitoring service (`@hireflow/shared/src/monitoring.ts`) wraps Sentry:

- **Environment Variables**:
  - `SENTRY_DSN`: Endpoint target.
  - `SENTRY_ENVIRONMENT`: Target environment (`development`, `staging`, `production`).
  - `SENTRY_RELEASE`: Release tag (`hireflow-ats@0.1.0`).
- **Safe Disabled Mode**:
  - When `SENTRY_DSN` is empty (e.g., local development or demo environments), the monitoring service operates in safe disabled mode (`SAFE_DISABLED`).
  - Exceptions are formatted, scrubbed, and logged locally without initiating external network connections.
- **Live Status Verification**:
  - In demo environments, live Sentry delivery is reported as unconfigured and safely disabled.

## 5. Next.js Error Boundaries

- **`global-error.tsx`**: Top-level root error boundary capturing exceptions in root layouts and initial page loads, rendering a user-friendly UI matching HireFlow tokens (#5B49D6, #1E2A4A, #F6F7FB).
- **`error.tsx`**: Route-level boundary providing retry action without leaking database error details.
- **`not-found.tsx`**: Custom 404 page for missing ATS routes.
