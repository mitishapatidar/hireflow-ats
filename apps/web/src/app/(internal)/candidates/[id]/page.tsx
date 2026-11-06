import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { getCandidateByIdAction } from '@/actions/candidates';
import { CandidateProfileClientView, CandidateProfile, CandidateAuditLogItem } from './CandidateProfileClientView';

interface CandidateProfilePageProps {
  params: { id: string };
}

export default async function CandidateProfilePage({ params }: CandidateProfilePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { success, candidate, auditLogs, error } = await getCandidateByIdAction(params.id);

  if (!success || !candidate) {
    if (error?.includes('Forbidden')) {
      redirect('/no-permission');
    }
    notFound();
  }

  // Load available recruiters in same org for ownership handover
  const activeRecruiters = await prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      status: 'ACTIVE',
      role: { in: ['RECRUITER', 'MANAGER', 'ADMIN'] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });

  return (
    <CandidateProfileClientView
      candidate={candidate as unknown as CandidateProfile}
      auditLogs={(auditLogs ?? []) as unknown as CandidateAuditLogItem[]}
      currentUser={user}
      activeRecruiters={activeRecruiters}
    />
  );
}
