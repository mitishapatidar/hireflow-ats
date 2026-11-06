/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { getCommunicationsInboxAction, getTemplatesAction } from '@/actions/communications';
import { CommunicationsClientView } from '@/components/communications/CommunicationsClientView';

export const metadata = {
  title: 'Candidate Communications | HireFlow ATS',
  description: 'Manage unified candidate communication threads across Email, WhatsApp, and SMS.',
};

export default async function CommunicationsPage() {
  const user = await requireAuth();

  // Strict route protection
  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/unauthorized');
  }

  const [inboxRes, templatesRes] = await Promise.all([
    getCommunicationsInboxAction(),
    getTemplatesAction(),
  ]);

  const inboxData = inboxRes.success ? inboxRes.data : { threads: [], stats: { emailUnread: 0, whatsappUnread: 0, totalThreads: 0 } };
  const templates = templatesRes.success ? templatesRes.data || [] : [];

  return (
    <CommunicationsClientView
      initialInboxData={inboxData}
      templates={templates}
    />
  );
}
