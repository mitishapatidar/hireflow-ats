# HireFlow ATS — Candidate Authorization & Data Leak Prevention

## 1. Multi-Tenant Role Isolation Model
Candidate data access is strictly governed by server-side authorization checks in both Fastify REST endpoints (`apps/api/src/routes/candidates.ts`) and Next.js Server Actions (`apps/web/src/actions/candidates.ts`).

### Role Access Matrix

| Role | Candidate Scope | Internal Notes | Salary / Margin | Edit / Handover | Soft Archive |
|---|---|---|---|---|---|
| **ADMIN** | Full Organization | Read & Write | Full Access | Full Access | Full Access |
| **MANAGER** | Managed Teams + Own Candidates | Read & Write | Full Access | Full Access | Full Access |
| **RECRUITER** | Assigned / Owned Candidates Only | Read & Write (Own) | Full Access | Allowed (Assigned) | Allowed (Reason Req.) |
| **CLIENT** | Submitted Candidates Only | **STRICTLY HIDDEN** | **STRICTLY HIDDEN** | Denied | Denied |
| **CANDIDATE**| Own Dossier Only | **STRICTLY HIDDEN** | Own Data Only | Self Profile Only | Denied |

---

## 2. Server-Side Enforcement (Anti-Leak Commandments)

### A. Recruiter Resource Isolation
Recruiters cannot view or query unassigned candidates owned by peer recruiters unless they manage the team or have explicit delegate access.
```ts
if (user.role === UserRole.RECRUITER) {
  whereClause.ownerId = user.id;
}
```
Attempting to fetch another recruiter's candidate via Fastify (`GET /api/candidates/:id`) or Server Action (`getCandidateByIdAction`) yields:
- HTTP Status: `403 Forbidden`
- Error Code: `FORBIDDEN_RESOURCE`
- Response: Access denied. Recruiter cannot view unassigned candidate.

### B. Client Portal Data Leak Prevention
Clients must never inspect internal recruiter margins, confidential agency notes, or raw compensation expectations.
1. **Confidential Notes Sanitization:** Any note flagged `isInternalOnly: true` is strictly filtered out before client transmission:
   ```ts
   if (user.role === UserRole.CLIENT) {
     profile.notes = []; // Completely stripped
   }
   ```
2. **Margin & Salary Sanitization:**
   ```ts
   if (user.role === UserRole.CLIENT) {
     profile.currentSalary = null;
     profile.expectedSalary = null;
   }
   ```
3. **Candidate Self-Access Sanitization:**
   Candidates cannot view internal evaluation notes or recruiter margin annotations.

---

## 3. Handover Security
Candidate ownership reassignments require:
1. Destination recruiter must exist and be an `ACTIVE` member of the same organization.
2. An audit trail record (`AuditLog`) is automatically generated:
   - Action: `CANDIDATE_HANDOVER`
   - Actor: Current user ID
   - Entity: `Candidate`
   - Details: Previous owner and new owner IDs recorded.
