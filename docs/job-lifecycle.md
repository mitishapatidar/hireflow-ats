# Job Lifecycle State Machine & History

## Overview
HireFlow enforces a deterministic state machine for job mandates, ensuring data integrity, accurate business metrics, and audit accountability.

## State Machine Diagram
```
  [DRAFT]
     │
     ├── (requireJobApproval=false) ─────────────────────────┐
     │                                                       │
     └── (requireJobApproval=true) ──► [PENDING_APPROVAL]    │
                                              │              │
                                              ▼              ▼
                                          [ACTIVE] ◄──────┐  │
                                            │  ▲          │  │
                         (Pause: holdReason)│  │(Resume)   │  │
                                            ▼  │          │  │
                                          [PAUSED]        │  │
                                            │             │  │
                         (Close: closeReason)             │  │
                                            ▼             │  │
                                          [CLOSED] ───────┘  │
                                            │                │
                                            └── (Reopen) ────┘
```

## State Machine Rules
1. **DRAFT**:
   - Initial state for newly created job mandates.
   - In Phase 1 (`requireJobApproval: false`), direct activation to `ACTIVE` is permitted.
2. **ACTIVE**:
   - Only active jobs can accept new candidate applications or submissions.
   - Can transition to `PAUSED` (with `pauseReason`) or `CLOSED` (with `closingReason` and optional `closingNote`).
3. **PAUSED (On Hold)**:
   - Temporarily frozen mandates (e.g. client budget review, priority shift).
   - **Strict Server-Side Guard**: Application submission attempts return `HTTP 409 Conflict`.
   - Can resume to `ACTIVE` or transition to `CLOSED`.
4. **CLOSED**:
   - Requisition finished or cancelled.
   - Must specify `closingReason` (`POSITION_FILLED`, `BUDGET_CANCELLED`, `ROLE_WITHDRAWN`, `HIRED_INTERNALLY`, `OTHER`).
   - If reason is `OTHER`, a descriptive `closingNote` is required.
   - Can be reopened back to `ACTIVE` or `DRAFT`.
   - **Strict Server-Side Guard**: Rejects new candidate submissions with `HTTP 409 Conflict`.

## Atomic Transitions & History Logging
Every status transition runs inside an atomic Prisma database transaction (`prisma.$transaction`):
1. Updates `Job.status`, `pauseReason`, `resumeReason`, `reopenReason`, `closingReason`, and `closingNote`.
2. Creates an immutable `JobStatusHistory` record tracking `previousStatus`, `newStatus`, `changedById`, `reason`, `note`, and timestamp.
3. Writes an `AuditLog` entry.
