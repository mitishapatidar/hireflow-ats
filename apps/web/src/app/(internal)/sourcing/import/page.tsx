/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { prisma } from '@hireflow/db';
import { getImportBatchesAction } from '@/actions/sourcing';
import { BulkImportClientView } from './BulkImportClientView';

export default async function BulkImportPage() {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER &&
      user.role !== UserRole.RECRUITER)
  ) {
    redirect('/no-permission');
  }

  const [batchesRes, jobs] = await Promise.all([
    getImportBatchesAction(),
    prisma.job.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true, title: true, code: true, location: true },
      orderBy: { title: 'asc' },
    }),
  ]);

  const rawBatches = batchesRes.success ? batchesRes.data : [];
  const batches = rawBatches.map((b) => ({
    id: b.id,
    batchCode: b.batchCode,
    batchName: b.fileName,
    status: b.status,
    totalRecords: b.totalRecords,
    processedRecords: b.processedRecords,
    parsedRecords: b.parsedRecords,
    duplicateRecords: b.duplicateRecords,
    pendingReviewCount: b.pendingReviewCount,
    createdAt: b.createdAt,
  }));

  return (
    <BulkImportClientView
      initialBatches={batches}
      availableJobs={jobs.map((j) => ({ id: j.id, title: j.title, code: j.code, department: j.location || 'General' }))}
      currentUser={{
        id: user.id,
        name: user.name,
        role: user.role,
      }}
    />
  );
}
