import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getJobsAction, getJobFormMetadataAction } from '@/actions/jobs';
import { JobsClientView } from './JobsClientView';
import { JobStatus, UserRole } from '@hireflow/shared';

interface JobsPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const user = await getCurrentUser();

  const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;
  const statusParam = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const status =
    statusParam && Object.values(JobStatus).includes(statusParam as JobStatus)
      ? (statusParam as JobStatus)
      : undefined;
  const clientId = typeof searchParams.clientId === 'string' ? searchParams.clientId : undefined;
  const ownerId = typeof searchParams.ownerId === 'string' ? searchParams.ownerId : undefined;
  const location = typeof searchParams.location === 'string' ? searchParams.location : undefined;
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1;

  // Run data fetch in parallel
  const [jobsResult, formMetaResult] = await Promise.all([
    getJobsAction({
      search,
      status,
      clientId,
      ownerId,
      location,
      page,
      limit: 15,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    getJobFormMetadataAction(),
  ]);

  const defaultStats = {
    openJobs: 0,
    onHoldJobs: 0,
    filledThisMonth: 0,
    totalJobs: 0,
  };

  const defaultPagination = {
    page: 1,
    limit: 15,
    totalCount: 0,
    totalPages: 1,
  };

  const initialData = jobsResult.success && jobsResult.data
    ? jobsResult.data
    : {
        jobs: [],
        stats: defaultStats,
        pagination: defaultPagination,
      };

  const clients = formMetaResult.success && formMetaResult.data
    ? formMetaResult.data.clients
    : [];

  const recruiters = formMetaResult.success && formMetaResult.data
    ? formMetaResult.data.recruiters
    : [];

  return (
    <JobsClientView
      initialData={initialData}
      clients={clients}
      recruiters={recruiters}
      currentUser={{
        id: user?.id || '',
        name: user?.name || 'Recruiter',
        role: user?.role || UserRole.RECRUITER,
      }}
    />
  );
}
