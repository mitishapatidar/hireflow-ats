import React from 'react';
import { getSalesPipelineAction, getClientMeetingsAction } from '@/actions/sales';
import { SalesCrmClientView } from '@/components/sales/SalesCrmClientView';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [pipelineRes, meetingsRes] = await Promise.all([
    getSalesPipelineAction(),
    getClientMeetingsAction(),
  ]);

  const initialPipelineData = pipelineRes.success ? pipelineRes.data : null;
  const initialMeetingsData = meetingsRes.success ? meetingsRes.data : null;

  return (
    <SalesCrmClientView
      initialPipelineData={initialPipelineData}
      initialMeetingsData={initialMeetingsData}
    />
  );
}
