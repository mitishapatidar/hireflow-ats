# HireFlow ATS & Recruitment CRM — Role & Resource Permission Matrix

| Resource / Action | ADMIN | MANAGER | RECRUITER | CLIENT | CANDIDATE | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Candidate Profile** | Full | Team Scope | Assigned Only | Submitted Only | Self Only | Recruiters cannot view other recruiters' candidates. |
| **Internal Candidate Notes** | Full | Full | Assigned Only | ❌ BLOCKED | ❌ BLOCKED | Strictly forbidden to Client and Candidate portals. |
| **Job Records** | Full | Team Scope | Assigned Only | Authorized Only | Public Careers | Client restricted to `authorizedJobIds`. |
| **Client Submissions** | Full | Approve/Reject | Create / View | View / Approve | ❌ BLOCKED | Manager / Client approval required for stages. |
| **Commercial Terms & Margin**| Full | View/Approve | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Financial terms restricted to Manager & Admin. |
| **Offers & Placements** | Full | Approve | Create Assigned | ❌ Restricted | Self Offer | Client sees placement status only, not margins. |
| **Interviews** | Full | Team Scope | Assigned Only | Scheduled Only | Self Only | Client sees confirmed candidate slots only. |
| **User Administration** | Full | Team Hierarchy | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Only Admin can create users and invite members. |
| **Audit Logs** | Full | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Audit trail is visible exclusively to Admin. |
| **Agency Organization Settings** | Full | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Master agency configuration. |

### Legend:
- **Full**: Full CRUD within tenant boundaries.
- **Team Scope**: Access to records owned by direct or indirect reports.
- **Assigned Only**: Access only to records explicitly assigned to this user (`ownerId === user.id`).
- **Authorized Only**: Access governed strictly by `ClientAccess.authorizedJobIds`.
- **Self Only**: Access restricted to resources where `userId === user.id`.
- **❌ BLOCKED**: Access denied with HTTP 403 / Redirect to `/no-permission`.
