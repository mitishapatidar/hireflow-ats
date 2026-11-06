import React from 'react';
import { cookies } from 'next/headers';
import { ClientLayout } from '../../components/layout/ClientLayout';
import { requireRole } from '../../lib/auth';
import { SESSION_COOKIE_NAME, UserRole } from '@hireflow/shared';

export default async function ClientRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (cookies().has(SESSION_COOKIE_NAME) || process.env.NODE_ENV === 'production') {
    await requireRole(UserRole.CLIENT);
  }
  return <ClientLayout>{children}</ClientLayout>;
}
