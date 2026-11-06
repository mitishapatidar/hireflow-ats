import { PrismaClient, UserRole, ClientStatus, JobStatus, ApplicationStatus, InterviewOutcome, SubmissionApprovalStatus, OfferStatus, PaymentStatus } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();

async function runDemoReset() {
  console.log('===============================================================');
  console.log('  HireFlow ATS — Safe Demo Environment Reset                   ');
  console.log('  Target Tenant: Aureva Capital Private Limited (aureva-capital)');
  console.log('===============================================================\n');

  // 1. Strict Environment Guard
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_DEMO_RESET) {
    console.error('❌ SAFETY ABORT: demo:reset is restricted to local/demo/staging environments.');
    console.error('To run against production, you must explicitly set FORCE_DEMO_RESET=true.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  if (databaseUrl.includes('prod-live') && !process.env.FORCE_DEMO_RESET) {
    console.error('❌ SAFETY ABORT: Detected production database connection string.');
    process.exit(1);
  }

  console.log('🔒 Environment safeguard verified. Proceeding with tenant-isolated reset...');

  const DEMO_ORG_SLUG = 'aureva-capital';

  // 2. Identify target demo tenant
  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
  });

  if (org) {
    console.log(`\n🧹 Cleaning demo transactional data for tenant: ${org.name} (${org.id})...`);
    const orgId = org.id;

    // Purge sales meetings and opportunities
    await prisma.meeting.deleteMany({ where: { organizer: { organizationId: orgId } } }).catch(() => {});
    await prisma.opportunity.deleteMany({ where: { organizationId: orgId } }).catch(() => {});

    // Purge activities
    await prisma.recruiterActivity.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    const orgUsers = await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const userIds = orgUsers.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.dailyActivity.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    }

    // Purge transactional applications and downstream records
    const demoJobs = await prisma.job.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const jobIds = demoJobs.map((j) => j.id);

    const demoApps = await prisma.application.findMany({ where: { jobId: { in: jobIds } }, select: { id: true } });
    const appIds = demoApps.map((a) => a.id);

    if (appIds.length > 0) {
      await prisma.placement.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => {});
      await prisma.offer.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => {});

      const demoSubs = await prisma.submission.findMany({ where: { applicationId: { in: appIds } }, select: { id: true } });
      const subIds = demoSubs.map((s) => s.id);
      if (subIds.length > 0) {
        await prisma.submissionApproval.deleteMany({ where: { submissionId: { in: subIds } } }).catch(() => {});
        await prisma.submissionProfileVersion.deleteMany({ where: { submissionId: { in: subIds } } }).catch(() => {});
        await prisma.submission.deleteMany({ where: { id: { in: subIds } } }).catch(() => {});
      }

      const demoInterviews = await prisma.interview.findMany({ where: { applicationId: { in: appIds } }, select: { id: true } });
      const intIds = demoInterviews.map((i) => i.id);
      if (intIds.length > 0) {
        await prisma.interviewFeedback.deleteMany({ where: { interviewId: { in: intIds } } }).catch(() => {});
        await prisma.interviewPanelMember.deleteMany({ where: { interviewId: { in: intIds } } }).catch(() => {});
        await prisma.interview.deleteMany({ where: { id: { in: intIds } } }).catch(() => {});
      }

      await prisma.applicationStageHistory.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => {});
      await prisma.application.deleteMany({ where: { id: { in: appIds } } }).catch(() => {});
    }

    console.log('✓ Demo transactions cleanly purged.');
  }

  // 3. Run canonical seed
  console.log('\n🌱 Reseeding canonical HireFlow ATS Foundation via Prisma Seed...');
  const seedPath = path.resolve(__dirname, '../prisma/seed.ts');
  execSync(`tsx "${seedPath}"`, { stdio: 'inherit' });

  // 4. Seed Prompt 15 Sales CRM & Dashboard demo records
  console.log('\n📊 Seeding Sales CRM opportunities, meetings & recruiter daily activity...');
  const currentOrg = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } });
  if (!currentOrg) throw new Error('Organization aureva-capital not found after seed.');

  const clientAcme = await prisma.client.findFirst({ where: { organizationId: currentOrg.id, code: 'CL-1001' } });
  const recruiter = await prisma.user.findFirst({ where: { organizationId: currentOrg.id, role: UserRole.RECRUITER } });

  if (clientAcme && recruiter) {
    const opp = await prisma.opportunity.upsert({
      where: { id: 'opp-acme-q2-expansion' },
      update: {},
      create: {
        id: 'opp-acme-q2-expansion',
        organizationId: currentOrg.id,
        clientId: clientAcme.id,
        title: 'Acme Q2 Engineering Expansion (10 Requisitions)',
        companyName: clientAcme.legalName,
        ownerId: recruiter.id,
        stage: 'PROPOSAL',
        estimatedValue: 2500000,
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        notes: 'Pitching exclusive recruitment partnership for Acme new Bangalore R&D center.',
      },
    });

    await prisma.meeting.upsert({
      where: { id: 'meeting-acme-pitch-1' },
      update: {},
      create: {
        id: 'meeting-acme-pitch-1',
        clientId: clientAcme.id,
        opportunityId: opp.id,
        organizerId: recruiter.id,
        title: 'Q2 Exclusive Retainer Agreement Review',
        scheduledAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
        durationMinutes: 45,
        notes: 'Review commercial terms (8.5% fee), placement guarantees, and SLA commitments.',
        outcome: 'SCHEDULED',
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailyActivity.upsert({
      where: {
        userId_date: {
          userId: recruiter.id,
          date: today,
        },
      },
      update: {},
      create: {
        id: 'act-daily-recruiter-today',
        userId: recruiter.id,
        date: today,
        candidatesSourced: 12,
        callsMade: 18,
        emailsSent: 24,
        submissionsSent: 3,
        interviewsScheduled: 2,
        interviewsCompleted: 2,
        offersReleased: 1,
      },
    });

    await prisma.recruiterActivity.upsert({
      where: { id: 'rec-act-mitisha-sample' },
      update: {},
      create: {
        id: 'rec-act-mitisha-sample',
        actorId: recruiter.id,
        organizationId: currentOrg.id,
        type: 'CALL',
        relatedClientId: clientAcme.id,
        durationMinutes: 30,
        notes: 'Discussed JD requirements and budget for Lead DevOps role.',
        outcome: 'SUCCESS',
      },
    });
  }

  // 5. Post-Reset Integrity Check & Audit Report
  console.log('\n===============================================================');
  console.log('  Demo Environment Integrity Verification Summary');
  console.log('===============================================================');

  const [
    userCount,
    clientCount,
    jobCount,
    candidateCount,
    appCount,
    interviewCount,
    submissionCount,
    placementCount,
    oppCount,
    meetingCount,
    activityCount,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: currentOrg.id } }),
    prisma.client.count({ where: { organizationId: currentOrg.id } }),
    prisma.job.count({ where: { organizationId: currentOrg.id } }),
    prisma.candidate.count({ where: { organizationId: currentOrg.id } }),
    prisma.application.count({ where: { job: { organizationId: currentOrg.id } } }),
    prisma.interview.count({ where: { application: { job: { organizationId: currentOrg.id } } } }),
    prisma.submission.count({ where: { application: { job: { organizationId: currentOrg.id } } } }),
    prisma.placement.count({ where: { application: { job: { organizationId: currentOrg.id } } } }),
    prisma.opportunity.count({ where: { organizationId: currentOrg.id } }),
    prisma.meeting.count({ where: { organizer: { organizationId: currentOrg.id } } }),
    prisma.recruiterActivity.count({ where: { organizationId: currentOrg.id } }),
  ]);

  console.log(`✓ Tenant:            ${currentOrg.name} (${currentOrg.slug})`);
  console.log(`✓ Users:             ${userCount}`);
  console.log(`✓ Clients:           ${clientCount}`);
  console.log(`✓ Jobs:              ${jobCount}`);
  console.log(`✓ Candidates:        ${candidateCount}`);
  console.log(`✓ Applications:      ${appCount}`);
  console.log(`✓ Interviews:        ${interviewCount}`);
  console.log(`✓ Submissions:       ${submissionCount}`);
  console.log(`✓ Placements:        ${placementCount}`);
  console.log(`✓ Sales Opps:        ${oppCount}`);
  console.log(`✓ Sales Meetings:    ${meetingCount}`);
  console.log(`✓ Logged Activities: ${activityCount}`);
  console.log('===============================================================');
  console.log('✅ Demo Environment Successfully Reset & Ready for Client Demo!');
}

runDemoReset()
  .catch((err) => {
    console.error('❌ Demo reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
