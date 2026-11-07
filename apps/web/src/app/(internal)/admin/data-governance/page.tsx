import React from 'react';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@hireflow/db';
import { UserRole } from '@hireflow/shared';
import {
  getExportConfigAction,
  getCustomFieldsAction,
  getArchivedCandidatesAction,
  getDownloadPoliciesAction,
  getAuditLogsAction,
} from '@/actions/governance';
import { DataGovernanceClientView } from './DataGovernanceClientView';

export const metadata = {
  title: 'Data Governance & Scoped Exports | HireFlow ATS',
  description: 'Enterprise data governance, custom fields, candidate archive & restore, download policies, and compliance audit trail.',
};

export default async function DataGovernancePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const user = await requireAuth();

  if (user.role !== UserRole.ADMIN) {
    redirect('/dashboard');
  }

  // Parallel fetch for all 5 governance tabs
  const [
    exportConfigRes,
    customFieldsRes,
    archivedCandidatesRes,
    downloadPoliciesRes,
    auditLogsRes,
    clients,
    jobs,
  ] = await Promise.all([
    getExportConfigAction(),
    getCustomFieldsAction('ALL'),
    getArchivedCandidatesAction(),
    getDownloadPoliciesAction(),
    getAuditLogsAction({ page: 1, limit: 25 }),
    prisma.client.findMany({
      where: { organizationId: user.organizationId, isArchived: false },
      select: { id: true, legalName: true, code: true },
      orderBy: { legalName: 'asc' },
    }),
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true, code: true, clientId: true },
      orderBy: { title: 'asc' },
    }),
  ]);

  return (
    <div className="flex-1 w-full min-h-screen bg-slate-50 dark:bg-slate-950">
      <DataGovernanceClientView
        currentUser={user}
        initialTab={searchParams?.tab || 'export'}
        exportConfig={exportConfigRes.data}
        initialCustomFields={customFieldsRes.data}
        initialArchivedCandidates={archivedCandidatesRes.data}
        initialDownloadPolicies={downloadPoliciesRes.data}
        initialAuditLogs={auditLogsRes.data}
        auditLogsMeta={auditLogsRes.meta}
        clients={clients}
        jobs={jobs}
      />
    </div>
  );
}
