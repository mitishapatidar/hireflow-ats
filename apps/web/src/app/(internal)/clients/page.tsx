import React from 'react';
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { getClientsAction } from '@/actions/clients';
import { ClientsClientView } from './ClientsClientView';
import { ClientStatus, UserRole } from '@hireflow/shared';

interface ClientsPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const user = await getCurrentUser();

  const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;
  const statusParam = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const status =
    statusParam && ['ACTIVE', 'PROSPECT', 'INACTIVE'].includes(statusParam)
      ? (statusParam as ClientStatus)
      : 'ALL';
  const ownerId = typeof searchParams.ownerId === 'string' ? searchParams.ownerId : undefined;
  const isArchivedParam = searchParams.isArchived;
  const isArchived =
    isArchivedParam === 'ALL'
      ? ('ALL' as const)
      : isArchivedParam === 'true'
      ? true
      : false;
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1;

  // Run data fetch in parallel
  const [clientsResult, owners] = await Promise.all([
    getClientsAction({
      search,
      status,
      relationshipOwnerId: ownerId,
      isArchived,
      page,
      limit: 15,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    prisma.user.findMany({
      where: user?.organizationId
        ? {
            organizationId: user.organizationId,
            status: 'ACTIVE',
            role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
          }
        : {
            status: 'ACTIVE',
            role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
          },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const clients = clientsResult.success && clientsResult.clients ? clientsResult.clients : [];
  const meta = clientsResult.success && clientsResult.pagination
    ? clientsResult.pagination
    : { page: 1, limit: 15, total: 0, totalPages: 1 };
  const stats = clientsResult.success && clientsResult.stats
    ? clientsResult.stats
    : { activeCount: 0, prospectCount: 0, meetingsCount: 0 };

  return (
    <ClientsClientView
      initialClients={clients}
      initialTotal={meta.total}
      initialPage={meta.page}
      initialLimit={meta.limit}
      initialTotalPages={meta.totalPages}
      stats={stats}
      availableOwners={owners}
      currentUser={user}
      activeFilters={{
        search: search || '',
        status: statusParam || 'ALL',
        relationshipOwnerId: ownerId || '',
        isArchived,
        page,
      }}
    />
  );
}
