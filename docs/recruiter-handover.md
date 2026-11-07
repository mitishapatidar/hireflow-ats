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

## 3. Atomic Execution & Transactional Safety
When a handover request is approved, all entity updates execute inside an atomic database transaction (`prisma.$transaction`):
1. **Source & Target Validation**: Verifies both users belong to the tenant organization and target recruiter is active with required `ClientAccess`.
2. **Candidate Update**: Updates `Candidate.ownerId` for all selected candidate IDs.
3. **Job Reassignment**: Updates `Job.ownerId` and inserts active `JobAssignment` rows for the new owner.
4. **Task Reassignment**: Updates `Task.assignedToId` for open tasks.
5. **Ownership History Recording**: Inserts an immutable `OwnershipHistory` record for every individual reassigned resource.
6. **Audit & Notifications**: Logs the operation in `AuditLog` and triggers notifications to source recruiter, destination recruiter, and managing directors.
