import React from 'react';
import { getClientInterviewsAction } from '@/actions/client-portal';
import { ClientInterviewsClientView } from '@/components/client/ClientInterviewsClientView';

export const dynamic = 'force-dynamic';

export default async function ClientInterviewsPage() {
  const res = await getClientInterviewsAction();
  const interviews = res.success && res.data ? res.data : [];

  return <ClientInterviewsClientView initialInterviews={interviews} />;
}
