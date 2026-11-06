# Role Permission Matrix & Explicit Grants

## Overview
HireFlow enforces fine-grained, resource-level Role-Based Access Control (RBAC) across five specialized tenant roles: `RECRUITER`, `MANAGER`, `ADMIN`, `CLIENT`, and `CANDIDATE`.

## Role Capability Matrix (Figma Frame 30)

| Capability | Recruiter | Manager | Admin | Client | Candidate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Candidate Records** | Assigned Candidates | Team Scope | Policy Scope (Workspace) | Shared Profiles Only | Own Profile Only |
| **Job Assignment** | Request Allocation | Manage Team Mandates | Configure Organization | No Access | No Access |
| **Approve Job / Send** | No | Yes (Direct Subordinates) | By Grant | No Access | No Access |
| **Commercial Terms & Internal Fees** | By Grant (`recruiterViewInternalFees`) | Team Placements | Full Visibility | Strict Zero Leak | No Access |
| **Team & Security Configuration** | No Access | No Access | Yes | No Access | No Access |
| **Portal Review & Feedback** | No Access | Review Submissions | Configure Workflows | Own Client Only | No Access |
| **Book & Coordinate Interviews** | Coordinate Assigned | Review Team Interviews | Configure All | Own Mandates | Own Available Slots |

## SaaS Security Commandments & Anti-Leak Controls
1. **Commercial Fee Sanitization**: Client portal API routes and candidate views strictly redact internal recruiter commission margins, agency placement fee agreements, and recruiter billing rates.
2. **Internal Candidate Notes**: Notes marked `isInternalOnly: true` are exclusively accessible to internal staff (`RECRUITER`, `MANAGER`, `ADMIN`). They are omitted from Client Portal JSON payloads via Zod serialization DTOs.
3. **Explicit Administrative Grants**:
   - `recruiterViewInternalFees`: When disabled (default), recruiters cannot inspect placement billing terms or agency revenue shares. Admins can toggle this grant in `/admin/team?tab=permissions`, which logs an audit entry to `AuditLog`.
4. **Audit Trail**: Every grant change, role change, and status toggle records actor ID, target entity, timestamp, before/after JSON diff, and IP address.
