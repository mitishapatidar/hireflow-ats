import React from 'react';
import { cookies } from 'next/headers';
import { InternalLayout } from '../../components/layout/InternalLayout';
import { requireRole } from '../../lib/auth';
import { SESSION_COOKIE_NAME, UserRole } from '@hireflow/shared';
import { InactivityWarning } from '@/components/inactivity-warning';

export default async function InternalRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (cookies().has(SESSION_COOKIE_NAME) || process.env.NODE_ENV === 'production') {
    await requireRole(UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN);
  }
  return (
    <InternalLayout>
      <InactivityWarning timeoutMinutes={30} warningMinutes={5} />
      {children}
    </InternalLayout>
  );
}
