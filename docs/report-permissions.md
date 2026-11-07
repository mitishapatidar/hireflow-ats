# Report Permissions & Security Boundaries

## Overview
HireFlow enforces strict role-based data segmentation and field-level permissions for all reporting capabilities.

## Role Permission Matrix

| Role | Access Level | Row Scoping | Forbidden Fields | Available Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Full ATS | Organization-wide | Secrets, Passwords | Create, Edit, Share, Export CSV/Excel, Schedule Client Reports |
| **Manager** | Full Team | Team & Organization | Secrets, Passwords | Create, Edit, Share, Export CSV/Excel, Schedule Client Reports |
| **Recruiter** | Own Work | Assigned Candidates & Jobs | Margins, Fee Percentages, Billing Secrets | Create, Edit Private Views, Export Filtered CSV/Excel |
| **Client** | Client Portal | Client-Locked (`clientId`) | Recruiter notes, Internal fees, Other clients | View assigned Scheduled Reports only |
| **Candidate**| Candidate Portal | Own Applications | All internal recruitment data | None (No Report Access) |

## Zero-Leak Sharing Security
When a report view is shared (Private -> Team or Organization):
- The report definition only persists the *query configuration* (entity, columns, filters, sort).
- It **never persists raw query results or cached records**.
- When another user opens a shared view, the query engine re-executes with the **viewer's** role and row-level boundaries.
- A recruiter opening an Admin's shared report view will only see their own assigned candidates and jobs, with unauthorized fee/margin columns blanked or suppressed.

## Audit Logging
- Every report preview, view save, export, and client schedule execution creates an immutable record in `AuditLog` with action tags:
  - `REPORT_PREVIEW`
  - `REPORT_VIEW_CREATE`
  - `REPORT_EXPORT_CSV`
  - `REPORT_EXPORT_EXCEL`
  - `CLIENT_REPORT_SCHEDULE_CREATE`
  - `CLIENT_REPORT_DELIVERY_DISPATCH`
