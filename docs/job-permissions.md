# Job Permissions & Role-Based Access Control (RBAC)

## Overview
Job requisitions enforce strict multi-tenant boundaries and role-based permissions across internal staff, client users, and candidates.

## RBAC Matrix for Jobs

| Action / Capability | Admin | Manager | Recruiter | Client Portal User | Candidate |
|---|---|---|---|---|---|
| View All Org Jobs | Yes | Yes | Yes (Read-only) | No | No |
| View Authorized Jobs | Yes | Yes | Yes | Yes (assigned `authorizedJobIds`) | No |
| Create Job Mandate | Yes | Yes | Yes | No (403) | No (403) |
| Edit Configuration | Yes | Yes | Yes (if owner or assigned) | No (403) | No (403) |
| Pause / Resume Job | Yes | Yes | Yes (if owner or assigned) | No (403) | No (403) |
| Close Job | Yes | Yes | Yes (if owner or assigned) | No (403) | No (403) |
| Reopen Job | Yes | Yes | Yes (if owner or assigned) | No (403) | No (403) |
| Manage Interview Rounds | Yes | Yes | Yes (if owner or assigned) | No (403) | No (403) |
| Assign Recruiter | Yes | Yes | No (403) | No (403) | No (403) |
| Unassign Recruiter | Yes | Yes | No (403) | No (403) | No (403) |
| Request Reassignment | Yes | Yes | Yes | No (403) | No (403) |
| Approve Reassignment | Yes | Yes | No (403) | No (403) | No (403) |
| Submit Candidate Application | Yes | Yes | Yes | Yes (if job ACTIVE) | Yes (if job ACTIVE) |

## Data Leak Prevention (Anti-Leak Serializer)
The `serializeJob` utility sanitizes job payloads before sending responses:
1. Strips internal recruiter margin notes and commercial fee terms.
2. Hides internal recruiter email addresses from client and candidate views.
3. Completely omits `assignments`, `statusHistories`, and `reassignmentRequests` from external roles (Client and Candidate).
