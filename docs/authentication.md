# HireFlow ATS & Recruitment CRM — Authentication Architecture (Prompt 5)

## 1. Overview
HireFlow implements an enterprise-grade, invitation-only authentication architecture designed specifically for multi-tenant recruitment agencies. It adheres strictly to modern OWASP security standards, zero public registration, and server-managed session lifecycle.

## 2. Supported Authentication Methods

### A. Work Email + Argon2id Password
- **Algorithm**: Argon2id via `@node-rs/argon2`.
- **Parameters**: `memoryCost: 19456` (19 MiB), `timeCost: 2`, `parallelism: 1`, `outputLen: 32`.
- **Password Policy**: Minimum 8 characters, maximum 128 characters, requiring at least one uppercase letter, one lowercase letter, one numeric digit, and one special symbol (`[^A-Za-z0-9]`).
- **Domain Allowlist**: Only corporate work domains (`hireflow.io`, `aurevacapital.com`, `acmetech.com`) are permitted. Consumer webmail domains (`gmail.com`, `yahoo.com`, `hotmail.com`) are rejected for internal agency access.
- **Account Status Guard**: Accounts marked `SUSPENDED`, `DEACTIVATED`, or `isArchived: true` are blocked at authentication.
- **Timing & Enumeration Defense**: All failures return generic error messages: `"Invalid work email or password. Please try again."`

### B. Google OAuth2 / OpenID Connect (OIDC)
- **Protocol**: OpenID Connect with state parameter and cryptographic nonce verification.
- **Hosted Domain Enforcement**: Matches user email against verified Google profile. Unverified emails (`email_verified !== true`) are rejected immediately.
- **Pre-Provisioning Requirement**: Google login does not create new agency accounts automatically. A matching `User` record or pending `Invitation` must pre-exist in the database.
- **Pending Real Credentials**: When `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` are unconfigured, mock flow permits testing while logging clear configuration warnings. Real Google Cloud OAuth credentials setup is documented as pending user provision.

## 3. Session Management & Cookie Security

### Server-Side Session Storage
- Every active login generates a cryptographically secure 256-bit token via `crypto.randomBytes(32).toString('hex')`.
- The plaintext token is sent ONLY to the client as an HTTP-only cookie.
- The database `Session` table stores only the SHA-256 hash (`tokenHash`). Database compromises cannot leak valid session tokens.
- **Session Duration**:
  - Standard session: 7 days.
  - "Remember this device": 30 days.

### HTTP-Only Cookie Specifications
- **Name**: `hireflow_session`
- **HttpOnly**: `true` (unreachable from JavaScript, immune to XSS token theft).
- **Secure**: `true` in production (HTTPS-only).
- **SameSite**: `Lax` (prevents cross-site request forgery while preserving top-level navigation).
- **Path**: `/`

## 4. Invitation & Password Reset Workflows

### Invitation-Only Registration
- Admin invites a user with a specific `UserRole` and organization boundary.
- An `Invitation` record is created with a single-use token hash and 7-day expiration.
- User visits `/accept-invitation?token=...`, validates the token, and creates their Argon2id password.
- Upon completion, the invitation is marked `ACCEPTED`, user status becomes `ACTIVE`, and the token is invalidated.

### Password Reset
- User submits work email at `/forgot-password`.
- If user exists, a `PasswordResetToken` record is created with a 1-hour expiration and single-use hash.
- Even if user does not exist, the response returns identical success confirmation (zero user enumeration).
- User accesses `/reset-password?token=...`, enters their new password complying with `PasswordPolicy`.
- Upon success, the token is marked `usedAt: new Date()` and all prior sessions for the user are revoked.

## 5. Security & Rate Limiting
- **Brute Force Protection**: IP and email-based tracking via `LoginAttempt` table. Limits login attempts to 5 per minute per identity. Returns HTTP 429 (`Too Many Requests`) with generic backoff notices.
- **Audit Logging**: Every login failure, rate limit block, password reset, and invitation acceptance is recorded in the `AuditLog` table.
