'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@hireflow/db';
import {
  LoginSchema,
  InvitationAcceptSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  generateSecureToken,
  hashToken,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
  getPostLoginRedirect,
  SESSION_COOKIE_NAME,
  UserRole,
  generateSecure6DigitOtp,
  hashOtp,
  verifyOtpHash,
  generateChallengeToken,
  hashChallengeToken,
  OtpVerifySchema,
  CHALLENGE_COOKIE_NAME,
} from '@hireflow/shared';
import { hashPassword, verifyPassword } from '@hireflow/shared/password';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// -------------------------------------------------------------
// 1. LOGIN ACTION
// -------------------------------------------------------------
export async function loginAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    rememberMe: formData.get('rememberMe') === 'on',
  };

  const parseResult = LoginSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please check your inputs and try again.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const { email, password, rememberMe } = parseResult.data;

  // Rate Limiting Check (Max 5 attempts / min)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const failures = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (failures >= 5) {
    return {
      success: false,
      error: 'Too many failed login attempts. Please wait 60 seconds before trying again.',
    };
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (!user || !user.passwordHash || user.isArchived) {
    await prisma.loginAttempt.create({
      data: { email, ipAddress: '127.0.0.1', success: false },
    });
    return {
      success: false,
      error: 'Invalid work email or password. Please try again.',
    };
  }

  if (user.status !== 'ACTIVE') {
    return {
      success: false,
      error: 'Your account is deactivated or suspended. Please contact your organization administrator.',
    };
  }

  const isMatch = await verifyPassword(user.passwordHash, password);
  if (!isMatch) {
    await prisma.loginAttempt.create({
      data: { email, ipAddress: '127.0.0.1', success: false },
    });
    return {
      success: false,
      error: 'Invalid work email or password. Please try again.',
    };
  }

  // Log successful attempt
  await prisma.loginAttempt.create({
    data: { email, ipAddress: '127.0.0.1', success: true },
  });

  // Resolve Organization Security Policy
  const policy = await prisma.securityPolicy.findUnique({
    where: { organizationId: user.organizationId },
  });
  const requires2FA = policy ? policy.requireTwoStepVerification : true;

  if (requires2FA || user.twoFactorEnabled) {
    const rawOtp = generateSecure6DigitOtp();
    const otpHashed = hashOtp(rawOtp);
    const challengeToken = generateChallengeToken();
    const challengeHash = hashChallengeToken(challengeToken);
    const expiresAt = new Date(Date.now() + (policy?.otpExpirySeconds || 300) * 1000);
    const resendAvailableAt = new Date(Date.now() + (policy?.otpResendCooldownSeconds || 30) * 1000);

    // Invalidate existing pending challenges for this user
    await prisma.otpChallenge.updateMany({
      where: { userId: user.id, consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        challengeHash,
        otpHashed,
        expiresAt,
        resendAvailableAt,
        actionContext: 'LOGIN',
      },
    });

    // In dev / demo / test, log simulated OTP
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEMO_2FA_EMAIL] Simulated 2FA OTP code for ${user.email}: ${rawOtp}`);
    }

    cookies().set(CHALLENGE_COOKIE_NAME, challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: policy?.otpExpirySeconds || 300,
    });

    redirect(`/verify-identity?challenge=${challengeToken}`);
  }

  // If 2FA not required: Enforce Concurrent Session Limit
  const maxSessions = policy?.maxConcurrentSessions || 2;
  const now = new Date();
  const activeSessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'asc' },
  });

  if (activeSessions.length >= maxSessions) {
    const toRevokeCount = activeSessions.length - maxSessions + 1;
    for (const s of activeSessions.slice(0, toRevokeCount)) {
      await prisma.session.update({
        where: { id: s.id },
        data: { revokedAt: now },
      });
    }
  }

  // Create session & rotate token
  const rawSessionToken = generateSecureToken();
  const tokenHash = hashToken(rawSessionToken);
  const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 3600 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      deviceInfo: 'HireFlow Web App',
      ipAddress: '127.0.0.1',
      lastActivityAt: new Date(),
    },
  });

  // Set HTTP-Only Cookie
  const cookieOpts = getSessionCookieOptions(rawSessionToken, rememberMe);
  cookies().set(cookieOpts.name, cookieOpts.value, {
    httpOnly: cookieOpts.httpOnly,
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path,
    maxAge: cookieOpts.maxAge,
  });

  // Post-login redirect based on database role
  const targetPath = getPostLoginRedirect(user.role as UserRole);
  redirect(targetPath);
}

// -------------------------------------------------------------
// 1b. VERIFY OTP ACTION (Two-Step Verification Handshake)
// -------------------------------------------------------------
export async function verifyOtpAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const challengeToken =
    (formData.get('challengeToken') as string) ||
    cookies().get(CHALLENGE_COOKIE_NAME)?.value ||
    '';
  const code = (formData.get('code') as string) || '';

  const parseResult = OtpVerifySchema.safeParse({ challengeToken, code });
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please enter a valid 6-digit verification code.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const challengeHash = hashChallengeToken(challengeToken);
  const challenge = await prisma.otpChallenge.findUnique({
    where: { challengeHash },
    include: { user: { include: { organization: true } }, organization: true },
  });

  if (!challenge || challenge.revokedAt) {
    return {
      success: false,
      error: 'Authentication challenge is invalid or has expired. Please sign in again.',
    };
  }

  if (challenge.consumedAt) {
    return {
      success: false,
      error: 'This verification code has already been used.',
    };
  }

  if (new Date() > challenge.expiresAt) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { revokedAt: new Date() },
    });
    return {
      success: false,
      error: 'Verification code has expired. Please click resend to receive a fresh code.',
    };
  }

  const policy = await prisma.securityPolicy.findUnique({
    where: { organizationId: challenge.organizationId },
  });
  const maxAttempts = policy?.otpMaxAttempts || 3;

  if (challenge.attempts >= maxAttempts) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { revokedAt: new Date() },
    });
    return {
      success: false,
      error: 'Maximum verification attempts exceeded. Please sign in again.',
    };
  }

  const isValid = verifyOtpHash(code, challenge.otpHashed);
  if (!isValid) {
    const updatedAttempts = challenge.attempts + 1;
    const isLocked = updatedAttempts >= maxAttempts;
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: updatedAttempts,
        revokedAt: isLocked ? new Date() : null,
      },
    });

    return {
      success: false,
      error: isLocked
        ? 'Maximum verification attempts exceeded. Please sign in again.'
        : `Incorrect verification code. ${maxAttempts - updatedAttempts} attempt(s) remaining.`,
    };
  }

  // Mark challenge consumed
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  // Enforce concurrent session limit atomically
  const maxSessions = policy?.maxConcurrentSessions || 2;
  const now = new Date();
  const activeSessions = await prisma.session.findMany({
    where: { userId: challenge.userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'asc' },
  });

  if (activeSessions.length >= maxSessions) {
    const toRevokeCount = activeSessions.length - maxSessions + 1;
    for (const s of activeSessions.slice(0, toRevokeCount)) {
      await prisma.session.update({
        where: { id: s.id },
        data: { revokedAt: now },
      });
    }
  }

  // Create authenticated session
  const rawSessionToken = generateSecureToken();
  const tokenHash = hashToken(rawSessionToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  await prisma.session.create({
    data: {
      userId: challenge.userId,
      tokenHash,
      expiresAt,
      deviceInfo: 'HireFlow Web App (2FA)',
      ipAddress: '127.0.0.1',
      lastActivityAt: new Date(),
      lastReverifiedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: challenge.userId },
    data: { lastLoginAt: new Date() },
  });

  // Set session cookie & clear challenge cookie
  const cookieOpts = getSessionCookieOptions(rawSessionToken, false);
  cookies().set(cookieOpts.name, cookieOpts.value, {
    httpOnly: cookieOpts.httpOnly,
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path,
    maxAge: cookieOpts.maxAge,
  });

  cookies().set(CHALLENGE_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  const targetPath = getPostLoginRedirect(challenge.user.role as UserRole);
  redirect(targetPath);
}

// -------------------------------------------------------------
// 1c. RESEND OTP ACTION
// -------------------------------------------------------------
export async function resendOtpAction(challengeToken: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  retryAfter?: number;
}> {
  if (!challengeToken) {
    return { success: false, error: 'Challenge token is missing' };
  }

  const challengeHash = hashChallengeToken(challengeToken);
  const challenge = await prisma.otpChallenge.findUnique({
    where: { challengeHash },
    include: { user: true, organization: true },
  });

  if (!challenge || challenge.revokedAt || challenge.consumedAt) {
    return { success: false, error: 'Authentication challenge is invalid or has expired.' };
  }

  const policy = await prisma.securityPolicy.findUnique({
    where: { organizationId: challenge.organizationId },
  });
  const cooldownSecs = policy?.otpResendCooldownSeconds || 30;
  const now = Date.now();

  if (now < challenge.resendAvailableAt.getTime()) {
    const waitSeconds = Math.ceil((challenge.resendAvailableAt.getTime() - now) / 1000);
    return {
      success: false,
      error: `Please wait ${waitSeconds} seconds before requesting a new code.`,
      retryAfter: waitSeconds,
    };
  }

  const rawOtp = generateSecure6DigitOtp();
  const otpHashed = hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + (policy?.otpExpirySeconds || 300) * 1000);
  const resendAvailableAt = new Date(Date.now() + cooldownSecs * 1000);

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: {
      otpHashed,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEMO_2FA_EMAIL] Resent simulated 2FA OTP code for ${challenge.user.email}: ${rawOtp}`);
  }

  return {
    success: true,
    message: 'A fresh verification code has been dispatched to your email.',
  };
}

// -------------------------------------------------------------
// 1d. RE-AUTHENTICATE ACTION (Sensitive Actions Re-verification)
// -------------------------------------------------------------
export async function reauthenticateAction(password: string): Promise<{
  success: boolean;
  error?: string;
  reverifiedUntil?: string;
}> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return { success: false, error: 'Authentication required' };
  }

  const tokenHash = hashToken(sessionToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || new Date() > session.expiresAt) {
    return { success: false, error: 'Session expired' };
  }

  if (!session.user.passwordHash) {
    return { success: false, error: 'No password set for account' };
  }

  const isMatch = await verifyPassword(session.user.passwordHash, password);
  if (!isMatch) {
    return { success: false, error: 'Incorrect password. Re-verification failed.' };
  }

  const now = new Date();
  await prisma.session.update({
    where: { id: session.id },
    data: { lastReverifiedAt: now },
  });

  return {
    success: true,
    reverifiedUntil: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
  };
}

// -------------------------------------------------------------
// 1e. REVOKE SESSION ACTIONS
// -------------------------------------------------------------
export async function revokeSessionAction(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return { success: false, error: 'Unauthorized' };

  const tokenHash = hashToken(sessionToken);
  const currentSession = await prisma.session.findUnique({
    where: { tokenHash },
  });
  if (!currentSession) return { success: false, error: 'Session not found' };

  const targetSession = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!targetSession || targetSession.userId !== currentSession.userId) {
    return { success: false, error: 'Session not found or forbidden' };
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  if (sessionId === currentSession.id) {
    const clearOpts = getClearSessionCookieOptions();
    cookies().set(clearOpts.name, clearOpts.value, {
      httpOnly: clearOpts.httpOnly,
      secure: clearOpts.secure,
      sameSite: clearOpts.sameSite,
      path: clearOpts.path,
      maxAge: clearOpts.maxAge,
    });
    redirect('/login');
  }

  return { success: true };
}

export async function revokeOtherSessionsAction(): Promise<{ success: boolean; revokedCount: number }> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return { success: false, revokedCount: 0 };

  const tokenHash = hashToken(sessionToken);
  const currentSession = await prisma.session.findUnique({ where: { tokenHash } });
  if (!currentSession) return { success: false, revokedCount: 0 };

  const result = await prisma.session.updateMany({
    where: {
      userId: currentSession.userId,
      revokedAt: null,
      id: { not: currentSession.id },
    },
    data: { revokedAt: new Date() },
  });

  return { success: true, revokedCount: result.count };
}

// -------------------------------------------------------------
// 2. LOGOUT ACTION
// -------------------------------------------------------------
export async function logoutAction(): Promise<void> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const clearOpts = getClearSessionCookieOptions();
  cookieStore.set(clearOpts.name, clearOpts.value, {
    httpOnly: clearOpts.httpOnly,
    secure: clearOpts.secure,
    sameSite: clearOpts.sameSite,
    path: clearOpts.path,
    maxAge: 0,
  });

  redirect('/login');
}

// -------------------------------------------------------------
// 3. ACCEPT INVITATION ACTION
// -------------------------------------------------------------
export async function acceptInvitationAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    token: formData.get('token') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const parseResult = InvitationAcceptSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please fix the errors below.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const { token, password } = parseResult.data;
  const tokenHash = hashToken(token);

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    return { success: false, error: 'Invalid or unrecognized invitation token.' };
  }

  if (invitation.status !== 'PENDING' || invitation.acceptedAt) {
    return { success: false, error: 'This invitation has already been used.' };
  }

  if (new Date() > invitation.expiresAt) {
    return { success: false, error: 'This invitation link has expired. Please ask your administrator to re-invite you.' };
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email: invitation.email },
    update: { passwordHash, status: 'ACTIVE', isArchived: false },
    create: {
      email: invitation.email,
      name: invitation.email.split('@')[0],
      passwordHash,
      role: invitation.role,
      organizationId: invitation.organizationId,
      status: 'ACTIVE',
    },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });

  redirect('/login?accepted=true');
}

// -------------------------------------------------------------
// 4. REQUEST PASSWORD RESET ACTION
// -------------------------------------------------------------
export async function requestPasswordResetAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = { email: formData.get('email') as string };
  const parseResult = PasswordResetRequestSchema.safeParse(rawData);

  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please enter a valid work email address.',
    };
  }

  const { email } = parseResult.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.isArchived && user.status === 'ACTIVE') {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    await prisma.passwordResetToken.create({
      data: {
        email,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
  }

  // Always return generic success message to prevent email enumeration
  return {
    success: true,
    error: undefined,
  };
}

// -------------------------------------------------------------
// 5. CONFIRM PASSWORD RESET ACTION
// -------------------------------------------------------------
export async function confirmPasswordResetAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    token: formData.get('token') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const parseResult = PasswordResetConfirmSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please check your inputs and try again.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const { token, password } = parseResult.data;
  const tokenHash = hashToken(token);

  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetRecord || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
    return {
      success: false,
      error: 'This password reset link is invalid or has expired.',
    };
  }

  const user = await prisma.user.findUnique({ where: { email: resetRecord.email } });
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.passwordResetToken.update({
    where: { id: resetRecord.id },
    data: { usedAt: new Date() },
  });

  // Revoke all existing sessions
  await prisma.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  redirect('/login?reset=true');
}
