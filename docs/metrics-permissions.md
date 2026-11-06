# Metrics & Sales CRM Authorization Matrix

**Module:** Authorization & Security  
**Playbook Phase:** Phase 1 — Prompt 15  

## 1. Role-Based Access Control (RBAC)

Access to Sales CRM, Recruiter Dashboard, and Daily Activity tracking is strictly restricted to internal agency team members:

| Resource / Action | ADMIN | MANAGER | RECRUITER | CLIENT | CANDIDATE |
|---|:---:|:---:|:---:|:---:|:---:|
| **Recruiter Dashboard** (`/dashboard`) | Full Org | Full Org | Assigned / Own | Forbidden (403) | Forbidden (403) |
| **Sales CRM Pipeline** (`/sales`) | Full Org | Full Org | Assigned / Own | Forbidden (403) | Forbidden (403) |
| **Create / Edit Opportunity** | Yes | Yes | Yes | Forbidden (403) | Forbidden (403) |
| **Convert Opportunity to Job** | Yes | Yes | Yes | Forbidden (403) | Forbidden (403) |
| **Schedule Client Meeting** | Yes | Yes | Yes | Forbidden (403) | Forbidden (403) |
| **Record Meeting Outcome** | Yes | Yes | Yes | Forbidden (403) | Forbidden (403) |
| **Daily Activity & Targets** (`/activity`) | Full Org | Full Org | Personal | Forbidden (403) | Forbidden (403) |
| **Update Personal Targets** | Yes | Yes | Yes | Forbidden (403) | Forbidden (403) |

## 2. Server-Side Enforcement

Every Fastify endpoint (`/api/sales/*`, `/api/dashboard/*`, `/api/activity/*`) and Next.js Server Action executes server-side validation:

```typescript
function verifyInternalStaff(user: any) {
  if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    const err: any = new Error('Access denied: Internal staff only');
    err.statusCode = 403;
    throw err;
  }
}
```

External portal roles (`CLIENT` and `CANDIDATE`) receive immediate HTTP 403 Forbidden responses.
