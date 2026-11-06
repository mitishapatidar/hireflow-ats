# Pipeline Authorization & Access Control

## Role Access Matrix
- **ADMIN / MANAGER:** Full read and write access to all job pipelines in the tenant organization.
- **RECRUITER:** Can only access pipelines for jobs where they are either the designated job `ownerId` or assigned via `JobAssignment`. Unassigned recruiters receive HTTP 403 Forbidden.
- **CLIENT:** External clients are strictly blocked from internal Kanban pipelines (HTTP 403). Submissions to clients use separate client-safe APIs.
- **CANDIDATE:** Candidates have no access to internal recruitment pipeline operations (HTTP 403).
