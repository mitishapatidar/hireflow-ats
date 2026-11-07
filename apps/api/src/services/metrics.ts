import { prisma } from '@hireflow/db';
import {
  UserRole,
  JobStatus,
  InterviewOutcome,
  OfferStatus,
  PaymentStatus,
  getISTMonthBoundaries,
  getPreviousISTMonthBoundaries,
  getISTWeekBoundaries,
  getISTDayBoundaries,
  calculateMonthOverMonthDelta,
  calculateTargetProgress,
  formatAsOfTimestamp,
  calculateTimeToHire,
  calculateConversionRate,
  calculateOfferAcceptanceRate,
  KpiCardData,
  PipelineStageCount,
  TodayAgendaItem,
  RecentCandidateActivityItem,
  RecruiterDailyActivitySummary,
  RecruitmentOverviewKPIs,
  RecruiterLeaderboardRow,
  ManagerMisData,
  OffersDashboardStats,
} from '@hireflow/shared';

export class MetricsService {
  /**
   * Fetches all real database KPIs, pipeline distribution, today's agenda,
   * and recent candidate activity for the Recruiter Dashboard (Figma Frame 01).
   */
  static async getRecruiterDashboardData(
    userId: string,
    role: UserRole,
    organizationId: string
  ) {
    const isRestrictedRecruiter = role === UserRole.RECRUITER;
    const now = new Date();

    // 1. Time Boundaries
    const currentMonth = getISTMonthBoundaries(now);
    const prevMonth = getPreviousISTMonthBoundaries(now);
    const currentWeek = getISTWeekBoundaries(now);
    const prevWeekRef = new Date(currentWeek.startOfWeekUtc.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeek = getISTWeekBoundaries(prevWeekRef);
    const today = getISTDayBoundaries(now);

    // 2. Active Jobs Count & Delta
    const jobScope = {
      organizationId,
      isArchived: false,
      status: JobStatus.ACTIVE,
      ...(isRestrictedRecruiter ? { ownerId: userId } : {}),
    };

    const [activeJobsCount, prevActiveJobsCount] = await Promise.all([
      prisma.job.count({
        where: jobScope,
      }),
      prisma.job.count({
        where: {
          ...jobScope,
          createdAt: { lte: prevMonth.endUtc },
        },
      }),
    ]);
    const activeJobsDelta = calculateMonthOverMonthDelta(activeJobsCount, prevActiveJobsCount, 'vs last month');

    // 3. Candidates Count & Delta
    const candidateScope = {
      organizationId,
      isArchived: false,
      ...(isRestrictedRecruiter ? { ownerId: userId } : {}),
    };

    const [candidatesCount, prevCandidatesCount] = await Promise.all([
      prisma.candidate.count({
        where: candidateScope,
      }),
      prisma.candidate.count({
        where: {
          ...candidateScope,
          createdAt: { lte: prevMonth.endUtc },
        },
      }),
    ]);
    const candidatesDelta = calculateMonthOverMonthDelta(candidatesCount, prevCandidatesCount, 'vs last month');

    // 4. Interviews This Week & Delta
    const interviewScope = {
      isArchived: false,
      outcome: { not: InterviewOutcome.CANCELLED },
      ...(isRestrictedRecruiter
        ? {
            OR: [
              { application: { job: { ownerId: userId } } },
              { panelMembers: { some: { userId } } },
            ],
          }
        : {}),
    };

    const [interviewsThisWeekCount, prevInterviewsWeekCount] = await Promise.all([
      prisma.interview.count({
        where: {
          ...interviewScope,
          scheduledAt: {
            gte: currentWeek.startOfWeekUtc,
            lte: currentWeek.endOfWeekUtc,
          },
        },
      }),
      prisma.interview.count({
        where: {
          ...interviewScope,
          scheduledAt: {
            gte: prevWeek.startOfWeekUtc,
            lte: prevWeek.endOfWeekUtc,
          },
        },
      }),
    ]);
    const interviewsDelta = calculateMonthOverMonthDelta(
      interviewsThisWeekCount,
      prevInterviewsWeekCount,
      'vs last week'
    );

    // 5. Placements This Month & Delta
    const placementScope = {
      client: { organizationId },
      ...(isRestrictedRecruiter
        ? {
            application: { job: { ownerId: userId } },
          }
        : {}),
    };

    const [placementsThisMonthCount, prevPlacementsMonthCount] = await Promise.all([
      prisma.placement.count({
        where: {
          ...placementScope,
          createdAt: {
            gte: currentMonth.startUtc,
            lte: currentMonth.endUtc,
          },
        },
      }),
      prisma.placement.count({
        where: {
          ...placementScope,
          createdAt: {
            gte: prevMonth.startUtc,
            lte: prevMonth.endUtc,
          },
        },
      }),
    ]);
    const placementsDelta = calculateMonthOverMonthDelta(
      placementsThisMonthCount,
      prevPlacementsMonthCount,
      'vs last month'
    );

    // 6. Pipeline Distribution by Application Status
    const applicationScope = {
      job: {
        organizationId,
        isArchived: false,
        ...(isRestrictedRecruiter ? { ownerId: userId } : {}),
      },
    };

    const applicationCountsByStatus = await prisma.application.groupBy({
      by: ['status'],
      where: applicationScope,
      _count: { id: true },
    });

    const statusCountsMap: Record<string, number> = {};
    let totalApplications = 0;
    applicationCountsByStatus.forEach((g) => {
      statusCountsMap[g.status] = g._count.id;
      totalApplications += g._count.id;
    });

    const stageConfig: Array<{ key: string; name: string; color: string }> = [
      { key: 'SOURCED', name: 'Sourced', color: '#6B7490' },
      { key: 'SCREENING', name: 'Screening', color: '#3B82F6' },
      { key: 'INTERVIEW', name: 'Interview', color: '#5B49D6' },
      { key: 'CLIENT_REVIEW', name: 'Client Review', color: '#F59E0B' },
      { key: 'OFFER', name: 'Offer', color: '#8B5CF6' },
      { key: 'PLACED', name: 'Placed', color: '#12B76A' },
      { key: 'REJECTED', name: 'Rejected', color: '#EF4444' },
    ];

    const pipelineStages: PipelineStageCount[] = stageConfig.map((st) => {
      const count = statusCountsMap[st.key] || 0;
      const percentage = totalApplications > 0 ? Math.round((count / totalApplications) * 100) : 0;
      return {
        stage: st.key,
        displayName: st.name,
        count,
        percentage,
        colorHex: st.color,
      };
    });

    // 7. Today's Agenda (Interviews, Client Meetings, Follow-ups)
    const [todaysInterviews, todaysMeetings, todaysFollowUps] = await Promise.all([
      prisma.interview.findMany({
        where: {
          ...interviewScope,
          scheduledAt: {
            gte: today.startUtc,
            lte: today.endUtc,
          },
        },
        include: {
          application: {
            include: {
              candidate: true,
              job: true,
            },
          },
          round: true,
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
      prisma.meeting.findMany({
        where: {
          organizerId: userId,
          scheduledAt: {
            gte: today.startUtc,
            lte: today.endUtc,
          },
        },
        include: {
          client: true,
          opportunity: true,
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
      prisma.opportunity.findMany({
        where: {
          ownerId: userId,
          isArchived: false,
          nextFollowUpAt: {
            gte: today.startUtc,
            lte: today.endUtc,
          },
        },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 5,
      }),
    ]);

    const todayAgenda: TodayAgendaItem[] = [
      ...todaysInterviews.map((iv) => {
        const istHours = new Date(iv.scheduledAt.getTime() + 5.5 * 60 * 60 * 1000);
        const timeStr = `${istHours.getUTCHours().toString().padStart(2, '0')}:${istHours
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')} IST`;

        return {
          id: iv.id,
          timeIST: timeStr,
          title: iv.round?.name || 'Candidate Interview',
          counterpartName: iv.application.candidate.name,
          relatedJobOrMandate: iv.application.job.title,
          eventType: 'INTERVIEW' as const,
          status: iv.outcome,
        };
      }),
      ...todaysMeetings.map((m) => {
        const istHours = new Date(m.scheduledAt.getTime() + 5.5 * 60 * 60 * 1000);
        const timeStr = `${istHours.getUTCHours().toString().padStart(2, '0')}:${istHours
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')} IST`;

        return {
          id: m.id,
          timeIST: timeStr,
          title: m.title,
          counterpartName: m.contactName || m.client?.legalName || 'Client Prospect',
          relatedJobOrMandate: m.opportunity?.title || 'Client Meeting',
          eventType: 'CLIENT_MEETING' as const,
          status: m.status,
        };
      }),
      ...todaysFollowUps.map((op) => {
        return {
          id: op.id,
          timeIST: 'Due Today',
          title: `Follow-up: ${op.title}`,
          counterpartName: op.companyName,
          relatedJobOrMandate: op.stage,
          eventType: 'FOLLOW_UP' as const,
          status: 'PENDING',
        };
      }),
    ];

    // 8. Recent Candidate Activity
    const recentActivities = await prisma.candidateActivity.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { name: true } },
      },
      take: 8,
    });

    const recentActivityItems: RecentCandidateActivityItem[] = recentActivities.map((act) => {
      const diffMs = Date.now() - act.createdAt.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      let timeAgo = `${diffMins}m ago`;
      if (diffMins > 60) {
        const diffHours = Math.floor(diffMins / 60);
        timeAgo = `${diffHours}h ago`;
        if (diffHours > 24) {
          timeAgo = `${Math.floor(diffHours / 24)}d ago`;
        }
      }

      return {
        id: act.id,
        actorName: 'Recruiter',
        action: act.title,
        recordTitle: act.candidate.name,
        timeAgo,
        createdAt: act.createdAt.toISOString(),
      };
    });

    return {
      kpiCards: {
        activeJobs: {
          title: 'Active Jobs',
          value: activeJobsCount,
          delta: activeJobsDelta,
          metricKey: 'activeJobs',
        },
        candidates: {
          title: 'Candidates',
          value: candidatesCount,
          delta: candidatesDelta,
          metricKey: 'candidates',
        },
        interviewsThisWeek: {
          title: 'Interviews This Week',
          value: interviewsThisWeekCount,
          delta: interviewsDelta,
          metricKey: 'interviewsThisWeek',
        },
        placementsThisMonth: {
          title: 'Placements This Month',
          value: placementsThisMonthCount,
          delta: placementsDelta,
          metricKey: 'placementsThisMonth',
        },
      },
      pipelineDistribution: {
        stages: pipelineStages,
        totalApplications,
      },
      todayAgenda,
      recentActivity: recentActivityItems,
      asOfTimestamp: formatAsOfTimestamp(now),
    };
  }

  /**
   * Aggregates real recruiter daily activity vs targets (Figma Frame 39).
   */
  static async getRecruiterDailyActivityData(
    userId: string,
    role: UserRole,
    organizationId: string,
    targetDate: Date = new Date()
  ): Promise<RecruiterDailyActivitySummary> {
    const today = getISTDayBoundaries(targetDate);

    // 1. Fetch or create user targets
    let target = await prisma.recruiterTarget.findFirst({
      where: { userId, period: 'DAILY' },
    });

    if (!target) {
      target = {
        id: 'default-target',
        userId,
        organizationId,
        period: 'DAILY',
        targetCandidatesSourced: 10,
        targetCalls: 20,
        targetEmails: 15,
        targetSubmissions: 3,
        targetInterviews: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // 2. Real counts for today
    const [
      candidatesSourcedCount,
      callsMadeCount,
      emailsSentCount,
      submissionsSentCount,
      interviewsCompletedCount,
    ] = await Promise.all([
      // Candidates Sourced by user today
      prisma.candidate.count({
        where: {
          createdById: userId,
          createdAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      // Calls logged today
      prisma.recruiterActivity.count({
        where: {
          actorId: userId,
          type: 'CALL',
          createdAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      // Emails sent today (exclude DRAFT and FAILED)
      prisma.message.count({
        where: {
          createdById: userId,
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          deliveryStatus: { notIn: ['DRAFT', 'FAILED'] },
          sentAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      // Submissions sent today
      prisma.submission.count({
        where: {
          createdById: userId,
          createdAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
      // Interviews completed today
      prisma.interview.count({
        where: {
          outcome: InterviewOutcome.COMPLETED,
          OR: [
            { createdById: userId },
            { panelMembers: { some: { userId } } },
          ],
          updatedAt: { gte: today.startUtc, lte: today.endUtc },
        },
      }),
    ]);

    const sourcedProgress = calculateTargetProgress(
      candidatesSourcedCount,
      target.targetCandidatesSourced
    );
    const callsProgress = calculateTargetProgress(callsMadeCount, target.targetCalls);
    const emailsProgress = calculateTargetProgress(emailsSentCount, target.targetEmails);
    const submissionsProgress = calculateTargetProgress(
      submissionsSentCount,
      target.targetSubmissions
    );
    const interviewsProgress = calculateTargetProgress(
      interviewsCompletedCount,
      target.targetInterviews
    );

    const overallScore = Math.round(
      (sourcedProgress.progressPercentage +
        callsProgress.progressPercentage +
        emailsProgress.progressPercentage +
        submissionsProgress.progressPercentage +
        interviewsProgress.progressPercentage) /
        5
    );

    return {
      asOfTimestamp: formatAsOfTimestamp(new Date()),
      candidatesSourced: sourcedProgress,
      callsMade: callsProgress,
      emailsSent: emailsProgress,
      submissionsSent: submissionsProgress,
      interviewsCompleted: interviewsProgress,
      overallScorePercentage: overallScore,
    };
  }

  /**
   * Fetches real live statistics for the Offers & Placements Dashboard (Frame 08).
   */
  static async getOffersDashboardData(
    userId: string,
    role: UserRole,
    organizationId: string
  ): Promise<OffersDashboardStats> {
    const isRestrictedRecruiter = role === UserRole.RECRUITER;
    const now = new Date();
    const currentMonth = getISTMonthBoundaries(now);
    const prevMonth = getPreviousISTMonthBoundaries(now);

    const baseOfferScope: any = {
      organizationId,
      ...(isRestrictedRecruiter ? { application: { job: { ownerId: userId } } } : {}),
    };

    const [
      releasedMtd,
      prevReleased,
      acceptedMtd,
      pendingOffers,
      placementsMtd,
    ] = await Promise.all([
      // 1. Released MTD
      prisma.offer.count({
        where: {
          ...baseOfferScope,
          status: { in: [OfferStatus.RELEASED, OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.JOINED] },
          releaseDate: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
        },
      }),
      // 2. Released Prev Month
      prisma.offer.count({
        where: {
          ...baseOfferScope,
          status: { in: [OfferStatus.RELEASED, OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.JOINED] },
          releaseDate: { gte: prevMonth.startUtc, lte: prevMonth.endUtc },
        },
      }),
      // 3. Accepted MTD
      prisma.offer.count({
        where: {
          ...baseOfferScope,
          status: { in: [OfferStatus.ACCEPTED, OfferStatus.JOINED] },
          acceptedAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
        },
      }),
      // 4. Pending Offers (Awaiting response)
      prisma.offer.count({
        where: {
          ...baseOfferScope,
          status: { in: [OfferStatus.RELEASED, OfferStatus.SENT] },
        },
      }),
      // 5. Placements MTD (strictly JOINED / placed)
      prisma.placement.findMany({
        where: {
          organizationId,
          ...(isRestrictedRecruiter ? { application: { job: { ownerId: userId } } } : {}),
          createdAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
        },
        select: { feeAmount: true },
      }),
    ]);

    const releasedDelta = calculateMonthOverMonthDelta(releasedMtd, prevReleased, 'vs last month');
    const acceptedRate = calculateConversionRate(acceptedMtd, releasedMtd);
    const totalPlacementFeeMtd = placementsMtd.reduce((sum, p) => sum + Number(p.feeAmount), 0);

    return {
      releasedMtd,
      releasedDelta,
      acceptedMtd,
      acceptedRate,
      pendingOffers,
      confirmedPlacementsMtd: placementsMtd.length,
      totalPlacementFeeMtd,
      asOfTimestamp: formatAsOfTimestamp(now),
    };
  }

  /**
   * Fetches the 4 high-level recruitment efficiency metrics for Reports (Frame 10).
   */
  static async getRecruitmentOverviewKPIs(
    userId: string,
    role: UserRole,
    organizationId: string
  ): Promise<RecruitmentOverviewKPIs> {
    const isRestrictedRecruiter = role === UserRole.RECRUITER;
    const now = new Date();
    const currentMonth = getISTMonthBoundaries(now);
    const prevMonth = getPreviousISTMonthBoundaries(now);

    const baseAppScope: any = {
      job: {
        organizationId,
        ...(isRestrictedRecruiter ? { ownerId: userId } : {}),
      },
    };

    // Parallel fetch for current and previous month cohorts
    const [
      joinedCurrent,
      joinedPrev,
      submissionsCurrent,
      submissionsPrev,
      interviewedCurrent,
      interviewedPrev,
      offersCurrent,
      offersPrev,
      offersAcceptedCurrent,
      offersAcceptedPrev,
    ] = await Promise.all([
      // Current Joined Applications (for Time to Hire)
      prisma.application.findMany({
        where: {
          ...baseAppScope,
          status: 'PLACED',
          updatedAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
        },
        select: { createdAt: true, updatedAt: true },
      }),
      // Prev Joined Applications
      prisma.application.findMany({
        where: {
          ...baseAppScope,
          status: 'PLACED',
          updatedAt: { gte: prevMonth.startUtc, lte: prevMonth.endUtc },
        },
        select: { createdAt: true, updatedAt: true },
      }),
      // Submissions
      prisma.submission.count({
        where: {
          application: baseAppScope,
          createdAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
        },
      }),
      prisma.submission.count({
        where: {
          application: baseAppScope,
          createdAt: { gte: prevMonth.startUtc, lte: prevMonth.endUtc },
        },
      }),
      // Submissions that converted to Interview
      prisma.interview.count({
        where: {
          application: baseAppScope,
          createdAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
        },
      }),
      prisma.interview.count({
        where: {
          application: baseAppScope,
          createdAt: { gte: prevMonth.startUtc, lte: prevMonth.endUtc },
        },
      }),
      // Offers Released
      prisma.offer.count({
        where: {
          organizationId,
          releaseDate: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
          ...(isRestrictedRecruiter ? { application: { job: { ownerId: userId } } } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          organizationId,
          releaseDate: { gte: prevMonth.startUtc, lte: prevMonth.endUtc },
          ...(isRestrictedRecruiter ? { application: { job: { ownerId: userId } } } : {}),
        },
      }),
      // Offers Accepted
      prisma.offer.count({
        where: {
          organizationId,
          status: { in: [OfferStatus.ACCEPTED, OfferStatus.JOINED] },
          acceptedAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
          ...(isRestrictedRecruiter ? { application: { job: { ownerId: userId } } } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          organizationId,
          status: { in: [OfferStatus.ACCEPTED, OfferStatus.JOINED] },
          acceptedAt: { gte: prevMonth.startUtc, lte: prevMonth.endUtc },
          ...(isRestrictedRecruiter ? { application: { job: { ownerId: userId } } } : {}),
        },
      }),
    ]);

    // 1. Time to Hire
    const timeToHireDays = calculateTimeToHire(
      joinedCurrent.map(a => ({ createdAt: a.createdAt, joinedAt: a.updatedAt }))
    );
    const prevTimeToHireDays = calculateTimeToHire(
      joinedPrev.map(a => ({ createdAt: a.createdAt, joinedAt: a.updatedAt }))
    );
    const timeToHireDelta = calculateMonthOverMonthDelta(timeToHireDays, prevTimeToHireDays, 'vs last month');

    // 2. Submission to Interview Conversion
    const subToInterviewRate = calculateConversionRate(interviewedCurrent, submissionsCurrent);
    const prevSubToInterviewRate = calculateConversionRate(interviewedPrev, submissionsPrev);
    const subToInterviewDelta = calculateMonthOverMonthDelta(subToInterviewRate, prevSubToInterviewRate, 'vs last month');

    // 3. Interview to Offer Conversion
    const interviewToOfferRate = calculateConversionRate(offersCurrent, interviewedCurrent);
    const prevInterviewToOfferRate = calculateConversionRate(offersPrev, interviewedPrev);
    const interviewToOfferDelta = calculateMonthOverMonthDelta(interviewToOfferRate, prevInterviewToOfferRate, 'vs last month');

    // 4. Offer Acceptance Rate
    const offerAcceptanceRate = calculateConversionRate(offersAcceptedCurrent, offersCurrent);
    const prevOfferAcceptanceRate = calculateConversionRate(offersAcceptedPrev, offersPrev);
    const offerAcceptanceDelta = calculateMonthOverMonthDelta(offerAcceptanceRate, prevOfferAcceptanceRate, 'vs last month');

    return {
      asOfTimestamp: formatAsOfTimestamp(now),
      timeToHireDays,
      timeToHireDelta,
      submissionToInterviewRate: subToInterviewRate,
      submissionToInterviewDelta: subToInterviewDelta,
      interviewToOfferRate,
      interviewToOfferDelta,
      offerAcceptanceRate,
      offerAcceptanceDelta,
    };
  }

  /**
   * Recruiter Leaderboard & MIS Analytics
   */
  static async getRecruiterLeaderboard(organizationId: string): Promise<RecruiterLeaderboardRow[]> {
    const recruiters = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [UserRole.RECRUITER, UserRole.MANAGER] },
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    const currentMonth = getISTMonthBoundaries(now);

    const rows: RecruiterLeaderboardRow[] = await Promise.all(
      recruiters.slice(0, 10).map(async (r) => {
        const [
          candidatesSourced,
          submissionsSent,
          interviewsCompleted,
          offersReleased,
          offersAccepted,
          confirmedPlacements,
        ] = await Promise.all([
          prisma.candidate.count({
            where: { createdById: r.id, createdAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc } },
          }),
          prisma.submission.count({
            where: { createdById: r.id, createdAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc } },
          }),
          prisma.interview.count({
            where: {
              outcome: InterviewOutcome.COMPLETED,
              OR: [{ createdById: r.id }, { panelMembers: { some: { userId: r.id } } }],
              updatedAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
            },
          }),
          prisma.offer.count({
            where: {
              application: { job: { ownerId: r.id } },
              releaseDate: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
            },
          }),
          prisma.offer.count({
            where: {
              application: { job: { ownerId: r.id } },
              status: { in: [OfferStatus.ACCEPTED, OfferStatus.JOINED] },
              acceptedAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
            },
          }),
          prisma.placement.count({
            where: {
              application: { job: { ownerId: r.id } },
              createdAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
            },
          }),
        ]);

        const conversionRate = calculateConversionRate(confirmedPlacements, submissionsSent);
        const targetAttainment = Math.min(100, Math.round((confirmedPlacements / 2) * 100));

        return {
          recruiterId: r.id,
          recruiterName: r.name,
          email: r.email,
          candidatesSourced,
          submissionsSent,
          interviewsCompleted,
          offersReleased,
          offersAccepted,
          confirmedPlacements,
          conversionRatePercentage: conversionRate,
          targetAttainmentPercentage: targetAttainment,
        };
      })
    );

    return rows.sort((a, b) => b.confirmedPlacements - a.confirmedPlacements || b.submissionsSent - a.submissionsSent);
  }

  /**
   * Manager MIS Data aggregation
   */
  static async getManagerMisData(
    managerId: string,
    role: UserRole,
    organizationId: string
  ): Promise<ManagerMisData> {
    const leaderboard = await this.getRecruiterLeaderboard(organizationId);
    const currentMonth = getISTMonthBoundaries(new Date());

    const totalPlacements = leaderboard.reduce((sum, r) => sum + r.confirmedPlacements, 0);
    const totalSourced = leaderboard.reduce((sum, r) => sum + r.candidatesSourced, 0);
    const totalSubmissions = leaderboard.reduce((sum, r) => sum + r.submissionsSent, 0);
    const totalInterviews = leaderboard.reduce((sum, r) => sum + r.interviewsCompleted, 0);
    const totalOffers = leaderboard.reduce((sum, r) => sum + r.offersReleased, 0);

    const placements = await prisma.placement.findMany({
      where: {
        organizationId,
        createdAt: { gte: currentMonth.startUtc, lte: currentMonth.endUtc },
      },
      select: { feeAmount: true },
    });
    const teamFeeTotal = placements.reduce((sum, p) => sum + Number(p.feeAmount), 0);

    return {
      asOfTimestamp: formatAsOfTimestamp(new Date()),
      periodLabel: currentMonth.label,
      teamSourcedTotal: totalSourced,
      teamSubmissionsTotal: totalSubmissions,
      teamInterviewsTotal: totalInterviews,
      teamOffersTotal: totalOffers,
      teamPlacementsTotal: totalPlacements,
      teamFeeTotal,
      recruiters: leaderboard,
    };
  }
}
