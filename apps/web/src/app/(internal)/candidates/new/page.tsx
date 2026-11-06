import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { UserRole } from '@hireflow/shared';
import { AddCandidateClientView } from './AddCandidateClientView';

export default async function AddCandidatePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Role guard: Only recruiters, managers and admins can add candidates
  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/no-permission');
  }

  // Fetch active recruiters in the same organization for the Owner dropdown
  const activeRecruiters = await prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      status: 'ACTIVE',
      role: { in: ['RECRUITER', 'MANAGER', 'ADMIN'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  });

  return <AddCandidateClientView currentUser={user} activeRecruiters={activeRecruiters} />;
}
