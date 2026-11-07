# Custom Report Builder (Frame 37)

## Overview
The Custom Report Builder in HireFlow ATS allows internal users (Recruiters, Managers, Admins) to design, customize, preview, save, and export operational reports across all core recruitment entities.

## Navigation & Access
- **Route**: `/reports/builder`
- **Navigation**: Under Workspace navigation -> Report Builder (`FileSpreadsheet` icon)
- **Role Permissions**:
  - `RECRUITER`: Access to own candidates, assigned jobs, own applications/interviews/submissions/placements.
  - `MANAGER`: Access to team and organization-wide data.
  - `ADMIN`: Unrestricted organization-wide access.
  - `CLIENT` & `CANDIDATE`: Strictly blocked with 403 Forbidden.

## Capabilities & Interface (Frame 37)
1. **Primary Entity Selector**:
   - `CANDIDATES`: Candidate profiles, sourcing source, stage, experience.
   - `JOBS`: Job requisition, status, department, open date, assigned team.
   - `APPLICATIONS`: Candidate applications, stage progress, application date.
   - `INTERVIEWS`: Interview schedules, mode, outcome, round types.
   - `SUBMISSIONS`: Client candidate submissions, feedback status, decision.
   - `CLIENTS`: Client accounts, tier, account manager, active job count.
   - `PLACEMENTS`: Completed placements, start date, guarantee status, payment status.

2. **Linked Data Relations**:
   - `CANDIDATES` -> Applications
   - `JOBS` -> Client, Applications
   - `APPLICATIONS` -> Candidate, Job, Interviews, Submissions
   - `INTERVIEWS` -> Application
   - `SUBMISSIONS` -> Application, Client
   - `CLIENTS` -> Jobs, Submissions, Placements
   - `PLACEMENTS` -> Application, Client

3. **Column Catalog**:
   - Searchable column selector organized by entity and relation.
   - Drag-and-drop / click-to-reorder selected columns.
   - Clear labels, format definitions, and tooltips.

4. **Multi-Filter & Aggregation Bar**:
   - Date range selector (Last 7 Days, Last 30 Days, This Month, Last Quarter, Custom Range).
   - Dynamic filters by Client, Recruiter, and Stage.
   - Group By dimension (e.g. Recruiter, Client, Stage, Status).
   - Multi-column sort (Ascending / Descending).

5. **Live 5-Row Preview**:
   - Exact 5-row bounded live preview table.
   - Live "As-of" timestamp rendered in Indian Standard Time (`Asia/Kolkata`).
   - Total matching records count badge without loading thousands of rows into client memory.

6. **Permission Boundary Banner**:
   - Real-time indicator displaying the effective user scope (e.g., "Filtered to your assigned jobs & candidates" for Recruiters).

7. **Export & Sharing**:
   - Export directly to CSV (with strict CSV formula injection mitigation).
   - Export to Excel (SpreadsheetML XML format).
   - Save report configuration as Private, Team, or Organization view.
