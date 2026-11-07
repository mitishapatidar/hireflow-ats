'use server';

import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';

export interface MobileTodayAgenda {
  recruiterName: string;
  todayDateFormatted: string;
  interviewsCount: number;
  pendingSubmissionsCount: number;
  pendingOffersCount: number;
  interviews: {
    id: string;
    candidateName: string;
    candidatePhone?: string | null;
    jobTitle: string;
    clientName: string;
    timeFormatted: string;
    roundName: string;
    meetingUrl?: string | null;
    status: string;
  }[];
}

export async function getRecruiterTodayAction(): Promise<MobileTodayAgenda> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const now = new Date();

  // Compute today's boundaries in IST (UTC+5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDay = istNow.getUTCDate();

  const startOfDayIst = new Date(Date.UTC(istYear, istMonth, istDay, 0, 0, 0) - istOffsetMs);
  const endOfDayIst = new Date(Date.UTC(istYear, istMonth, istDay, 23, 59, 59, 999) - istOffsetMs);

  const todayDateFormatted = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const orgId = user.organizationId;

  const [todayInterviews, pendingSubmissionsCount, pendingOffersCount] = await Promise.all([
    prisma.interview.findMany({
      where: {
        application: { job: { organizationId: orgId } },
        scheduledAt: { gte: startOfDayIst, lte: endOfDayIst },
      },
      include: {
        round: { select: { name: true, roundOrder: true } },
        application: {
          include: {
            candidate: { select: { id: true, name: true, phone: true } },
            job: {
              select: {
                id: true,
                title: true,
                client: { select: { legalName: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.submission.count({
      where: {
        application: { job: { organizationId: orgId } },
        approvalStatus: 'PENDING_MANAGER_APPROVAL',
      },
    }),
    prisma.offer.count({
      where: {
        organizationId: orgId,
        status: 'RELEASED',
      },
    }),
  ]);

  const formattedInterviews = todayInterviews.map((iv) => {
    const startTime = new Date(iv.scheduledAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    const endTime = new Date(new Date(iv.scheduledAt).getTime() + (iv.duration || 45) * 60000).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    return {
      id: iv.id,
      candidateName: iv.application.candidate.name,
      candidatePhone: iv.application.candidate.phone,
      jobTitle: iv.application.job.title,
      clientName: iv.application.job.client?.legalName || 'Client Mandate',
      timeFormatted: `${startTime} – ${endTime} IST`,
      roundName: iv.round?.name || (iv.round?.roundOrder ? `Round ${iv.round.roundOrder}` : 'Interview Round'),
      meetingUrl: iv.meetingLink,
      status: iv.outcome,
    };
  });

  return {
    recruiterName: user.name || 'Recruiter',
    todayDateFormatted,
    interviewsCount: formattedInterviews.length,
    pendingSubmissionsCount,
    pendingOffersCount,
    interviews: formattedInterviews,
  };
}
