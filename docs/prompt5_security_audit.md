# HireFlow ATS — Prompt 5 Final Security & Implementation Audit

**Audit Timestamp:** 2026-11-06T13:10:00+05:30  
**Repository:** `mitishapatidar/hireflow-ats` (Branch: `main`)  
**Commit:** `0a20011`  
**Database:** Supabase PostgreSQL (`aws-0-ap-southeast-1.pooler.supabase.com:5432`)

---

## 1. Executive Summary & Audit Scorecard

| Audit Dimension | Status | Notes & Verification Summary |
|---|---|---|
| **Audit 1 — Google OIDC** | **PASS (Mock) / NOT VERIFIED (Prod)** | Authorization code flow, state/nonce checks, verified email requirement, invitation-only matching, and domain allowlist are strictly enforced. Real Google production token exchange is intentionally gated (`501 GOOGLE_CREDENTIALS_PENDING`) awaiting real client credentials. |
| **Audit 2 — Session Security** | **PASS** | 256-bit cryptographically secure tokens (`crypto.randomBytes(32)`), SHA-256 token hashes stored in database (raw tokens never stored), session rotation on login/password reset, strict `HttpOnly`, `SameSite=lax`, `secure` cookies. Zero tokens in `localStorage` or `sessionStorage`. |
| **Audit 3 — CSRF & Rate Limiting** | **PASS (Actions/DB) / PARTIAL (API CSRF)** | Next.js Server Actions have native CSRF origin protection. State parameter defends OAuth flow. Database-backed rate limiting (`LoginAttempt` table: 5 attempts/min with 60s lockout) is multi-instance shared. Fastify REST endpoints lack `@fastify/csrf-protection` (relying on CORS and JSON Content-Type). |
| **Audit 4 — Authorization (5 Roles)** | **PASS** | Centralized `can(user, action, resource)` engine verified across RECRUITER, MANAGER, ADMIN, CLIENT, CANDIDATE. Resource-level checks prevent cross-recruiter candidate tampering (HTTP 403 verified). Client cannot access candidate notes or margins. Roles resolved strictly from database session. |
| **Audit 5 — Supabase Database Security** | **FAIL (RLS Exposure Risk)** | All 56 tables currently have RLS disabled (`rowsecurity = false`). Default Supabase privileges grant `anon` and `authenticated` access to public tables. Server-side Prisma handles security in application layer, but direct Supabase PostgREST access is unshielded. |
| **Audit 6 — Prisma Migrations** | **FAIL (Unresolved Baseline)** | Migration files exist, but `_prisma_migrations` table does not exist in Supabase (schema was synchronized via `prisma db push`). `prisma migrate status` reports both migrations unapplied. |
| **Audit 7 — Regression Tests** | **PASS** | Typecheck (0 errors), Vitest (58/58 passed), Playwright (16/16 passed), Web build (33/33 static/dynamic routes passed). Zero records lost or altered. |

---

## 2. Detailed Findings by Audit Category

### Audit 1 — Google OIDC Flow
- **Code Verified:** [`apps/api/src/routes/auth.ts`](file:///c:/HireFlow%20ATS%20project/apps/api/src/routes/auth.ts#L240-L383)
- **State Validation:** Enforces minimum 8-character entropy; returns HTTP 400 and logs `OAUTH_STATE_INVALID` on tampering.
- **Verified Email Requirement:** Rejects unverified Google accounts with HTTP 403 `OAUTH_EMAIL_UNVERIFIED`.
- **Invitation-Only Model:** Checks `prisma.user.findUnique({ where: { email } })`. Uninvited users receive HTTP 403 `INVITATION_REQUIRED`. No automatic public registration exists.
- **Domain Allowlist:** Validates email against organization settings allowlist (`hireflow.io`, `aurevacapital.com`, `acmetech.com`).
- **Production Credentials Status:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not yet populated in production `.env`. The endpoint cleanly returns HTTP 501 `GOOGLE_CREDENTIALS_PENDING` when a non-mock code is received.

### Audit 2 — Session Security
- **Code Verified:** [`packages/shared/src/auth.ts`](file:///c:/HireFlow%20ATS%20project/packages/shared/src/auth.ts), [`apps/web/src/actions/auth.ts`](file:///c:/HireFlow%20ATS%20project/apps/web/src/actions/auth.ts)
- **Token Generation:** `generateSecureToken()` generates 64 hex characters (32 bytes random entropy).
- **Token Storage:** Only `hashToken(rawToken)` (SHA-256) is stored in the Supabase `Session` table.
- **Cookie Security:**
  - Name: `hireflow_session`
  - `httpOnly: true` (inaccessible to JavaScript / XSS)
  - `sameSite: 'lax'`
  - `secure: process.env.NODE_ENV === 'production'`
  - `path: '/'`
  - `maxAge: 7 days` (or 30 days if `rememberMe: true`)
- **Session Revocation:**
  - Logout sets `revokedAt = now()` in the database and clears the cookie (`maxAge: 0`).
  - Password reset automatically invalidates all active sessions for that user (`prisma.session.updateMany({ where: { userId, revokedAt: null } })`).
- **Storage Audit:** Zero client-side storage of authentication tokens in `localStorage` or `sessionStorage`.

### Audit 3 — CSRF & Rate Limiting
- **Next.js Server Actions:** Protected by Next.js App Router built-in origin/referer checks against CSRF.
- **Fastify API Endpoints:** CORS configured to `APP_BASE_URL` (`http://localhost:3000`). JSON-only payloads mitigate simple cross-site form submissions. However, dedicated double-submit cookie or `@fastify/csrf-protection` is not yet installed for pure API clients.
- **Rate Limiting Implementation:**
  - Handled via Supabase PostgreSQL `LoginAttempt` table.
  - Queries failures within the trailing 60 seconds (`failures < 5`).
  - Because it uses PostgreSQL, the rate limiter is **shared across multi-instance deployments** (not in-memory).
  - Tested and verified: 5th failed attempt triggers HTTP 429 `TOO_MANY_ATTEMPTS`.

### Audit 4 — Role-Based & Resource-Level Authorization
- **Code Verified:** [`packages/shared/src/authorization.ts`](file:///c:/HireFlow%20ATS%20project/packages/shared/src/authorization.ts), [`apps/api/src/plugins/auth.ts`](file:///c:/HireFlow%20ATS%20project/apps/api/src/plugins/auth.ts), [`apps/api/src/routes/candidates.ts`](file:///c:/HireFlow%20ATS%20project/apps/api/src/routes/candidates.ts)
- **Recruiter Isolation:**
  - Tested: Recruiter cannot read or update another recruiter's candidate (`GET /api/candidates/:id` returns HTTP 403 `FORBIDDEN_RESOURCE`).
  - Recruiter cannot self-approve submissions.
  - Recruiter cannot access client commercial margins.
- **Manager Scope:**
  - Manager access is scoped to team members and subordinates. Cannot view foreign organization records.
- **Client Shielding:**
  - Client can ONLY view candidates marked `isSubmittedToClient: true`.
  - Client is unconditionally blocked from `candidate_notes` and `commercial_terms`.
- **Candidate Isolation:**
  - Candidate is restricted to their own `candidateProfileId` and applications.
- **Identity Trust:**
  - Role is **never** accepted from client headers or request bodies.
  - In production and authenticated requests, user and role are resolved exclusively by database lookup on `Session.tokenHash -> User.role`.

### Audit 5 — Supabase Database Security
- **Empirical Inspection via Direct Query:**
  - Total tables: **56** (54 baseline + `PasswordResetToken` + `LoginAttempt`).
  - Tables with RLS enabled: **0 / 56** (`rowsecurity = false`).
  - Grants: Supabase roles `anon` and `authenticated` hold default `SELECT`, `INSERT`, `UPDATE`, `DELETE` grants on public tables.
  - Application Impact: Prisma connects using the privileged `postgres` superuser role, which bypasses RLS by design. All security enforcement currently occurs at the Next.js / Fastify application layer.
  - **Exposure Risk:** If an attacker discovers the Supabase Project URL and Anon API key, they could directly query the Supabase PostgREST API (`https://<project-ref>.supabase.co/rest/v1/`) and bypass application code.

### Audit 6 — Prisma Migrations & Baseline
- **Migration Directory:**
  - `20261106000000_init_hireflow_schema/migration.sql`
  - `20261106010000_add_auth_reset_and_oauth/migration.sql`
- **Database Status:**
  - `_prisma_migrations` table **does not exist** in the Supabase public schema.
  - `prisma migrate status` reports:
    ```
    2 migrations found in prisma/migrations
    Following migrations have not yet been applied:
    20261106000000_init_hireflow_schema
    20261106010000_add_auth_reset_and_oauth
    ```
  - The live schema in Supabase has already been created/altered using `prisma db push` / direct DDL.
  - **Resolution Plan:** In a production pipeline, baseline resolution (`prisma migrate resolve --applied ...`) should be performed during a planned maintenance window without resetting or dropping existing tables.

---

## 3. Database State & Record Preservation Confirmation

Direct live query against Supabase PostgreSQL confirmed:

```json
{
  "organizations": 1,
  "users": 17,
  "clients": 4,
  "candidates": 60,
  "jobs": 8,
  "applications": 2,
  "interviews": 1,
  "submissions": 1,
  "placements": 1,
  "sessions": 20,
  "passwordResetTokens": 17,
  "loginAttempts": 64
}
```

- **Confirmation:** All 60 seeded candidates, 8 jobs, 4 clients, 17 users, and core workflows remain **100% intact**. Zero records were deleted, reset, or truncated.

---

## 4. Regression Test Execution Summary

| Test Suite | Commands Executed | Result | Details |
|---|---|---|---|
| **TypeScript Typecheck** | `pnpm -r typecheck` | **PASS (0 errors)** | Checked `@hireflow/ui`, `@hireflow/shared`, `@hireflow/db`, `@hireflow/api`, `@hireflow/web`. |
| **Unit & Integration Tests** | `pnpm -r test` | **PASS (58/58 passed)** | - `@hireflow/shared`: 41 tests passed<br>- `@hireflow/ui`: 2 tests passed<br>- `@hireflow/api`: 15 tests passed |
| **End-to-End Tests** | `pnpm exec playwright test` | **PASS (16/16 passed)** | Tested login UI (Figma Frame 15), password policies, error states, navigation shells, and route permissions. |
| **Production Web Build** | `pnpm --filter @hireflow/web build` | **PASS (33/33 routes)** | Compiled cleanly with `@node-rs/argon2` externalized. |

---

## 5. Production Readiness Blockers

Before declaring full production readiness:

1. **Google OIDC Credentials:** Google Cloud Console OAuth 2.0 Client ID and Secret must be created and added to environment variables.
2. **Supabase PostgREST Shielding / RLS:** Enable Row-Level Security on all 56 tables or disable the PostgREST API in the Supabase Dashboard (`API Settings -> PostgREST Settings -> Disable Data API`) since the application accesses PostgreSQL directly via Prisma pooler.
3. **Prisma Migration Baseline Resolution:** Mark existing migrations as applied in `_prisma_migrations` using `prisma migrate resolve` once approved.
4. **Fastify CSRF Plugin:** Add `@fastify/csrf-protection` to Fastify API routes if external browsers submit state-changing non-JSON requests directly to the API server.
