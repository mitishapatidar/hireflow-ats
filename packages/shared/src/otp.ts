import crypto from 'crypto';
import { z } from 'zod';

// ==========================================
// 1. CRYPTOGRAPHIC 6-DIGIT OTP GENERATION & HASHING
// ==========================================

/**
 * Generates a cryptographically secure 6-digit numeric OTP string (100000 to 999999).
 */
export function generateSecure6DigitOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hashes an OTP with SHA-256 and a dedicated domain separation salt.
 * Ensures the plaintext OTP is NEVER persisted to the database.
 */
export function hashOtp(otp: string, salt: string = 'hireflow-otp-v1'): string {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${otp.trim()}`)
    .digest('hex');
}

/**
 * Constant-time comparison of an OTP against its hashed representation.
 */
export function verifyOtpHash(otp: string, hashed: string, salt: string = 'hireflow-otp-v1'): boolean {
  const computed = hashOtp(otp, salt);
  if (computed.length !== hashed.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hashed));
}

/**
 * Generates a high-entropy random challenge token for the 2FA pending state.
 */
export function generateChallengeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a challenge token before storage.
 */
export function hashChallengeToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Safely masks an email for UI presentation (e.g., "a***o@hireflow.io").
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

// ==========================================
// 2. VALIDATION SCHEMAS
// ==========================================

export const OtpVerifySchema = z.object({
  challengeToken: z.string().min(16, 'Invalid or missing authentication challenge token'),
  code: z
    .string()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain digits only'),
});

export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;

export const OtpResendSchema = z.object({
  challengeToken: z.string().min(16, 'Invalid or missing authentication challenge token'),
});

export type OtpResendInput = z.infer<typeof OtpResendSchema>;

export const ReauthenticateSchema = z.object({
  password: z.string().min(1, 'Password is required for sensitive operation confirmation'),
});

export type ReauthenticateInput = z.infer<typeof ReauthenticateSchema>;

export const RevokeSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session identifier'),
});

export type RevokeSessionInput = z.infer<typeof RevokeSessionSchema>;

export const UpdateSecurityPolicySchema = z.object({
  allowedAuthMethods: z.array(z.enum(['EMAIL_PASSWORD', 'GOOGLE'])).min(1, 'At least one authentication method must be enabled'),
  allowedEmailDomains: z.array(z.string().toLowerCase().trim()).default([]),
  requireTwoStepVerification: z.boolean(),
  otpDeliveryMethod: z.enum(['EMAIL']).default('EMAIL'),
  otpExpirySeconds: z.number().int().min(60).max(1800).default(300), // 1 to 30 mins
  otpResendCooldownSeconds: z.number().int().min(10).max(300).default(30), // 10s to 5m
  otpMaxAttempts: z.number().int().min(1).max(5).default(3), // 1 to 5 attempts
  maxConcurrentSessions: z.number().int().min(1).max(10).default(2), // 1 to 10
  inactivityTimeoutMinutes: z.number().int().min(5).max(1440).default(30), // 5m to 24h
  warningBeforeExpiryMinutes: z.number().int().min(1).max(30).default(5),
  sensitiveActionReverificationMinutes: z.number().int().min(1).max(120).default(15),
  clientAccessPolicy: z.record(z.any()).optional().nullable(),
  changeReason: z.string().min(3, 'A reason for updating security policies is required for audit compliance'),
});

export type UpdateSecurityPolicyInput = z.infer<typeof UpdateSecurityPolicySchema>;

// Pending 2FA Cookie Name (short-lived, 5 minutes)
export const CHALLENGE_COOKIE_NAME = 'hireflow_2fa_challenge';
