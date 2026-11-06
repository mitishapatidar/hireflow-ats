# Submission Approval Engine & Review Drawer

## 1. Workflow Lifecycle
Candidate submissions progress through a formal, governed lifecycle before reaching external clients:
1. **Creation:** Recruiter generates submission record (`PENDING_MANAGER_APPROVAL`).
2. **Review:** Manager opens the side drawer in `/approvals`.
3. **Automated Compliance Check:** Server evaluates candidate data against the client's published `SubmissionRule`.
4. **Decision:**
   - **Approve:** Submission transitions to `APPROVED_BY_MANAGER` or `SENT_TO_CLIENT`.
   - **Request Changes:** Recruiter must remediate flagged issues; status transitions to `CHANGES_REQUESTED`.
   - **Reject:** Submission transitions to `REJECTED_BY_MANAGER` with audit explanation.

## 2. Review Drawer Capabilities
The slide-out drawer provides comprehensive review without context switching:
- **Client Submission Rule Checklist:**
  - Complete Standard Candidate Profile.
  - Resume / CV Document Attached.
  - Expected Salary Populated.
  - Notice Period Populated.
  - Candidate Representation Consent Recorded.
  - Portfolio URL (if mandated by client).
- **Client-Facing Profile Preview:**
  - High-fidelity preview of exactly what the client will receive.
  - Redaction of private phone numbers, emails, and internal recruiter notes.
  - Anonymized representation according to client workflow format.
- **Audit History:** Previous review cycles, manager feedback, and rejection reasons.

## 3. Client Send Protection
The `/api/submissions/:id/send` endpoint performs strict pre-flight checks:
- Verifies approval decision is `APPROVED`.
- Confirms approval is non-invalidated (`isInvalidated === false`).
- Validates version match: `submission.version === approval.submissionVersion`.
- If a mismatch is detected, HTTP `409 CONFLICT` is returned, preventing transmission of stale or unapproved candidate profiles.
