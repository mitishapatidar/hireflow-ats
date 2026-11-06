import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import { hashOtp, hashChallengeToken, hashToken, generateSecureToken } from '@hireflow/shared';

describe('Fastify Security Policies & Two-Step Verification Integration Tests', () => {
  let server: FastifyInstance;
  let adminUserId: string;
  let orgId: string;
  const defaultPasswordHash =
    '$argon2id$v=19$m=19456,t=2,p=1$IkRKEEEdQpOx8veyQ4SslA$MlSeBGS431c/J5Y4rUU95tdOEzDV/O/veu9ExzhszZs'; // HireFlow@2026!

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    const admin = await prisma.user.findFirst({
      where: { email: 'anika.rao@hireflow.io' },
    });
    if (!admin) throw new Error('Admin user not found');
    adminUserId = admin.id;
    orgId = admin.organizationId;

    // Reset password & enforce 2FA policy
    await prisma.user.update({
      where: { id: adminUserId },
      data: { passwordHash: defaultPasswordHash, twoFactorEnabled: true },
    });

    await prisma.securityPolicy.upsert({
      where: { organizationId: orgId },
      update: {
        requireTwoStepVerification: true,
        maxConcurrentSessions: 2,
        inactivityTimeoutMinutes: 30,
        warningBeforeExpiryMinutes: 5,
        sensitiveActionReverificationMinutes: 15,
      },
      create: {
        organizationId: orgId,
        requireTwoStepVerification: true,
        maxConcurrentSessions: 2,
        inactivityTimeoutMinutes: 30,
        warningBeforeExpiryMinutes: 5,
        sensitiveActionReverificationMinutes: 15,
      },
    });
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------
  // 1. Two-Step Verification Handshake
  // -------------------------------------------------------------
  describe('Two-Step Login (2FA Challenge & Verification)', () => {
    let challengeToken: string;
    const testOtp = '849201';

    it('should issue a 2FA challenge when login credentials match and 2FA is required', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'anika.rao@hireflow.io',
          password: 'HireFlow@2026!',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.requires2FA).toBe(true);
      expect(json.data.challengeToken).toBeDefined();
      expect(json.data.emailMasked).toContain('@hireflow.io');

      challengeToken = json.data.challengeToken;

      // Update challenge in DB with deterministic OTP for test verification
      const cHash = hashChallengeToken(challengeToken);
      await prisma.otpChallenge.updateMany({
        where: { challengeHash: cHash },
        data: { otpHashed: hashOtp(testOtp) },
      });
    });

    it('should reject invalid 6-digit OTP code with HTTP 401 and increment attempts', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: {
          challengeToken,
          code: '000000',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_OTP');
      expect(json.error.message).toContain('attempt(s) remaining');
    });

    it('should reject non-numeric OTP payload format with HTTP 400 validation error', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: {
          challengeToken,
          code: 'ABCDEF',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should lock out challenge and return HTTP 429 when max attempts (3) are exceeded', async () => {
      // 2nd failed attempt
      await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: { challengeToken, code: '111111' },
      });

      // 3rd failed attempt -> triggers lockout and HTTP 429
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: { challengeToken, code: '222222' },
      });

      expect(response.statusCode).toBe(429);
      const json = response.json();
      expect(json.error.code).toBe('OTP_MAX_ATTEMPTS_EXCEEDED');

      // Verify challenge is revoked in DB
      const cHash = hashChallengeToken(challengeToken);
      const record = await prisma.otpChallenge.findUnique({ where: { challengeHash: cHash } });
      expect(record?.revokedAt).not.toBeNull();
    });

    it('should reject expired OTP challenge with HTTP 400 OTP_EXPIRED', async () => {
      // Create an expired challenge
      const expiredChallengeToken = generateSecureToken();
      const cHash = hashChallengeToken(expiredChallengeToken);
      await prisma.otpChallenge.create({
        data: {
          userId: adminUserId,
          organizationId: orgId,
          challengeHash: cHash,
          otpHashed: hashOtp('123456'),
          expiresAt: new Date(Date.now() - 1000 * 60), // expired 1m ago
          resendAvailableAt: new Date(),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: {
          challengeToken: expiredChallengeToken,
          code: '123456',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('OTP_EXPIRED');
    });

    it('should complete authentication and issue session cookie when valid OTP is provided', async () => {
      const freshChallengeToken = generateSecureToken();
      const validCode = '654321';
      const cHash = hashChallengeToken(freshChallengeToken);

      await prisma.otpChallenge.create({
        data: {
          userId: adminUserId,
          organizationId: orgId,
          challengeHash: cHash,
          otpHashed: hashOtp(validCode),
          expiresAt: new Date(Date.now() + 1000 * 300),
          resendAvailableAt: new Date(),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: {
          challengeToken: freshChallengeToken,
          code: validCode,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('anika.rao@hireflow.io');
      expect(json.data.token).toBeDefined();

      // Verify anti-replay: cannot reuse consumed challenge
      const replayResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: {
          challengeToken: freshChallengeToken,
          code: validCode,
        },
      });
      expect(replayResponse.statusCode).toBe(400);
      expect(replayResponse.json().error.code).toBe('CHALLENGE_ALREADY_USED');
    });
  });

  // -------------------------------------------------------------
  // 2. OTP Resend & Cooldown
  // -------------------------------------------------------------
  describe('OTP Resend & Cooldown Enforcement', () => {
    it('should reject OTP resend request with HTTP 429 when cooldown is active', async () => {
      const resendChallengeToken = generateSecureToken();
      const cHash = hashChallengeToken(resendChallengeToken);

      await prisma.otpChallenge.create({
        data: {
          userId: adminUserId,
          organizationId: orgId,
          challengeHash: cHash,
          otpHashed: hashOtp('112233'),
          expiresAt: new Date(Date.now() + 1000 * 300),
          resendAvailableAt: new Date(Date.now() + 1000 * 25), // 25s cooldown remaining
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/resend',
        payload: { challengeToken: resendChallengeToken },
      });

      expect(response.statusCode).toBe(429);
      const json = response.json();
      expect(json.error.code).toBe('RESEND_COOLDOWN_ACTIVE');
      expect(json.error.retryAfter).toBeGreaterThan(0);
    });

    it('should rotate OTP and reset cooldown when resend cooldown has elapsed', async () => {
      const eligibleChallengeToken = generateSecureToken();
      const cHash = hashChallengeToken(eligibleChallengeToken);

      await prisma.otpChallenge.create({
        data: {
          userId: adminUserId,
          organizationId: orgId,
          challengeHash: cHash,
          otpHashed: hashOtp('112233'),
          expiresAt: new Date(Date.now() + 1000 * 300),
          resendAvailableAt: new Date(Date.now() - 1000 * 5), // Cooldown elapsed 5s ago
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/resend',
        payload: { challengeToken: eligibleChallengeToken },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.resendCooldownSeconds).toBe(30);

      // Verify new resend cooldown is set in DB
      const updated = await prisma.otpChallenge.findUnique({ where: { challengeHash: cHash } });
      expect(new Date(updated!.resendAvailableAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  // -------------------------------------------------------------
  // 3. Concurrent Session Limits
  // -------------------------------------------------------------
  describe('Concurrent Session Limits Enforcement', () => {
    it('should revoke oldest session when active sessions exceed maxConcurrentSessions (2)', async () => {
      // First clean any prior active sessions for this test user
      await prisma.session.updateMany({
        where: { userId: adminUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Session 1 (oldest)
      const token1 = generateSecureToken();
      const session1 = await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(token1),
          expiresAt: new Date(Date.now() + 1000 * 3600),
          lastActivityAt: new Date(Date.now() - 1000 * 200),
          deviceInfo: 'Session 1 (Oldest)',
        },
      });

      // Session 2
      const token2 = generateSecureToken();
      const session2 = await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(token2),
          expiresAt: new Date(Date.now() + 1000 * 3600),
          lastActivityAt: new Date(Date.now() - 1000 * 100),
          deviceInfo: 'Session 2 (Middle)',
        },
      });

      // Authenticate Session 3 via OTP verification -> maxConcurrentSessions is 2, so Session 1 must be revoked!
      const challengeToken3 = generateSecureToken();
      const cHash3 = hashChallengeToken(challengeToken3);
      await prisma.otpChallenge.create({
        data: {
          userId: adminUserId,
          organizationId: orgId,
          challengeHash: cHash3,
          otpHashed: hashOtp('333333'),
          expiresAt: new Date(Date.now() + 1000 * 300),
          resendAvailableAt: new Date(),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: { challengeToken: challengeToken3, code: '333333' },
      });

      expect(response.statusCode).toBe(200);

      // Verify Session 1 is now revoked
      const updatedSession1 = await prisma.session.findUnique({ where: { id: session1.id } });
      expect(updatedSession1?.revokedAt).not.toBeNull();

      // Verify Session 2 is still active
      const updatedSession2 = await prisma.session.findUnique({ where: { id: session2.id } });
      expect(updatedSession2?.revokedAt).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // 4. Server-Enforced Inactivity Auto-Logout
  // -------------------------------------------------------------
  describe('Server-Enforced Inactivity Auto-Logout', () => {
    it('should reject request with HTTP 401 SESSION_EXPIRED when lastActivityAt exceeds inactivity timeout', async () => {
      const inactiveToken = generateSecureToken();
      await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(inactiveToken),
          expiresAt: new Date(Date.now() + 1000 * 3600 * 24), // Session expiry is far in future
          lastActivityAt: new Date(Date.now() - 1000 * 60 * 35), // Inactive for 35 minutes (policy is 30m)
          deviceInfo: 'Inactive Device',
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${inactiveToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.error.code).toBe('SESSION_EXPIRED');
      expect(json.error.message).toContain('inactivity');

      // Verify session was marked revoked in DB
      const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(inactiveToken) } });
      expect(session?.revokedAt).not.toBeNull();
    });
  });

  // -------------------------------------------------------------
  // 5. Sensitive-Action Re-verification & Admin Security Policies
  // -------------------------------------------------------------
  describe('Sensitive-Action Re-verification & Security Policies', () => {
    let adminToken: string;

    beforeAll(async () => {
      adminToken = generateSecureToken();
      await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(adminToken),
          expiresAt: new Date(Date.now() + 1000 * 3600),
          lastActivityAt: new Date(),
          lastReverifiedAt: null, // Never reverified yet
          deviceInfo: 'Admin Browser',
        },
      });
    });

    it('should reject policy update with HTTP 403 REVERIFICATION_REQUIRED when not recently reverified', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/admin/security/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          allowedAuthMethods: ['EMAIL_PASSWORD', 'GOOGLE'],
          allowedEmailDomains: [],
          requireTwoStepVerification: true,
          otpDeliveryMethod: 'EMAIL',
          otpExpirySeconds: 300,
          otpResendCooldownSeconds: 30,
          otpMaxAttempts: 3,
          maxConcurrentSessions: 3,
          inactivityTimeoutMinutes: 30,
          warningBeforeExpiryMinutes: 5,
          sensitiveActionReverificationMinutes: 15,
          changeReason: 'Admin policy adjustment',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('REVERIFICATION_REQUIRED');
    });

    it('should re-authenticate session with valid password on POST /api/auth/reauthenticate', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/reauthenticate',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          password: 'HireFlow@2026!',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.reverifiedAt).toBeDefined();

      // Verify lastReverifiedAt is populated in DB
      const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(adminToken) } });
      expect(session?.lastReverifiedAt).not.toBeNull();
    });

    it('should allow security policy modification after re-verification and write AuditLog', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/admin/security/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          allowedAuthMethods: ['EMAIL_PASSWORD', 'GOOGLE'],
          allowedEmailDomains: [],
          requireTwoStepVerification: true,
          otpDeliveryMethod: 'EMAIL',
          otpExpirySeconds: 300,
          otpResendCooldownSeconds: 30,
          otpMaxAttempts: 3,
          maxConcurrentSessions: 4,
          inactivityTimeoutMinutes: 45,
          warningBeforeExpiryMinutes: 5,
          sensitiveActionReverificationMinutes: 15,
          changeReason: 'Updated company policy for remote workers',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.policy.maxConcurrentSessions).toBe(4);
      expect(json.data.policy.inactivityTimeoutMinutes).toBe(45);

      // Verify AuditLog record was written
      const log = await prisma.auditLog.findFirst({
        where: {
          entity: 'SecurityPolicy',
          actorId: adminUserId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log?.action).toBe('SECURITY_POLICY_UPDATED');
    });
  });

  // -------------------------------------------------------------
  // 6. Session Management & Revocation
  // -------------------------------------------------------------
  describe('Session Management & Revocation Endpoints', () => {
    let currentToken: string;
    let otherSessionId: string;

    beforeAll(async () => {
      currentToken = generateSecureToken();
      await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(currentToken),
          expiresAt: new Date(Date.now() + 1000 * 3600),
          lastActivityAt: new Date(),
          deviceInfo: 'Current Device',
        },
      });

      const other = await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(generateSecureToken()),
          expiresAt: new Date(Date.now() + 1000 * 3600),
          lastActivityAt: new Date(),
          deviceInfo: 'Other Device',
        },
      });
      otherSessionId = other.id;
    });

    it('should list all active sessions and identify current session on GET /api/auth/sessions', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/sessions',
        headers: {
          authorization: `Bearer ${currentToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.sessions)).toBe(true);
      const current = json.data.sessions.find((s: { isCurrent: boolean }) => s.isCurrent);
      expect(current).toBeDefined();
    });

    it('should revoke a specific session on DELETE /api/auth/sessions/:id', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/auth/sessions/${otherSessionId}`,
        headers: {
          authorization: `Bearer ${currentToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      const revoked = await prisma.session.findUnique({ where: { id: otherSessionId } });
      expect(revoked?.revokedAt).not.toBeNull();
    });

    it('should revoke all other sessions on POST /api/auth/sessions/revoke-others', async () => {
      // Create another 2 sessions
      await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(generateSecureToken()),
          expiresAt: new Date(Date.now() + 1000 * 3600),
          lastActivityAt: new Date(),
          deviceInfo: 'Extra Device 1',
        },
      });
      await prisma.session.create({
        data: {
          userId: adminUserId,
          tokenHash: hashToken(generateSecureToken()),
          expiresAt: new Date(Date.now() + 1000 * 3600),
          lastActivityAt: new Date(),
          deviceInfo: 'Extra Device 2',
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/sessions/revoke-others',
        headers: {
          authorization: `Bearer ${currentToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.revokedCount).toBeGreaterThanOrEqual(2);

      // Verify current session is still active
      const current = await prisma.session.findUnique({ where: { tokenHash: hashToken(currentToken) } });
      expect(current?.revokedAt).toBeNull();
    });
  });
});
