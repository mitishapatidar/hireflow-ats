/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@hireflow/db';
import { UserRole } from '@hireflow/shared';
import { getCalendarDataAction } from '@/actions/interviews';
import { InterviewsCalendarClientView } from '@/components/interviews/InterviewsCalendarClientView';

export const metadata = {
  title: 'Interviews & Calendar | HireFlow ATS',
  description: 'Manage candidate interview schedules, panel assignments, and feedback.',
};

export default async function InterviewsPage() {
  const user = await requireAuth();

  // Route protection: Client & Candidate forbidden
  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/unauthorized');
  }

  // Fetch initial calendar data
  const calendarRes = await getCalendarDataAction();

  // Fetch active internal users for panel and task assignments
  const activeUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE', isArchived: false },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });

  const week = calendarRes.success ? calendarRes.data?.week : null;
  const events = calendarRes.success ? calendarRes.data?.events || [] : [];
  const stats = calendarRes.success
    ? calendarRes.data?.stats
    : {
        thisWeek: 0,
        pendingFeedback: 0,
        noShowsThisWeek: 0,
        calendarSync: {
          status: 'SETUP_REQUIRED',
          label: 'Setup required',
          badge: 'Not connected',
        },
      };

  return (
    <InterviewsCalendarClientView
      initialWeek={week}
      initialEvents={events}
      initialStats={stats!}
      users={activeUsers}
    />
  );
}
