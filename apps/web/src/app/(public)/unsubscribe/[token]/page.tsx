/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { getPublicUnsubscribeCandidateAction } from '@/actions/campaigns';
import { UnsubscribeClient } from './UnsubscribeClient';

export const metadata = {
  title: 'Manage Email Preferences & Unsubscribe | HireFlow Careers',
  description: '1-click opt-out and marketing communications management.',
};

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const res = await getPublicUnsubscribeCandidateAction(token);

  const candidate = res.success && res.data ? res.data : null;
  const error = !res.success ? res.error : null;

  return (
    <UnsubscribeClient
      token={token}
      candidate={candidate}
      initialError={error || null}
    />
  );
}
