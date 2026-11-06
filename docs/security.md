# HireFlow ATS & Recruitment CRM — Security Hardening & Compliance (Prompt 5)

## 1. Zero Trust Principles
1. **Never Hard Delete**: Soft deletes enforced via `isArchived: true` and `archivedAt` timestamps.
2. **Strict Server-Side Authorization**: Every API route and Server Action independently validates session tokens and resource tenancy. Client-side state is never trusted for authorization.
3. **Data Leakage Shield**: Internal recruiter commentary, candidate placement fees, and agency margin percentages are stripped from all responses delivered to Client and Candidate users.
4. **Comprehensive Audit Trail**: Security events, role denials, rate-limiting triggers, and stage updates write immutable records to the `AuditLog` table.

## 2. Cryptographic Standards
- **Passwords**: Argon2id (`memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`).
- **Session Tokens**: 256-bit cryptographically random tokens (`crypto.randomBytes(32)`).
- **Session Hashes**: SHA-256 (`crypto.createHash('sha256')`).
- **Password Reset & Invitation Tokens**: SHA-256 single-use tokens expiring in 1 hour and 7 days respectively.
- **Cookies**: HTTP-only, Secure (HTTPS), SameSite=Lax.

## 3. Rate Limiting & Brute Force Defense
- Fastify and Next.js evaluate failed login attempts within rolling 60-second windows.
- 5 consecutive failures triggers an immediate HTTP 429 lock for 60 seconds.
- IP addresses and email hashes are logged to `LoginAttempt` for security monitoring.

## 4. Supabase Database Hardening
- Prisma ORM connects over TLS via AWS Singapore Supabase poolers.
- All 54 tables and 60 seeded candidates, jobs, and applications remain 100% intact.
- Incremental migrations record all authentication extensions without destructive resets.
