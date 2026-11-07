# HireFlow ATS & Recruitment CRM — Role & Resource Permission Matrix

| Resource / Action | ADMIN | MANAGER | RECRUITER | CLIENT | CANDIDATE | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Candidate Profile** | Full | Team Scope | Assigned Only | Submitted Only | Self Only | Recruiters cannot view other recruiters' candidates. |
| **Internal Candidate Notes** | Full | Full | Assigned Only | ❌ BLOCKED | ❌ BLOCKED | Strictly forbidden to Client and Candidate portals. |
| **Job Records** | Full | Team Scope | Assigned Only | Authorized Only | Public Careers | Client restricted to `authorizedJobIds`. |
| **Client Submissions** | Full | Approve/Reject | Create / View | View / Approve | ❌ BLOCKED | Manager / Client approval required for stages. |
| **Commercial Terms & Margin**| Full | View/Approve | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Financial terms restricted to Manager & Admin. |
| **Offers & Placements** | Full | Full / Confirm | Create / Release | ❌ Masked | Self Offer | Client & Candidate responses mask agency margins and fees. |
| **Global Command Search (Ctrl+K)** | Full | Full | Internal Scope | Client Scoped | ❌ BLOCKED | Zero data leak of unsubmitted candidates or peer client data. |
| **Recruitment Analytics & MIS** | Full | Full | Own Activity | ❌ BLOCKED | ❌ BLOCKED | IST boundary calculations. External roles blocked. |
| **Mobile Recruiter Today (/mobile/today)** | Full | Full | Own Agenda | ❌ BLOCKED | ❌ BLOCKED | Touch-optimised daily agenda, call log, quick notes. |
| **Mobile Pipeline Switcher** | Full | Full | Assigned Jobs | ❌ BLOCKED | ❌ BLOCKED | Horizontal stage pills with swipeable candidate cards. |
| **Custom Report Builder** | Full | Full | Non-sensitive | ❌ BLOCKED | ❌ BLOCKED | Cross-entity datasets, 5-row live preview, CSV/ExcelML. |
| **Scheduled Client Reports** | Full | Full | ❌ BLOCKED | Recipient | ❌ BLOCKED | 13-point authorization check, automated delivery. |
| **Interviews & Video Meetings** | Full | Team Scope | Assigned Only | Scheduled Only | Self Only | Automated Meet/Zoom/Teams link creation upon persistence. |
| **Candidate Self-Scheduling** | Full | Full | Manage Slots | ❌ BLOCKED | Self Book | Secure expiring token links, Google/Outlook sync. |
| **User Administration** | Full | Team Hierarchy | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Only Admin can create users and invite members. |
| **Audit Logs** | Full | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Audit trail is visible exclusively to Admin. |
| **Agency Organization Settings**| Full | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Master agency configuration. |

### Legend:
- **Full**: Full CRUD within tenant boundaries.
- **Team Scope**: Access to records owned by direct or indirect reports.
- **Assigned Only**: Access only to records explicitly assigned to this user (`ownerId === user.id`).
- **Authorized Only**: Access governed strictly by `ClientAccess.authorizedJobIds`.
- **Self Only**: Access restricted to resources where `userId === user.id`.
- **Masked**: Records returned with sensitive fee, margin, and internal note fields scrubbed.
- **❌ BLOCKED**: Access denied with HTTP 403 / Redirect to `/no-permission`.
