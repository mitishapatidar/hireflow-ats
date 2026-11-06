# HireFlow ATS & Recruitment CRM — Centralized Authorization Engine (Prompt 5)

## 1. Engine Architecture: `can(user, action, resource)`

HireFlow enforces a unified, centralized authorization function located in `packages/shared/src/authorization.ts`:

```typescript
can(user: AuthUser, action: AuthAction, resource: AuthResource): boolean
```

This single engine governs both Fastify API middleware (`requirePermission`) and Next.js server helpers (`requirePermission`, `requireRole`).

## 2. Supported Roles & Hierarchies

1. **ADMIN**:
   - Scope: Complete organization tenant scope.
   - Capabilities: Full access to all candidates, jobs, offers, commercial terms, user administration, organization settings, and audit logs within their tenant.
   - Boundaries: Strictly scoped to `user.organizationId == resource.organizationId`. Never cross-tenant.

2. **MANAGER**:
   - Scope: Delivery team scope + direct reporting tree.
   - Capabilities: View and update all candidates and jobs assigned to team members (`subordinateIds`). Approve or reject submissions and fee terms. Cannot manage agency billing, organizations, or users outside their team.

3. **RECRUITER**:
   - Scope: Owned / assigned candidates, jobs, and submissions.
   - Capabilities: Create candidates, submit candidates to assigned jobs, schedule interviews, view candidate profiles.
   - **Cross-Owner Protection**: Recruiters CANNOT read or modify candidate records owned by another recruiter unless the candidate is unassigned or assigned directly to them.

4. **CLIENT**:
   - Scope: Explicitly authorized jobs via `ClientAccess`.
   - Capabilities: View submitted candidate profiles (anonymized/sanitized), accept or reject client submissions, view interviews and stage progress for authorized jobs.
   - **Strict Data Leaks Prevention**: Client users are HARD-BLOCKED from viewing:
     - Internal recruiter notes (`candidate_notes`).
     - Commercial terms, agency margins, placement fees.
     - Unsubmitted candidates or candidates assigned to jobs outside their authorized set.

5. **CANDIDATE**:
   - Scope: Self-record only (`user.id === candidate.userId`).
   - Capabilities: View their own application status, upcoming interview schedule, offer letters, and manage their applicant profile. Cannot view internal candidate ratings, pipeline stages, or other applicants.

## 3. Fastify Authorization Middleware
- **`authenticate`**: Validates `hireflow_session` cookie from request, resolves user and permissions, attaches `request.user` to Fastify request context.
- **`requireRole(...roles)`**: Asserts authenticated user has one of the specified `UserRole` enums; returns HTTP 403 otherwise.
- **`requirePermission(action, resourceType, resolver)`**: Asserts `can(user, action, resource)` passes. Returns HTTP 403 Forbidden with security event logged in `AuditLog` on denial.

## 4. Next.js Server-Side Helpers
Located in `apps/web/src/lib/auth.ts`:
- **`getCurrentUser()`**: Resolves session from cookie, verifies revocation and expiry in Supabase, returns typed `AuthUser`.
- **`requireAuth()`**: Throws redirect to `/login` if session is absent or invalid.
- **`requireRole(...allowedRoles)`**: Redirects to `/no-permission` if authenticated user role is not in the allowed list.
- **`requirePermission(action, resource)`**: Evaluates `can(...)` server-side, redirecting to `/no-permission` if unauthorized.
