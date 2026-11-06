# Job Mandate Approval Workflow

## 1. Overview
HireFlow enforces governance over new job openings created by recruitment consultants. When an agency activates `requireJobApproval` in its `SecurityPolicy`, job mandates cannot immediately transition from `DRAFT` to `ACTIVE`.

## 2. Security Policy Configuration
- Stored on `SecurityPolicy.requireJobApproval` (`Boolean @default(false)`).
- When `false`: Recruiters and managers can activate jobs immediately upon creation.
- When `true`: Transitioning a job from `DRAFT` to `ACTIVE` directly without manager approval returns HTTP `400 BAD_REQUEST` with error code `JOB_APPROVAL_REQUIRED`.

## 3. Submission for Approval
Recruiters submit drafted jobs for review:
- Endpoint: `POST /api/jobs/:id/submit-for-approval`
- Server Action: `submitJobForApprovalAction(jobId, notes)`
- Status Transition: `DRAFT` → `PENDING_APPROVAL`
- Records transition in `JobStatusHistory` with reason `SUBMITTED_FOR_APPROVAL`.

## 4. Manager Review & Decision
In the Approval Center (`/approvals?tab=jobs`), authorized managers review:
- Commercial terms: openings, salary min/max, fee agreement, client legal name.
- Role specifications: required skills, job description, seniority.
- Decisions:
  1. **Approve (`POST /api/approvals/jobs/:id/approve`):**
     - Status transitions from `PENDING_APPROVAL` → `ACTIVE`.
     - Creates `JobApproval` record (`decision: APPROVED`).
     - Logs status change in `JobStatusHistory`.
  2. **Request Changes (`POST /api/approvals/jobs/:id/request-changes`):**
     - Status transitions to `DRAFT`.
     - Creates `JobApproval` record (`decision: CHANGES_REQUESTED`).
     - Requires non-empty feedback comments.
  3. **Reject (`POST /api/approvals/jobs/:id/reject`):**
     - Status transitions to `CLOSED`.
     - Sets `closingReason = REJECTED_BY_MANAGER`.
     - Creates `JobApproval` record (`decision: REJECTED`).

## 5. Self-Approval Guard
A manager who created the mandate or is designated as the job's `ownerId` cannot approve the job mandate. The server blocks the attempt with HTTP `403 FORBIDDEN` (`SELF_APPROVAL_FORBIDDEN`).
