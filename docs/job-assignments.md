# Recruiter Job Assignments & Reassignment Requests

## Overview
Requisitions in HireFlow can have a primary recruiter owner as well as multiple actively assigned recruiters working on candidate sourcing and pipeline advancement.

## Assignment Mechanics
- **Ownership**: `Job.ownerId` specifies the lead recruiter responsible for delivering on the mandate.
- **Assignments**: Represented by the `JobAssignment` model:
  - `jobId`: Linked job requisition.
  - `recruiterId`: Assigned recruiter.
  - `assignedById`: Manager or Admin who assigned the recruiter.
  - `status`: `ACTIVE` or `INACTIVE`.
  - Timestamped and indexed on `[jobId, recruiterId]`.
- **Permissions**:
  - Only Managers and Admins can assign or unassign recruiters directly.
  - Recruiters can view their assignments and owned jobs.

## Reassignment Request Workflow
When a recruiter experiences capacity constraints, domain mismatch, or leave of absence, they can request a requisition handover:
1. Recruiter initiates request via `POST /api/jobs/:id/reassignment-requests` or the UI modal.
2. Specifies an optional target recruiter and a mandatory justification (minimum 5 characters).
3. A `JobReassignmentRequest` record is created in `PENDING` status.
4. Managers and Admins review the request:
   - **Approve**: Automatically updates `Job.ownerId` and upserts `JobAssignment` for the target recruiter, setting request status to `APPROVED`.
   - **Reject**: Leaves the current assignment untouched and marks request status as `REJECTED` with review notes.
5. All actions are logged to `AuditLog`.
