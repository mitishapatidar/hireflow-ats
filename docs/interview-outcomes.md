# Interview Outcomes & State Transitions

## 1. Lifecycle State Machine
```
SCHEDULED ────► COMPLETED
          ├────► NO_SHOW ────► RESCHEDULED ──► COMPLETED
          ├────► RESCHEDULED
          └────► CANCELLED
```

## 2. Outcome Workflows
- **Completed:** Sets `outcome: COMPLETED`, records `completedAt: now`, allows panel feedback submission, preserves scheduling history in `InterviewHistory`.
- **No-Show (Critical ATS Rule):**
  - Sets `outcome: NO_SHOW` and records `noShowAt: now`.
  - **NEVER** alters `Application.stageId`.
  - **NEVER** moves application to `REJECTED`.
  - **NEVER** sends automated rejection notices.
  - Recruiter independently decides whether to reschedule or contact candidate.
- **Rescheduled:**
  - Requires mandatory reschedule reason.
  - Preserves prior timestamp in `Interview.previousScheduledAt` and `InterviewHistory`.
  - Re-evaluates double-booking conflicts before committing.
- **Cancelled:**
  - Sets `outcome: CANCELLED` with mandatory cancellation reason.
  - Retains immutable audit history.
