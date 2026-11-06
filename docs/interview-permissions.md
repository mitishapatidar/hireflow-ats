# Interview Authorization & Role Permissions

## 1. Five-Role Access Matrix

| Capability | Admin | Manager | Recruiter | Client | Candidate |
|---|---|---|---|---|---|
| View Interviews Calendar | ✅ Org-wide | ✅ Team | ✅ Assigned | ❌ 403 Forbidden | ❌ 403 Forbidden |
| Schedule Interviews | ✅ Yes | ✅ Yes | ✅ Assigned Jobs | ❌ 403 Forbidden | ❌ 403 Forbidden |
| Check Panel Availability | ✅ Yes | ✅ Yes | ✅ Yes | ❌ 403 Forbidden | ❌ 403 Forbidden |
| Reschedule / Cancel | ✅ Yes | ✅ Yes | ✅ Assigned Jobs | ❌ 403 Forbidden | ❌ 403 Forbidden |
| Mark Outcome (Complete / No-show) | ✅ Yes | ✅ Yes | ✅ Assigned Jobs | ❌ 403 Forbidden | ❌ 403 Forbidden |
| Submit Panel Feedback | ✅ Yes | ✅ Yes | ✅ If Assigned Panel | ❌ 403 Forbidden | ❌ 403 Forbidden |
| View Internal Feedback | ✅ Yes | ✅ Yes | ✅ Assigned Jobs | ❌ Stripped | ❌ Stripped |
| Create Follow-up Task | ✅ Yes | ✅ Yes | ✅ Yes | ❌ 403 Forbidden | ❌ 403 Forbidden |

## 2. Server-Side Enforcement
All operations enforce authentication via HTTP-only session cookies and verify tenant/organization boundary. Client-supplied actor IDs and organization scopes are rejected in favor of verified session identities.
