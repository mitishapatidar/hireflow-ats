import React from 'react';
import { getClientOverviewAction } from '@/actions/client-portal';
import { ClientPortalOverviewClientView } from '@/components/client/ClientPortalOverviewClientView';

export const dynamic = 'force-dynamic';

export default async function ClientPortalOverviewPage() {
  const res = await getClientOverviewAction();

  return (
    <ClientPortalOverviewClientView
      initialData={res.success ? res.data! : null}
      error={!res.success ? res.error : null}
    />
  );
}
