# Centralized Approval Center (Figma Frame 28)

## 1. Overview
The **Approval Center** (`/approvals`) is a unified review hub for recruitment agency managers and administrators to inspect, review, and sign off on high-stakes business events:
1. Client candidate submissions.
2. New job mandates requiring manager approval before going live.
3. Remediation cycles for items where changes were previously requested.
4. Complete audit history of past approval decisions.

## 2. Four Operational Tabs
- **Tab 1: Submissions (`submissions`):** All candidate submissions in `PENDING_MANAGER_APPROVAL`.
- **Tab 2: New Jobs (`jobs`):** All job mandates in `PENDING_APPROVAL`.
- **Tab 3: Changes Requested (`changes_requested`):** Items returned to recruiters with specific feedback notes.
- **Tab 4: Decision History (`history`):** Complete chronological log of approved, rejected, and change-requested records.

## 3. Strict Server-Side Self-Approval Prevention
Recruiters and mandate owners are strictly prohibited from approving their own records, enforced via server-side checks and centralized `assertNotSelfApproval`:
- If a Manager creates a job mandate or owns a candidate submission, they **cannot** approve it.
- UI displays a locked warning badge: `Self-Submission (Disabled - Requires Independent Sign-off)`.
- Backend endpoints return HTTP `403 FORBIDDEN` with error code `SELF_APPROVAL_FORBIDDEN`.

## 4. 3-Way Version Binding & Invalidation
Approvals are not generic booleans. Every submission approval binds:
1. `profileVersion`: Current version tag of the Standardized Candidate Profile.
2. `submissionVersion`: Active submission revision counter.
3. `clientWorkflowVersion`: Target client's published workflow version.

If a recruiter modifies candidate profile data after approval has been granted, the system marks `isInvalidated = true`, sets `invalidationReason = PROFILE_MODIFIED_POST_APPROVAL`, and resets submission status to `CHANGES_REQUESTED`.
