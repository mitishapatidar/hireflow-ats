/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { prisma } from '@hireflow/db';
import { getSourcingQueueAction, getSourcingIntegrationsAction } from '@/actions/sourcing';
import { SourcingClientView } from './SourcingClientView';

interface PageProps {
  searchParams: Promise<{
    source?: string;
    status?: string;
    jobId?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function SourcingPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER &&
      user.role !== UserRole.RECRUITER)
  ) {
    redirect('/no-permission');
  }

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10);
  const source = resolvedParams.source as any;
  const status = resolvedParams.status as any;
  const jobId = resolvedParams.jobId;

  const [queueRes, integrationsRes, jobs] = await Promise.all([
    getSourcingQueueAction({
      source,
      status,
      jobId,
      page,
      limit: 20,
    }),
    getSourcingIntegrationsAction(),
    prisma.job.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true, title: true, code: true, location: true },
      orderBy: { title: 'asc' },
    }),
  ]);

  const queueData = queueRes.success
    ? queueRes.data
    : {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        stats: { total: 0, pendingReview: 0, duplicateFound: 0, approved: 0 },
      };

  const integrations = integrationsRes.success ? integrationsRes.data : [];

  return (
    <SourcingClientView
      initialQueue={queueData as any}
      integrations={integrations}
      availableJobs={jobs.map((j) => ({ id: j.id, title: j.title, code: j.code, department: j.location || 'General' }))}
      currentUser={{
        id: user.id,
        name: user.name,
        role: user.role,
      }}
    />
  );
}
