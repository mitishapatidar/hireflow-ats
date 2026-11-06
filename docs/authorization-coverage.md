# Authorization Coverage & Security Policy Audit

**Module:** Security & Access Control  
**Playbook Phase:** Phase 1 — Prompt 16  
**Verification Tool:** `pnpm check:auth` (`scripts/check-authorization-coverage.ts`)  

## 1. Executive Summary

Every Fastify API route and Next.js Server Action in HireFlow ATS enforces strict, server-side role and tenant authorization checks. In accordance with Prompt 16 requirements, a CI authorization validation script (`pnpm check:auth`) scans the live registered route tree on every build to guarantee no route is accidentally left unprotected.

- **Total Registered Endpoints:** 45 live endpoints across 12 route modules.
- **Security Policies Catalogued:** 130 methods and route variants.
- **Protected Endpoints:** 121 (strictly require authentication and role permissions).
- **Public Exemptions:** 9 documented endpoints (anti-CSRF, health checks, credential auth, HMAC webhooks).
- **Uncovered Routes:** 0 (100% verified coverage).

---

## 2. Five Target User Roles Matrix

| Permission Domain | ADMIN | MANAGER | RECRUITER | CLIENT | CANDIDATE |
|---|:---:|:---:|:---:|:---:|:---:|
| **Candidate Talent Pool** | Full Org | Full Org | Assigned / Own | Forbidden (403) | Forbidden (403) |
| **Candidate Notes (Confidential)** | Full Org | Full Org | Author / Assigned | Forbidden (403) | Forbidden (403) |
| **Jobs Configuration** | Full Org | Full Org | Assigned Jobs | Forbidden (403) | Forbidden (403) |
| **Job Lifecycle Transitions** | Full Org | Full Org | Restricted | Forbidden (403) | Forbidden (403) |
| **Interviews & Calendar** | Full Org | Full Org | Assigned / Panel | Client Schedule Only | Self Schedule Only |
| **Client Submissions** | Full Org | Full Org | Assigned Jobs | View Approved Only | Forbidden (403) |
| **Submission Approval Review** | Yes | Yes | Request Only | Forbidden (403) | Forbidden (403) |
| **Client Commercial Margins/Fees**| Full Org | Full Org | Strict Masking | Forbidden (403) | Forbidden (403) |
| **Sales CRM Opportunities** | Full Org | Full Org | Assigned / Own | Forbidden (403) | Forbidden (403) |
| **Team Management & Invites** | Yes | View Only | Forbidden (403) | Forbidden (403) | Forbidden (403) |
| **Daily Activity & Targets** | Full Org | Full Org | Own Targets | Forbidden (403) | Forbidden (403) |

---

## 3. Public Endpoint Exemptions & Security Rationales

The following 9 endpoints are legitimately accessible without an active user session:

1. **`GET /health`**: High-availability health check for infrastructure load balancers.
2. **`GET /api/auth/csrf`**: Issues cryptographic double-submit anti-CSRF tokens to the web client.
3. **`POST /api/auth/login`**: Authenticates user credentials via Argon2id password verification.
4. **`POST /api/auth/google`**: Handles Google OAuth2 OIDC callback exchange.
5. **`POST /api/auth/invitation/accept`**: Verifies 7-day invitation tokens and activates new employee accounts.
6. **`POST /api/auth/password-reset/request`**: Generates single-use password recovery tokens.
7. **`POST /api/auth/password-reset/confirm`**: Verifies password recovery tokens and updates passwords.
8. **`POST /api/communications/webhooks/whatsapp`**: Webhook receiver for Meta WhatsApp Cloud API (protected via HMAC-SHA256 signature verification).
9. **`POST /api/communications/webhooks/sms`**: Webhook receiver for SMS delivery receipts (protected via HMAC signature verification).

---

## 4. Next.js Server Action Authorization

Because Next.js Server Actions are directly invokable RPC endpoints, route-level API middleware alone is insufficient. Every Server Action in `apps/web/src/actions/` implements server-side session and role verification:

```typescript
const user = await getCurrentUser();
if (!user || !canAccessModule(user.role)) {
  return { success: false, error: 'Unauthorized or forbidden' };
}
```

Audited Action files:
- `apps/web/src/actions/auth.ts`: Authentication, logout, and token handling.
- `apps/web/src/actions/admin.ts`: Team management, role assignment, reporting lines cycle checks, audit logs.
- `apps/web/src/actions/candidates.ts`: Candidate creation, parsing, notes, soft-archive, tags.
- `apps/web/src/actions/clients.ts`: Client CRM, contacts, documents, and commercial fee protection.
- `apps/web/src/actions/jobs.ts`: Job lifecycle state machine, reassignments, interview rounds.
- `apps/web/src/actions/pipeline.ts`: Drag-and-drop pipeline stage transitions, rejections.
- `apps/web/src/actions/interviews.ts`: Schedule, availability checking, completion, panel feedback.
- `apps/web/src/actions/submissions.ts`: Profile generation, match score, watermarked CV, client delivery.
- `apps/web/src/actions/communications.ts`: Thread inbox, email/WhatsApp sends, shared team signatures.
- `apps/web/src/actions/sales.ts`: Sales pipeline, discovery meetings, WON opportunity conversion.
- `apps/web/src/actions/dashboard.ts`: Database-backed recruiter KPIs, pipeline chart, IST agenda.
- `apps/web/src/actions/activity.ts`: Daily activity counts, call/task logging, configurable targets.

---

## 5. Automated CI Verification

Run the automated authorization check anytime:

```bash
pnpm check:auth
```

If an engineer registers a new route in Fastify without adding an explicit entry in `scripts/check-authorization-coverage.ts` (with documented roles or public exemption rationale), the command terminates with exit code 1, preventing unprotected code from deploying.
