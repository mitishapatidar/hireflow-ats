/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { getTemplatesAction, getTeamSignatureAction } from '@/actions/communications';
import { TemplatesClientView } from '@/components/communications/TemplatesClientView';

export const metadata = {
  title: 'Templates & Team Signature | HireFlow ATS',
  description: 'Manage outreach templates, WhatsApp approvals, and corporate team signatures.',
};

export default async function TemplatesPage() {
  const user = await requireAuth();

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/unauthorized');
  }

  const [templatesRes, signatureRes] = await Promise.all([
    getTemplatesAction(),
    getTeamSignatureAction(),
  ]);

  const templates = templatesRes.success ? templatesRes.data || [] : [];
  const signatureData = signatureRes.success ? signatureRes.data : null;

  return (
    <TemplatesClientView
      initialTemplates={templates}
      initialSignatureData={signatureData}
      currentUserRole={user.role}
    />
  );
}
