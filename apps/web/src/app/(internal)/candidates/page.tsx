import React from 'react';
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { getCandidatesListAction, getSavedViewsAction } from '@/actions/candidates';
import { CandidatesClientView } from './CandidatesClientView';

interface CandidatesPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const user = await getCurrentUser();

  // Parse search params into filter object
  const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const jobId = typeof searchParams.jobId === 'string' ? searchParams.jobId : undefined;
  const ownerId = typeof searchParams.ownerId === 'string' ? searchParams.ownerId : undefined;
  const location = typeof searchParams.location === 'string' ? searchParams.location : undefined;
  const includeArchived = searchParams.includeArchived === 'true';
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1;
  const sortBy =
    typeof searchParams.sortBy === 'string'
      ? (searchParams.sortBy as 'updatedAt' | 'createdAt' | 'name' | 'experienceYears')
      : 'updatedAt';
  const sortOrder =
    typeof searchParams.sortOrder === 'string'
      ? (searchParams.sortOrder as 'asc' | 'desc')
      : 'desc';

  // Initial fetch with current user scope
  const [candidatesResult, savedViewsResult, jobs, recruiters] = await Promise.all([
    getCandidatesListAction({
      search,
      status,
      jobId,
      ownerId,
      location,
      includeArchived,
      page,
      limit: 15,
      sortBy,
      sortOrder,
    }),
    getSavedViewsAction(),
    prisma.job.findMany({
      where: user?.organizationId ? { organizationId: user.organizationId } : {},
      select: { id: true, title: true, client: { select: { legalName: true } } },
      orderBy: { title: 'asc' },
    }),
    prisma.user.findMany({
      where: user?.organizationId ? { organizationId: user.organizationId, status: 'ACTIVE' } : { status: 'ACTIVE' },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <CandidatesClientView
      initialCandidates={candidatesResult.candidates || []}
      initialTotal={candidatesResult.total || 0}
      initialPage={candidatesResult.page || 1}
      initialLimit={candidatesResult.limit || 15}
      initialTotalPages={candidatesResult.totalPages || 1}
      savedViews={savedViewsResult.views || []}
      availableJobs={jobs.map((j) => ({ id: j.id, title: j.title, clientName: j.client.legalName }))}
      availableRecruiters={recruiters}
      currentUser={user}
      activeFilters={{
        search: search || '',
        status: status || '',
        jobId: jobId || '',
        ownerId: ownerId || '',
        location: location || '',
        includeArchived,
      }}
    />
  );
}
