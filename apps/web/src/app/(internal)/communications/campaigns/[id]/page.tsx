/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { getCampaignAction, getCampaignRecipientsAction } from '@/actions/campaigns';
import { CampaignDetailClient } from './CampaignDetailClient';

export const metadata = {
  title: 'Campaign Details & Delivery Logs | HireFlow ATS',
  description: 'Real-time campaign delivery monitoring, recipient logs, and failure retries.',
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const user = await requireAuth();

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/unauthorized');
  }

  const { id } = params;
  const resolvedSearchParams = searchParams || {};

  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : undefined;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;

  const [campaignRes, recipientsRes] = await Promise.all([
    getCampaignAction(id),
    getCampaignRecipientsAction(id, { page, status, search, limit: 25 }),
  ]);

  if (!campaignRes.success || !campaignRes.data) {
    notFound();
  }

  const campaign = campaignRes.data;
  const recipients = recipientsRes.success && recipientsRes.data ? recipientsRes.data : [];
  const meta = recipientsRes.meta || { total: 0, page: 1, limit: 25, totalPages: 1 };

  return (
    <CampaignDetailClient
      campaign={campaign}
      initialRecipients={recipients}
      meta={meta}
      currentStatus={status || 'ALL'}
      currentSearch={search || ''}
    />
  );
}
