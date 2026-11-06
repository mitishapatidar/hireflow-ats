import crypto from 'crypto';
import { z } from 'zod';
import { UserRole } from './roles';

// Password Policy: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
export const PasswordPolicy = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// ==========================================
// 2. CRYPTOGRAPHIC TOKEN UTILITIES
// ==========================================

export function generateSecureToken(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ==========================================
// 3. SESSION COOKIE CONFIGURATION
// ==========================================

export const SESSION_COOKIE_NAME = 'hireflow_session';

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export function getSessionCookieOptions(token: string, rememberMe = false): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  // 30 days if rememberMe, otherwise 7 days
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function getClearSessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}

// ==========================================
// 4. ORGANIZATION DOMAIN ALLOWLIST
// ==========================================

export function isEmailDomainAllowed(email: string, domainAllowlist: string[]): boolean {
  if (!domainAllowlist || domainAllowlist.length === 0) return true;
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return domainAllowlist.some(allowed => allowed.toLowerCase() === domain);
}

// ==========================================
// 5. VALIDATION SCHEMAS
// ==========================================

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid work email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const InvitationAcceptSchema = z
  .object({
    token: z.string().min(1, 'Invitation token is required'),
    password: PasswordPolicy,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type InvitationAcceptInput = z.infer<typeof InvitationAcceptSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email('Please enter a valid work email address').trim().toLowerCase(),
});

export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: PasswordPolicy,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;

export const GoogleOAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'OAuth state is required'),
  nonce: z.string().optional(),
});

export type GoogleOAuthCallbackInput = z.infer<typeof GoogleOAuthCallbackSchema>;

// Role redirect mapping
export function getPostLoginRedirect(role: UserRole): string {
  switch (role) {
    case UserRole.RECRUITER:
    case UserRole.MANAGER:
    case UserRole.ADMIN:
      return '/dashboard';
    case UserRole.CLIENT:
      return '/portal';
    case UserRole.CANDIDATE:
      return '/my-dashboard';
    default:
      return '/dashboard';
  }
}
