import React from 'react';
import { getClientSubmissionsAction } from '@/actions/client-portal';
import { ClientSubmissionsClientView } from '@/components/client/ClientSubmissionsClientView';

export const dynamic = 'force-dynamic';

export default async function SubmittedProfilesPage() {
  const res = await getClientSubmissionsAction();
  const submissions = res.success && res.data ? res.data : [];

  return <ClientSubmissionsClientView initialSubmissions={submissions} />;
}
