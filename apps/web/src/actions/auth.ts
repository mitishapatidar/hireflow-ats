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
