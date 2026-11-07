/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { prisma } from '@hireflow/db';
import { getTemplatesAction } from '@/actions/communications';
import { getCampaignAction } from '@/actions/campaigns';
import { CampaignWizardClient } from './CampaignWizardClient';

export const metadata = {
  title: 'Create Bulk Campaign | HireFlow ATS',
  description: 'Audience targeting, message composition, and TRAI DLT compliance wizard.',
};

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const user = await requireAuth();

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/unauthorized');
  }

  const resolvedParams = searchParams || {};
  const draftId = typeof resolvedParams.draftId === 'string' ? resolvedParams.draftId : undefined;

  const [templatesRes, jobs, draftRes] = await Promise.all([
    getTemplatesAction(),
    prisma.job.findMany({
      where: { organizationId: user.organizationId, isArchived: false },
      select: { id: true, title: true, code: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    draftId ? getCampaignAction(draftId) : Promise.resolve(null),
  ]);

  const templates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  const initialDraft = draftRes && draftRes.success ? draftRes.data : null;

  return (
    <CampaignWizardClient
      templates={templates}
      jobs={jobs}
      initialDraft={initialDraft}
    />
  );
}
