# Two-Step Login, Session Management & Security Policies (Phase 2 — Prompt 17)

## 1. Overview & Architecture

HireFlow ATS implements enterprise-grade authentication safeguards tailored for multi-tenant recruitment agencies (Tenant: Aureva Capital Private Limited).
The security module protects sensitive candidate records, CVs, and confidential client commercial agreements through:
- **Two-Step Verification (2FA)** via single-use 6-digit email OTPs.
- **Server-Enforced Inactivity Auto-Logout** with throttled database updates and proactive client warning modals.
- **Concurrent Session Limits** enforced atomically within database transactions.
- **Session Management & Revocation** allowing users and administrators to inspect active sessions and revoke remote logins.
- **Sensitive-Action Re-verification** requiring fresh password confirmation within 15 minutes before executing critical administrative changes.
- **Admin Security Policies** (Figma Frame 31) providing centralized policy governance and immutable audit logging.

---

## 2. Two-Step Verification (2FA Handshake)

### Figma Frame 16: Verify Your Identity

1. **Trigger Condition**:
   - Organization-wide policy (`SecurityPolicy.requireTwoStepVerification == true`) OR
   - User-specific setting (`User.twoFactorEnabled == true`).

2. **Handshake Flow**:
   - `POST /api/auth/login` verifies Argon2id password hash or Google OAuth tokens.
   - If 2FA is required, no authenticated session token is issued. Instead, an `OtpChallenge` record is created with:
     - Cryptographically random challenge token hashed via SHA-256 (`challengeHash`).
     - Secure 6-digit OTP code hashed with domain-separated SHA-256 salt (`otpHashed`).
     - Expiry timestamp (default 300 seconds / 5 minutes).
     - Resend cooldown timestamp (default 30 seconds).
     - Max attempts threshold (default 3 attempts).
   - An HTTP-only short-lived challenge cookie (`hireflow_2fa_challenge`) is set, and the client is redirected to `/verify-identity?challenge=<token>`.

3. **Verification Protocol**:
   - Client submits `POST /api/auth/otp/verify` with `{ challengeToken, code }`.
   - Timing-safe comparison verifies `verifyOtpHash(code, otpHashed)`.
   - On success:
     - Challenge is marked consumed (`consumedAt = now()`).
     - Concurrent session limit is enforced atomically.
     - Authenticated session cookie (`hireflow_session`) is issued.
     - Challenge cookie is cleared.
     - Audit log `OTP_VERIFICATION_SUCCESS` is persisted.
   - On failure:
     - Attempts counter is incremented.
     - If attempts reach max (3), challenge is revoked immediately (`revokedAt = now()`), and HTTP 429 (`OTP_MAX_ATTEMPTS_EXCEEDED`) is returned.
     - Replay prevention: consumed or expired challenges return HTTP 400 (`CHALLENGE_ALREADY_USED` / `OTP_EXPIRED`).

4. **Resend Protocol**:
   - `POST /api/auth/otp/resend` requires elapsed cooldown (30 seconds).
   - If cooldown is active, HTTP 429 (`RESEND_COOLDOWN_ACTIVE`) returns `retryAfter` seconds.
   - Once cooldown has elapsed, a new 6-digit OTP code is generated, hashed, and updated.

---

## 3. Server-Enforced Inactivity Auto-Logout

- **Dual-Layered Defense**:
  1. **Server Layer (`apps/api/src/plugins/auth.ts` & `apps/web/src/lib/auth.ts`)**:
     - On every authenticated API route or Server Action, the server computes `elapsedMs = Date.now() - session.lastActivityAt.getTime()`.
     - If `elapsedMs > policy.inactivityTimeoutMinutes * 60 * 1000` (default 30 minutes), the session is marked revoked in the database (`revokedAt = now()`), and HTTP 401 (`SESSION_EXPIRED`) is returned.
     - For active sessions, `lastActivityAt` is updated in the database at most once every 60 seconds (throttled to avoid DB write amplification).
  2. **Client Layer (`apps/web/src/components/inactivity-warning.tsx`)**:
     - Client tracks DOM activity (`mousemove`, `keydown`, `click`, `scroll`, `touchstart`).
     - 5 minutes before expiration (`inactivityTimeoutMinutes - warningBeforeExpiryMinutes`), a prominent warning modal appears with a live countdown timer.
     - "Stay Signed In" button pings the server to reset `lastActivityAt`.
     - "Sign Out" or counter reaching 0 calls `logoutAction()` and redirects to `/session-expired`.

---

## 4. Concurrent Session Limits

- Configured per organization (`SecurityPolicy.maxConcurrentSessions`, default 2 active sessions).
- Enforced atomically during login and 2FA completion:
  ```typescript
  const activeSessions = await tx.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { lastActivityAt: 'asc' }, // Oldest first
  });
  if (activeSessions.length >= maxConcurrentSessions) {
    const toRevokeCount = activeSessions.length - maxConcurrentSessions + 1;
    const idsToRevoke = activeSessions.slice(0, toRevokeCount).map((s) => s.id);
    await tx.session.updateMany({
      where: { id: { in: idsToRevoke } },
      data: { revokedAt: now },
    });
  }
  ```
- Ensures users cannot maintain unbounded parallel sessions across multiple untrusted devices.

---

## 5. Session Management & Remote Revocation

Users and admins can inspect and manage their active sessions:
- `GET /api/auth/sessions`: Lists all non-revoked sessions for the authenticated user, identifying `isCurrent: true` for the active device.
- `DELETE /api/auth/sessions/:id`: Revokes a specific remote session.
- `POST /api/auth/sessions/revoke-others`: Atomically revokes all sessions belonging to the user except the current session.

---

## 6. Sensitive-Action Re-verification & Admin Security Policies

### Figma Frame 31: Security Policies

- **Re-verification Window**:
  - Critical actions (updating tenant security policies, changing 2FA rules, adjusting timeouts) require `lastReverifiedAt` within 15 minutes.
  - If `lastReverifiedAt == null` or `now - lastReverifiedAt > 15 minutes`, the API returns HTTP 403 (`REVERIFICATION_REQUIRED`).
  - The client displays a secure re-authentication modal prompting for the administrator's password.
  - `POST /api/auth/reauthenticate` verifies the password with Argon2id and stamps `lastReverifiedAt = now()`.
- **Admin Configuration Screen (`/admin/security`)**:
  - **Authentication Methods**: Allowed authentication mechanisms (`EMAIL_PASSWORD`, `GOOGLE`).
  - **Email Domain Whitelist**: Restricts registration and login to corporate email domains (e.g., `hireflow.io`, `aurevacapital.com`).
  - **Two-Step Verification Policy**: Enforce 2FA organization-wide, OTP expiry duration, resend cooldown, max attempts.
  - **Session Management Policies**: Max concurrent sessions, inactivity timeout, expiration warning window, sensitive action re-auth window.
  - **Active Sessions Table**: Remote device inspection and instant revocation.
  - **Audit Trail**: Full chronological log of security policy modifications with before/after snapshots and administrator attribution.

---

## 7. Security & Compliance Verification

| Requirement | Implementation | Test Verification |
|---|---|---|
| Plaintext OTP Never Stored | SHA-256 salted hash (`otpHashed`) | `packages/shared/src/otp.test.ts` |
| Timing-Safe Hash Verification | `crypto.timingSafeEqual` in `verifyOtpHash` | `packages/shared/src/otp.test.ts` |
| Single-Use Anti-Replay | `consumedAt` timestamp check | `apps/api/src/routes/security.test.ts` |
| Max 3 Attempts Lockout | `attempts >= 3` revokes challenge (HTTP 429) | `apps/api/src/routes/security.test.ts` |
| 30s Resend Cooldown | `resendAvailableAt` check (HTTP 429) | `apps/api/src/routes/security.test.ts` |
| Inactivity Auto-Logout | Server checks `lastActivityAt > 30m` (HTTP 401) | `apps/api/src/routes/security.test.ts` |
| Concurrent Session Cap | Atomic DB transaction revoking oldest session | `apps/api/src/routes/security.test.ts` |
| Sensitive Re-auth Window | 15-minute `lastReverifiedAt` check (HTTP 403) | `apps/api/src/routes/security.test.ts` |
| Audit Trail | Immutable `AuditLog` entry on policy update | `apps/api/src/routes/security.test.ts` |
