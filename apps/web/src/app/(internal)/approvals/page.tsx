import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { getApprovalsAction, getApprovalHistoryAction } from '@/actions/approvals';
import { ApprovalCenterClientView } from './ApprovalCenterClientView';

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function ApprovalsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    redirect('/dashboard');
  }

  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams.tab || 'submissions';
  const search = resolvedSearchParams.search || '';
  const page = parseInt(resolvedSearchParams.page || '1', 10);

  const [approvalsRes, historyRes] = await Promise.all([
    getApprovalsAction({ tab, search, page, limit: 20 }),
    getApprovalHistoryAction(1, 30),
  ]);

  const initialData = approvalsRes.success ? approvalsRes.data : { items: [], total: 0, page: 1, limit: 20 };
  const historyData = historyRes.success ? historyRes.data : { items: [], total: 0, page: 1, limit: 30 };

  return (
    <ApprovalCenterClientView
      initialTab={tab}
      initialData={initialData}
      historyData={historyData}
      currentUser={{
        id: user.id,
        name: user.name,
        role: user.role,
      }}
    />
  );
}
