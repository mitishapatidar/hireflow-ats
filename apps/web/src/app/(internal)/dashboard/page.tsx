import React from 'react';
import { getRecruiterDashboardAction } from '@/actions/dashboard';
import { RecruiterDashboardClientView } from '@/components/dashboard/RecruiterDashboardClientView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const res = await getRecruiterDashboardAction();
  const initialData = res.success ? res.data : null;

  return <RecruiterDashboardClientView initialData={initialData} />;
}
