import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { UserRole } from '@hireflow/shared';
import { getClientWorkflowAction, getClientWorkflowVersionsAction } from '@/actions/client-workflows';
import { ClientWorkflowClientView } from './ClientWorkflowClientView';

interface ClientWorkflowPageProps {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ version?: string; status?: string }> | { version?: string; status?: string };
}

export default async function ClientWorkflowPage({ params, searchParams }: ClientWorkflowPageProps) {
  const user = await getCurrentUser();
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) {
    redirect('/dashboard');
  }

  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {};
  const clientId = resolvedParams.id;

  const versionParam = resolvedSearchParams.version ? parseInt(resolvedSearchParams.version, 10) : undefined;
  const statusParam = resolvedSearchParams.status;

  const [workflowRes, versionsRes] = await Promise.all([
    getClientWorkflowAction(clientId, versionParam, statusParam),
    getClientWorkflowVersionsAction(clientId),
  ]);

  if (!workflowRes.success || !workflowRes.data) {
    notFound();
  }

  const versions = versionsRes.success && versionsRes.data ? versionsRes.data : [];

  return (
    <ClientWorkflowClientView
      clientId={clientId}
      clientLegalName={workflowRes.data.client.legalName}
      clientCode={workflowRes.data.client.code}
      initialWorkflow={workflowRes.data.workflow}
      hasDraft={workflowRes.data.hasDraft}
      draftId={workflowRes.data.draftId}
      versions={versions}
      currentUser={{
        id: user.id,
        name: user.name,
        role: user.role,
      }}
    />
  );
}
