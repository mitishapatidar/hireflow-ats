# HireFlow ATS — Recruiter Handover Workflow

## Overview
The Recruiter Handover module (Figma Frame 41) allows seamless, auditable transfer of operational portfolios when recruiters change roles, go on leave, or exit the agency.

---

## 1. Multi-Entity Handover Architecture
Portfolio transfers are decoupled across three resource categories:
1. **Candidates (`Candidate.ownerId`)**:
   - Transferring candidate ownership preserves historical interview and application notes while directing future communications to the new owner.
   - Handing over candidates does **not** silently reassign jobs or clients.
2. **Active Jobs (`Job.ownerId` & `JobAssignment`)**:
   - Reassigns job ownership and creates an active `JobAssignment` record.
   - Candidate pipelines within the job remain intact.
3. **Open Tasks (`Task.assignedToId`)**:
   - Transfers pending, in-progress, or overdue tasks.
   - **Completed tasks (`TaskStatus.COMPLETED`) are strictly excluded** from handover to preserve historical performance metrics.

---

## 2. Handover Request Lifecycle
A handover request transitions through explicit states:
- `PENDING`: Created by a recruiter or manager, awaiting review or execution.
- `APPROVED` / `COMPLETED`: Atomic transaction executes resource reassignments.
- `REJECTED`: Rejected by an authorized manager or administrator.
- `CANCELLED`: Withdrawn by the initiating requester prior to execution.

---

## 3. Concurrency Protection & Transactional Safety
When a handover request is approved, execution is guarded by strict concurrency controls and an atomic database transaction (`prisma.$transaction`):

1. **Optimistic Concurrency Lock**:
   - The transaction attempts to lock the request in a single atomic step:
     ```typescript
     const lockResult = await tx.handoverRequest.updateMany({
       where: { id: reqId, organizationId: user.organizationId, status: HandoverStatus.PENDING },
       data: { status: HandoverStatus.APPROVED }
     });
     if (lockResult.count === 0) {
       throw new Error("Handover request is no longer pending or already processed");
     }
     ```
   - This prevents race conditions or double-execution if concurrent approval requests arrive.

2. **In-Transaction Entity Re-Validation**:
   - Re-verifies that the target recruiter remains active and belongs to the organization.
   - Re-queries candidates to ensure they are still owned by `fromUserId`. Any candidate transferred elsewhere in the interim is skipped.
   - Re-queries jobs to ensure `fromUserId` is indeed assigned or owns the job.
   - Excludes tasks with `status === TaskStatus.COMPLETED`.

3. **Verified-Only Ownership History**:
   - `OwnershipHistory` audit rows are generated **only for resources that were actually verified and reassigned**. The count of created history rows strictly matches the number of modified resources.

4. **Audit & Notifications**:
   - Logs the operation in `AuditLog` and triggers notifications to source recruiter, destination recruiter, and managing directors.
