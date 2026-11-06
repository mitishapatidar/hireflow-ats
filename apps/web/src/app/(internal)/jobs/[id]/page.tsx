import React from 'react';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getJobDetailAction, getJobFormMetadataAction } from '@/actions/jobs';
import { JobRecordClientView } from './JobRecordClientView';

interface JobDetailPageProps {
  params: { id: string };
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const [jobResult, metaResult] = await Promise.all([
    getJobDetailAction(params.id),
    getJobFormMetadataAction(),
  ]);

  if (!jobResult.success || !jobResult.data) {
    notFound();
  }

  const clients = metaResult.success && metaResult.data ? metaResult.data.clients : [];
  const recruiters = metaResult.success && metaResult.data ? metaResult.data.recruiters : [];

  return (
    <JobRecordClientView
      job={jobResult.data}
      clients={clients}
      recruiters={recruiters}
      currentUser={{
        id: user.id,
        name: user.name,
        role: user.role,
      }}
    />
  );
}
