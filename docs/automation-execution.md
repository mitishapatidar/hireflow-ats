# Automation Execution History & Idempotency

## Overview
Every automated action triggered by an `AutomationRule` is tracked in the `AutomationExecution` table to provide complete observability, auditability, and idempotent guarantees.

## Data Schema
- `id`: Unique identifier (UUID).
- `ruleId`: ID of the triggered `AutomationRule`.
- `ruleVersion`: Integer version of the rule at the exact moment of execution.
- `triggerEvent`: The event identifier (e.g. `INTERVIEW_SCHEDULED_24H_BEFORE`, `TASK_REMINDER_15M_BEFORE`).
- `relatedEntity`: Target entity type (`CANDIDATE`, `JOB`, `INTERVIEW`, `TASK`, `CLIENT`).
- `relatedEntityId`: Target entity ID.
- `recipientId`: ID of the user or contact receiving the communication.
- `channel`: `IN_APP` | `EMAIL` | `WHATSAPP`.
- `status`: `PENDING` | `SUCCESS` | `FAILED` | `SKIPPED`.
- `idempotencyKey`: Deterministic hash (`sha256` or structured string).
- `attemptCount`: Integer count of attempts (1 to 3).
- `failureReason`: String error message or rejection reason if execution failed or skipped.
- `providerResponse`: JSON response payload from the notification provider or messaging service.
- `createdAt`: Execution start timestamp.

## Deterministic Idempotency Keys
To prevent duplicate emails or notifications from firing during network blips, server restarts, or concurrent events, the engine generates deterministic idempotency keys:
```ts
// Format: auto:{ruleId}:v{ruleVersion}:{triggerEvent}:{relatedEntityId}:{recipientId}
const idempotencyKey = `auto:${rule.id}:v${rule.version}:${triggerEvent}:${entityId}:${recipientId}`;
```
If an execution with the same `idempotencyKey` already exists in `AutomationExecution` with status `SUCCESS` or `PENDING`, subsequent invocations are immediately aborted with `status: 'SKIPPED'` and `failureReason: 'Idempotency key already processed'`.

## Client Scope Verification
Before executing any communication action, `automationQueue.processEvent` verifies:
```ts
if (rule.clientScope && rule.clientScope !== event.clientId) {
  // Execution skipped due to client isolation boundary
  return { status: 'SKIPPED', reason: 'Client scope mismatch' };
}
```
This guarantees that candidate records, interviews, or tasks linked to Client A will never trigger automations configured for Client B.
