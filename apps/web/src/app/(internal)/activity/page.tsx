import React from 'react';
import { getRecruiterDailyActivityAction } from '@/actions/activity';
import { DailyActivityClientView } from '@/components/activity/DailyActivityClientView';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const res = await getRecruiterDailyActivityAction();
  const initialData = res.success ? res.data : null;

  return <DailyActivityClientView initialData={initialData} />;
}
