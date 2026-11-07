# Notification Architecture & Delivery

## Overview
HireFlow provides a multi-channel Notification Centre (Figma Frame 35 at `/notifications`) that centralizes system events, workflow approvals, interview alerts, task reminders, and daily digests.

## Supported Notification Channels
1. **IN_APP**: Real-time notifications displayed in the top navigation dropdown badge, slideout drawer, and the dedicated Notification Centre. Delivered via a Server-Sent Events (SSE) stream (`/api/notifications/stream`) with automated heartbeat (every 15s) and resilient client-side polling fallback.
2. **EMAIL**: Transactional HTML emails sent to the user's primary corporate address.
3. **WHATSAPP**: Candidate-safe templates dispatched to verified mobile numbers (strictly requiring affirmative opt-in consent).

## Notification Priorities & Categories
- **Priorities**:
  - `CRITICAL`: Immediate delivery; ignores non-critical channel snooze/suppression.
  - `HIGH`: Priority alerts for pending approvals, upcoming interviews, and overdue follow-ups.
  - `STANDARD`: Normal operational notifications.
  - `LOW`: Informational logs and digests.
- **Categories**:
  - `INTERVIEW`: Scheduled, rescheduled, or cancelled interviews (24h and 30m alerts).
  - `APPROVAL`: Client submission approvals, offer approvals, and job requisitions.
  - `TASK`: Task assignments, upcoming due dates, and reminders.
  - `CANDIDATE`: Candidate stage progression, note mentions, and status transitions.
  - `SYSTEM`: Security alerts, login warnings, export completions, and audit notifications.

## Real-Time Architecture (SSE)
- **Endpoint**: `GET /api/notifications/stream`
- **Headers**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- **Keep-alive / Heartbeat**: Dispatched every 15 seconds (`:heartbeat\n\n`) to prevent proxy timeout on intermediate gateways and load balancers.
- **Client Auto-Reconnect**: Implemented in React hooks (`NotificationsDropdown.tsx` and `notifications/page.tsx`) with exponential backoff and seamless fallback to periodic polling if SSE connection drops.

## Anti-Spam & Deduplication
- Notification creation enforces deterministic idempotency keys (`notification:{userId}:{category}:{relatedEntityId}:{eventTimestampWindow}`).
- Duplicate events occurring within the deduplication window are safely suppressed.
