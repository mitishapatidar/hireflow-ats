import { describe, it, expect } from 'vitest';
import {
  generateSecure6DigitOtp,
  hashOtp,
  verifyOtpHash,
  generateChallengeToken,
  hashChallengeToken,
  maskEmail,
  OtpVerifySchema,
  OtpResendSchema,
  UpdateSecurityPolicySchema,
} from './otp';

describe('Prompt 17: OTP & Security Policy Shared Utilities', () => {
  it('generates a valid 6-digit numeric OTP', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateSecure6DigitOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      const val = parseInt(otp, 10);
      expect(val).toBeGreaterThanOrEqual(100000);
      expect(val).toBeLessThan(1000000);
    }
  });

  it('hashes OTP securely and verifies timing-safe equality', () => {
    const otp = '849201';
    const hashed = hashOtp(otp);
    expect(hashed).toHaveLength(64); // SHA-256 hex string

    expect(verifyOtpHash(otp, hashed)).toBe(true);
    expect(verifyOtpHash('849202', hashed)).toBe(false);
    expect(verifyOtpHash('000000', hashed)).toBe(false);
  });

  it('generates high-entropy challenge token and hashes it correctly', () => {
    const token = generateChallengeToken();
    expect(token).toHaveLength(64); // 32 bytes hex
    const hashed = hashChallengeToken(token);
    expect(hashed).toHaveLength(64);
  });

  it('masks emails safely for UI presentation without revealing full identity', () => {
    expect(maskEmail('anika.rao@hireflow.io')).toBe('a*******o@hireflow.io');
    expect(maskEmail('hr@acme.com')).toBe('h***@acme.com');
    expect(maskEmail('a@test.com')).toBe('a***@test.com');
  });

  it('validates OtpVerifySchema with strict 6-digit regex', () => {
    const valid = OtpVerifySchema.safeParse({
      challengeToken: 'a'.repeat(32),
      code: '123456',
    });
    expect(valid.success).toBe(true);

    const invalidDigits = OtpVerifySchema.safeParse({
      challengeToken: 'a'.repeat(32),
      code: '12345a',
    });
    expect(invalidDigits.success).toBe(false);

    const shortCode = OtpVerifySchema.safeParse({
      challengeToken: 'a'.repeat(32),
      code: '12345',
    });
    expect(shortCode.success).toBe(false);
  });

  it('validates UpdateSecurityPolicySchema boundary requirements', () => {
    const valid = UpdateSecurityPolicySchema.safeParse({
      allowedAuthMethods: ['EMAIL_PASSWORD', 'GOOGLE'],
      allowedEmailDomains: ['hireflow.io'],
      requireTwoStepVerification: true,
      otpDeliveryMethod: 'EMAIL',
      otpExpirySeconds: 300,
      otpResendCooldownSeconds: 30,
      otpMaxAttempts: 3,
      maxConcurrentSessions: 2,
      inactivityTimeoutMinutes: 30,
      warningBeforeExpiryMinutes: 5,
      sensitiveActionReverificationMinutes: 15,
      changeReason: 'Updated company security policy for ISO compliance',
    });
    expect(valid.success).toBe(true);

    const missingReason = UpdateSecurityPolicySchema.safeParse({
      allowedAuthMethods: ['EMAIL_PASSWORD'],
      requireTwoStepVerification: true,
      changeReason: '',
    });
    expect(missingReason.success).toBe(false);
  });
});
