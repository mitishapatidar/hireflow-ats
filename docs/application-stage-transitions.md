# Application Stage Transitions & State Machine

## Transition Rules
- **Job Status Guard:** If the job mandate is `PAUSED` or `CLOSED`, operational candidate stage movements are strictly rejected with HTTP 409 Conflict.
- **Placed Applications:** Candidates in `PLACED` status cannot be casually moved back without deliberate action.
- **Rejected Applications:** Moving to `REJECTED` requires a mandatory rejection reason code and internal feedback. Moving out of `REJECTED` requires an explanation.
- **Audit Logging:** Every stage transition creates an `ApplicationStageHistory` record and an `AuditLog` entry recording actor ID, before stage, after stage, and timestamp.
