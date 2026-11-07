import React from 'react';
import { notFound } from 'next/navigation';
import { getClientSubmissionDetailsAction } from '@/actions/client-portal';
import { ClientSubmissionReviewClientView } from '@/components/client/ClientSubmissionReviewClientView';

export const dynamic = 'force-dynamic';

export default async function ClientSubmissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const res = await getClientSubmissionDetailsAction(params.id);

  if (!res.success || !res.data) {
    notFound();
  }

  return <ClientSubmissionReviewClientView initialData={res.data} />;
}
