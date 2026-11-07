# Queue Architecture & Background Jobs

## Overview
HireFlow utilizes an asynchronous background job processing architecture powered by BullMQ on Redis, with a zero-dependency in-memory fallback queue for environments where external Redis is unavailable.

## Queue Specifications
HireFlow defines four dedicated background processing queues:
1. `notificationQueue`:
   - Dispatches multi-channel notifications (`IN_APP`, `EMAIL`, `WHATSAPP`).
   - Evaluates recipient notification preferences and WhatsApp opt-in consent before physical dispatch.
   - Enforces deduplication using MD5/SHA256 idempotency hashing.
2. `taskReminderQueue`:
   - Handles delayed task reminders (e.g., 15 minutes before due time).
   - Before firing an alert, performs database validation against the live `Task` record.
   - If the task was completed, cancelled, or snoozed after scheduling, the stale reminder job is safely discarded.
3. `automationQueue`:
   - Evaluates rule triggers against active `AutomationRule` definitions.
   - Enforces strict multi-tenant client scoping (`rule.clientScope === event.clientId`).
   - Sanitizes candidate-facing merge tokens and redacts confidential keywords.
   - Records execution status and attempt metrics in `AutomationExecution`.
4. `digestQueue`:
   - Scheduled recurring queue for the 08:30 IST morning briefing.
   - Aggregates per-user and per-team pending approvals, today's interviews, and overdue follow-ups.

## Redis Connection & In-Memory Fallback
- Production connects via `process.env.REDIS_URL` using `@hireflow/api`'s Redis client.
- When `REDIS_URL` is omitted or Redis is unreachable in development/test runners, the system transparently falls back to an in-memory queue with identical async semantics, preventing test fragility and developer friction.

## Failure Handling & Retries
- Configured with exponential backoff:
  - `attempts: 3`
  - `backoff: { type: 'exponential', delay: 5000 }`
- Dead-letter handling: Failed jobs after 3 attempts are captured in `AutomationExecution` with `status: 'FAILED'` and full error stack traces.
