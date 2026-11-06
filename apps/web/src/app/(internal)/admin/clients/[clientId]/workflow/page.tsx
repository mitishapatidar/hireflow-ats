import { redirect } from 'next/navigation';

interface AdminClientWorkflowPageProps {
  params: Promise<{ clientId: string }> | { clientId: string };
}

export default async function AdminClientWorkflowPage({ params }: AdminClientWorkflowPageProps) {
  const resolvedParams = await Promise.resolve(params);
  redirect(`/clients/${resolvedParams.clientId}/workflow`);
}
