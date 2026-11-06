import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  getClientAction,
  getClientCommercialAction,
  getClientContactsAction,
  getClientJobsAction,
  getClientDocumentsAction,
  getClientActivityAction,
} from '@/actions/clients';
import { ClientRecordClientView } from './ClientRecordClientView';
import { UserRole } from '@hireflow/shared';

interface ClientDetailPageProps {
  params: { id: string };
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const user = await getCurrentUser();

  const [
    clientRes,
    commercialRes,
    contactsRes,
    jobsRes,
    documentsRes,
    activityRes,
    owners,
  ] = await Promise.all([
    getClientAction(params.id),
    getClientCommercialAction(params.id),
    getClientContactsAction(params.id),
    getClientJobsAction(params.id),
    getClientDocumentsAction(params.id),
    getClientActivityAction(params.id),
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

  if (!clientRes.success || !clientRes.client) {
    notFound();
  }

  const client = clientRes.client;
  const commercial = commercialRes.success && commercialRes.commercial ? commercialRes.commercial : null;
  const commercialError = !commercialRes.success ? commercialRes.error : null;
  const contacts = contactsRes.success && contactsRes.contacts ? contactsRes.contacts : [];
  const jobs = jobsRes.success && jobsRes.jobs ? jobsRes.jobs : [];
  const documents = documentsRes.success && documentsRes.documents ? documentsRes.documents : [];
  const activity = activityRes.success && activityRes.activity ? activityRes.activity : [];

  return (
    <ClientRecordClientView
      client={client}
      commercial={commercial}
      commercialError={commercialError}
      contacts={contacts}
      jobs={jobs}
      documents={documents}
      activity={activity}
      availableOwners={owners}
      currentUser={user}
    />
  );
}
