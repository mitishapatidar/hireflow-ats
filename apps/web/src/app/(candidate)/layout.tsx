import React from 'react';
import { cookies } from 'next/headers';
import { CandidateLayout } from '../../components/layout/CandidateLayout';
import { requireRole } from '../../lib/auth';
import { SESSION_COOKIE_NAME, UserRole } from '@hireflow/shared';

export default async function CandidateRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (cookies().has(SESSION_COOKIE_NAME) || process.env.NODE_ENV === 'production') {
    await requireRole(UserRole.CANDIDATE);
  }
  return <CandidateLayout>{children}</CandidateLayout>;
}
