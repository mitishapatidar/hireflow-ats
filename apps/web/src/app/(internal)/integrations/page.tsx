/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { getIntegrationsAction } from '@/actions/communications';
import { IntegrationsClientView } from '@/components/communications/IntegrationsClientView';

export const metadata = {
  title: 'Integrations & API Settings | HireFlow ATS',
  description: 'Manage Gmail, Outlook, Meta WhatsApp Cloud API, and SMS integrations.',
};

export default async function IntegrationsPage() {
  const user = await requireAuth();

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/unauthorized');
  }

  const integrationsRes = await getIntegrationsAction();
  const integrations = integrationsRes.success ? integrationsRes.data?.integrations || [] : [];

  return (
    <IntegrationsClientView
      initialIntegrations={integrations}
    />
  );
}
