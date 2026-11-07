# HireFlow ATS & Recruitment CRM — Per-Client Custom Pipeline Stages

## 1. Overview
HireFlow allows recruitment agencies to tailor pipeline stages per client while maintaining global reporting consistency, audit history integrity, and candidate tracking.

**Figma Reference**: Frame 32 — Client Custom Pipeline Stages & Submission Rules.

---

## 2. Protected Stages

Certain terminal and operational stages are foundational to agency billing and placement records.
- **Protected Stage Rule**: Any stage mapped to `stageType: 'HIRED'` (e.g. `Placed`, `Joined`) cannot be deleted or archived.
- **Visual Indicator**: The UI displays a `Protected` badge (`ShieldCheck` icon, `#5B49D6`) next to the stage name.
- **Server Enforcement**: Both `updateWorkflowDraftAction` and `publishWorkflowAction` verify `isProtectedStage(stage)` server-side, returning an error if an attempt is made to remove a protected stage.

---

## 3. Candidate In-Use Detection & Safe Stage Remapping

1. **In-Use Detection**:
   - The workflow editor calculates the active candidate count in each stage across all jobs belonging to the client (`In Use: N candidates`).
2. **Remapping Dialog**:
   - When an administrator or manager attempts to remove an active stage with in-use candidates, a remapping dialog is displayed.
   - The user must select a target replacement stage (e.g., move candidates from `Technical Interview` to `Screening`).
3. **Transactional Migration & Audit Integrity**:
   - The migration reassigns all active applications from the removed stage to the target stage inside a database transaction (`prisma.$transaction`).
   - For every migrated application, an `ApplicationStageHistory` record is generated to preserve the full audit trail:
     - `fromStageId`: The original stage ID.
     - `toStageId`: The target remapped stage ID.
     - `notes`: `"Stage remapped during Client Workflow vN publication"`.

---

## 4. Dynamic Kanban Board Integration

- **Route**: `/jobs/:id/pipeline`
- **Dynamic Resolution**:
  - The Kanban board queries the published `ClientWorkflow` associated with the job's client (`clientId`).
  - If a published client workflow exists, its custom stages are resolved in order (`order: 'asc'`).
  - If no client workflow exists, it falls back gracefully to the organization default `Stage` progression.
  - Column counts and drag-and-drop operations dynamically match the client-specific stages.
