# Report Delivery Security & Authorization Recheck

## Overview
Automated reporting to external clients presents critical data leak risks if access changes between schedule creation and delivery time. HireFlow implements a mandatory **13-point Delivery-Time Authorization Recheck** immediately prior to dispatching any client report.

## The 13-Point Authorization Recheck
Executed by `validateDeliveryAuthorization(scheduleId)` inside `client-report-queue.ts`:

1. **Schedule Active Status**: Verifies that the schedule is currently `ACTIVE` (not `PAUSED` or `ARCHIVED`).
2. **Client Organization Status**: Confirms the client organization is active and not archived (`client.isArchived === false`).
3. **Client NDA / Commercial Agreement**: Confirms no active holds exist on the client's account.
4. **Creator Existence**: Verifies that the internal user who created or last modified the schedule still exists in the system.
5. **Creator Active Status**: Verifies that the schedule creator has not been deactivated or archived (`creator.isArchived === false`).
6. **Creator Role Permissions**: Verifies that the creator currently holds an authorized role (`ADMIN` or `MANAGER`).
7. **Recipient Verification**: Re-checks every recipient email against the current list of verified `ClientContact` records.
8. **Contact Deactivation Check**: Automatically drops any contact who has been deactivated or removed from the client since the schedule was created.
9. **Zero Eligible Recipients Abort**: If no valid active contacts remain, the delivery aborts with status `FAILED_NO_RECIPIENTS` and logs an alert.
10. **Client Job Scope**: Re-queries jobs to ensure every included job belongs exclusively to this `clientId`.
11. **Client Submission Isolation**: Re-queries candidate submissions to ensure only submissions formally approved for client review are exposed.
12. **Confidentiality / Leak Stripping**: Strips internal recruiter notes, fee margins, candidate phone numbers/personal emails, and internal interview scorecards.
13. **Formula Injection Sanitization**: All exported attachments or CSV tables sanitize formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`).

If any check fails, the job immediately halts, marks the delivery as `CANCELLED` or `FAILED`, and logs a high-severity `SECURITY_ALERT` in `AuditLog`.
