import { describe, it, expect } from 'vitest';
import {
  PasswordPolicy,
  generateSecureToken,
  hashToken,
  isEmailDomainAllowed,
  getPostLoginRedirect,
} from './auth';
import { hashPassword, verifyPassword } from './password';
import { UserRole } from './roles';

describe('Auth Utilities - Argon2id & Tokens', () => {
  it('should hash a password using Argon2id and verify it correctly', async () => {
    const rawPassword = 'StrongPassword!2026';
    const hashedPassword = await hashPassword(rawPassword);

    expect(hashedPassword).toMatch(/^\$argon2id\$/);
    const isValid = await verifyPassword(hashedPassword, rawPassword);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hashedPassword, 'WrongPassword123!');
    expect(isInvalid).toBe(false);
  });

  it('should enforce password policy requirements', () => {
    // Valid password
    expect(PasswordPolicy.safeParse('HireFlow@2026!').success).toBe(true);

    // Too short (< 8 chars)
    expect(PasswordPolicy.safeParse('Hi1@').success).toBe(false);

    // Missing uppercase
    expect(PasswordPolicy.safeParse('hireflow@2026!').success).toBe(false);

    // Missing number
    expect(PasswordPolicy.safeParse('HireFlow!Secret').success).toBe(false);

    // Missing special character
    expect(PasswordPolicy.safeParse('HireFlow2026Secure').success).toBe(false);
  });

  it('should generate cryptographically secure 64-character hex tokens', () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('should hash tokens deterministically using SHA-256', () => {
    const token = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('should check organization email domain allowlists accurately', () => {
    const allowlist = ['aurevacapital.com', 'acmetech.com'];

    expect(isEmailDomainAllowed('anika@aurevacapital.com', allowlist)).toBe(true);
    expect(isEmailDomainAllowed('priya@acmetech.com', allowlist)).toBe(true);
    expect(isEmailDomainAllowed('hacker@spam.com', allowlist)).toBe(false);
    expect(isEmailDomainAllowed('user@gmail.com', allowlist)).toBe(false);
  });

  it('should map roles to their designated post-login redirect routes', () => {
    expect(getPostLoginRedirect(UserRole.RECRUITER)).toBe('/dashboard');
    expect(getPostLoginRedirect(UserRole.MANAGER)).toBe('/dashboard');
    expect(getPostLoginRedirect(UserRole.ADMIN)).toBe('/dashboard');
    expect(getPostLoginRedirect(UserRole.CLIENT)).toBe('/portal');
    expect(getPostLoginRedirect(UserRole.CANDIDATE)).toBe('/my-dashboard');
  });
});
