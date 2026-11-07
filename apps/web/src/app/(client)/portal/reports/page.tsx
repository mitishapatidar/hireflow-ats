import React from 'react';
import { getClientReportsAction } from '@/actions/client-portal';
import { ClientReportsClientView } from '@/components/client/ClientReportsClientView';

export const dynamic = 'force-dynamic';

export default async function ClientReportsPage() {
  const res = await getClientReportsAction();

  const report = res.success && res.data ? res.data : {
    asOf: 'Just now',
    reportingPeriod: 'All Time',
    summary: {
      openPositions: 0,
      profilesSubmitted: 0,
      pendingReview: 0,
      shortlisted: 0,
      interviewsScheduled: 0,
      interviewsCompleted: 0,
      positionsFilled: 0,
    },
    jobProgress: [],
  };

  return <ClientReportsClientView initialReport={report} />;
}
