import React from 'react';
import { getClientPositionsAction } from '@/actions/client-portal';
import { ClientPositionsClientView } from '@/components/client/ClientPositionsClientView';

export const dynamic = 'force-dynamic';

export default async function ClientPortalPositionsPage() {
  const res = await getClientPositionsAction();
  const positions = res.success && res.data ? res.data : [];

  return <ClientPositionsClientView initialPositions={positions} />;
}
