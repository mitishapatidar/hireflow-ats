import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';
import { hashToken, generateSecureToken } from '@hireflow/shared';

describe('Fastify Auth & Permission Integration Tests', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // Ensure test user has known default password
    const defaultPasswordHash =
      '$argon2id$v=19$m=19456,t=2,p=1$IkRKEEEdQpOx8veyQ4SslA$MlSeBGS431c/J5Y4rUU95tdOEzDV/O/veu9ExzhszZs'; // HireFlow@2026!
    await prisma.user.updateMany({
      where: { email: { in: ['anika.rao@hireflow.io', 'rahul.s@hireflow.io', 'mitisha.p@hireflow.io'] } },
      data: { passwordHash: defaultPasswordHash },
    });
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------
  // 1. Email + Password Authentication
  // -------------------------------------------------------------
  describe('POST /api/auth/login', () => {
    it('should sign in successfully with valid work email and Argon2id password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'anika.rao@hireflow.io',
          password: 'HireFlow@2026!',
          rememberMe: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('anika.rao@hireflow.io');
      expect(json.data.user.role).toBe('ADMIN');
      expect(json.data.redirectTo).toBe('/dashboard');
      expect(json.data.token).toBeDefined();

      // Verify Set-Cookie header
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies?.toString()).toContain('hireflow_session=');
      expect(cookies?.toString()).toContain('HttpOnly');
    });

    it('should reject login with invalid password (HTTP 401)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'anika.rao@hireflow.io',
          password: 'WrongPassword!123',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email (HTTP 401 generic message)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent.user@unknown.com',
          password: 'HireFlow@2026!',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should rate-limit after repeated failed login attempts (HTTP 429)', async () => {
      const attackEmail = `victim-${Date.now()}@hireflow.io`;
      const attackIp = '192.168.1.99';

      // Insert 5 simulated failed attempts within the past 10 seconds
      for (let i = 0; i < 5; i++) {
        await prisma.loginAttempt.create({
          data: {
            email: attackEmail,
            ipAddress: attackIp,
            success: false,
          },
        });
      }

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-forwarded-for': attackIp },
        payload: {
          email: attackEmail,
          password: 'GuessedPassword1!',
        },
      });

      expect(response.statusCode).toBe(429);
      const json = response.json();
      expect(json.error.code).toBe('TOO_MANY_ATTEMPTS');
    });
  });

  // -------------------------------------------------------------
  // 2. Google OAuth OIDC Flow
  // -------------------------------------------------------------
  describe('POST /api/auth/google', () => {
    it('should authenticate invited user via Google OIDC mock flow', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {
          code: 'mock_google_code_anika.rao@hireflow.io',
          state: 'secure_oauth_state_12345678',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('anika.rao@hireflow.io');
    });

    it('should reject Google login if email is unverified by Google (HTTP 403)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {
          code: 'mock_google_code_unverified_user@hireflow.io',
          state: 'secure_oauth_state_12345678',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('OAUTH_EMAIL_UNVERIFIED');
    });

    it('should reject Google login for uninvited user without workspace account (HTTP 403)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {
          code: 'mock_google_code_stranger@random.com',
          state: 'secure_oauth_state_12345678',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('INVITATION_REQUIRED');
    });

    it('should reject invalid or missing OAuth state parameter (HTTP 400)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {
          code: 'mock_google_code_anika.rao@hireflow.io',
          state: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------
  // 3. Invitation Acceptance Flow
  // -------------------------------------------------------------
  describe('POST /api/auth/invitation/accept', () => {
    it('should accept valid invitation and set Argon2id password', async () => {
      const org = await prisma.organization.findFirst();
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

      // Create a fresh test invitation
      const freshToken = generateSecureToken();
      await prisma.invitation.create({
        data: {
          email: `new-${Date.now()}@hireflow.io`,
          role: 'RECRUITER',
          organizationId: org!.id,
          invitedById: admin!.id,
          tokenHash: hashToken(freshToken),
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: freshToken,
          password: 'NewStrongPassword@2026',
          confirmPassword: 'NewStrongPassword@2026',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify the invitation cannot be reused (Single-use enforcement)
      const reusedResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: freshToken,
          password: 'NewStrongPassword@2026',
          confirmPassword: 'NewStrongPassword@2026',
        },
      });
      expect(reusedResponse.statusCode).toBe(400);
      expect(reusedResponse.json().error.code).toBe('INVITATION_ALREADY_USED');
    });

    it('should reject expired invitation token (HTTP 400)', async () => {
      const org = await prisma.organization.findFirst();
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

      const expiredToken = generateSecureToken();
      await prisma.invitation.create({
        data: {
          email: `expired-${Date.now()}@hireflow.io`,
          role: 'RECRUITER',
          organizationId: org!.id,
          invitedById: admin!.id,
          tokenHash: hashToken(expiredToken),
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 24 * 3600 * 1000),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: expiredToken,
          password: 'NewStrongPassword@2026',
          confirmPassword: 'NewStrongPassword@2026',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('INVITATION_EXPIRED');
    });
  });

  // -------------------------------------------------------------
  // 4. Password Reset Flow
  // -------------------------------------------------------------
  describe('POST /api/auth/password-reset', () => {
    it(
      'should create single-use password reset token and update password',
      async () => {
      const resetEmail = `reset-${Date.now()}@hireflow.io`;
      const org = await prisma.organization.findFirst();
      await prisma.user.create({
        data: {
          email: resetEmail,
          name: 'Reset Test User',
          organizationId: org!.id,
          role: 'RECRUITER',
          status: 'ACTIVE',
        },
      });

      // 1. Request reset
      const reqResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/password-reset/request',
        payload: { email: resetEmail },
      });
      expect(reqResponse.statusCode).toBe(200);

      // We need a known raw token to test confirm:
      const testRawToken = generateSecureToken();
      const tokenHash = hashToken(testRawToken);
      await prisma.passwordResetToken.create({
        data: {
          email: resetEmail,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });

      // 2. Confirm reset
      const confirmResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/password-reset/confirm',
        payload: {
          token: testRawToken,
          password: 'UpdatedPassword@2026!',
          confirmPassword: 'UpdatedPassword@2026!',
        },
      });
      expect(confirmResponse.statusCode).toBe(200);

      // 3. Verify single-use: Reusing the same token fails
      const reuseResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/password-reset/confirm',
        payload: {
          token: testRawToken,
          password: 'AnotherPassword@2026!',
          confirmPassword: 'AnotherPassword@2026!',
        },
      });
      expect(reuseResponse.statusCode).toBe(400);
      expect(reuseResponse.json().error.code).toBe('TOKEN_ALREADY_USED');
    }, 15000);
  });

  // -------------------------------------------------------------
  // 5. Protected Routes & Resource-Level Authorization
  // -------------------------------------------------------------
  describe('Protected Routes & Resource-Level Permissions', () => {
    let recruiterToken: string;

    beforeAll(async () => {
      // Sign in as Recruiter (Rahul Sharma)
      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'rahul.s@hireflow.io',
          password: 'HireFlow@2026!',
        },
      });
      recruiterToken = res.json().data.token;
    });

    it('should resolve current user profile on GET /api/auth/me', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${recruiterToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.user.email).toBe('rahul.s@hireflow.io');
      expect(json.data.user.role).toBe('RECRUITER');
    });

    it('CRITICAL TEST (HTTP 403): Recruiter requesting another recruiter unassigned candidate returns HTTP 403', async () => {
      // Find candidate owned by Mitisha Patidar (different recruiter from Rahul)
      const mitisha = await prisma.user.findUnique({ where: { email: 'mitisha.p@hireflow.io' } });
      const otherCandidate = await prisma.candidate.findFirst({
        where: { ownerId: mitisha?.id },
      });

      expect(otherCandidate).toBeDefined();

      const response = await server.inject({
        method: 'GET',
        url: `/api/candidates/${otherCandidate?.id}`,
        headers: {
          authorization: `Bearer ${recruiterToken}`,
        },
      });

      // Recruiter Rahul CANNOT read Mitisha's candidate!
      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('should sign out and revoke session on POST /api/auth/logout', async () => {
      const logoutResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${recruiterToken}`,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);

      // Verify session is now revoked: subsequent requests with same token return 401
      const meResponse = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${recruiterToken}`,
        },
      });
      expect(meResponse.statusCode).toBe(401);
      expect(meResponse.json().error.code).toBe('SESSION_EXPIRED');
    });
  });
});
