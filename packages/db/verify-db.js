const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('=== HIREFLOW DATABASE INTEGRITY AUDIT ===');
  const orgCount = await prisma.organization.count();
  const userCount = await prisma.user.count();
  const clientCount = await prisma.client.count();
  const contactCount = await prisma.clientContact.count();
  const jobCount = await prisma.job.count();
  const roundCount = await prisma.jobRound.count();
  const candidateCount = await prisma.candidate.count();
  const appCount = await prisma.application.count();
  const interviewCount = await prisma.interview.count();
  const subCount = await prisma.submission.count();
  const offerCount = await prisma.offer.count();
  const placementCount = await prisma.placement.count();
  const auditCount = await prisma.auditLog.count();

  console.log(`✓ Organizations: ${orgCount}`);
  console.log(`✓ Users: ${userCount}`);
  console.log(`✓ Clients: ${clientCount}`);
  console.log(`✓ Client Contacts: ${contactCount}`);
  console.log(`✓ Jobs: ${jobCount}`);
  console.log(`✓ Job Interview Rounds: ${roundCount}`);
  console.log(`✓ Candidates: ${candidateCount}`);
  console.log(`✓ Applications: ${appCount}`);
  console.log(`✓ Interviews: ${interviewCount}`);
  console.log(`✓ Submissions: ${subCount}`);
  console.log(`✓ Offers: ${offerCount}`);
  console.log(`✓ Placements: ${placementCount}`);
  console.log(`✓ Audit Logs: ${auditCount}`);

  // Test deep relational integrity
  const placement = await prisma.placement.findFirst({
    include: {
      application: {
        include: {
          candidate: true,
          job: true,
          offers: true,
        },
      },
      client: true,
    },
  });

  if (placement) {
    const cand = placement.application.candidate;
    const job = placement.application.job;
    const offer = placement.application.offers[0];
    console.log(`\n=== VERIFIED CLOSED PLACEMENT ===`);
    console.log(`Candidate Name : ${cand.name} (${cand.code})`);
    console.log(`Job Mandate    : ${job.title} (${job.code})`);
    console.log(`Client Name    : ${placement.client.legalName}`);
    if (offer) {
      console.log(`Offered Salary : ₹${offer.offeredSalary} INR`);
      console.log(`Offer Status   : ${offer.status}`);
      if (offer.joiningDate) {
        console.log(`Joining Date   : ${offer.joiningDate.toISOString().split('T')[0]}`);
      }
    }
    console.log(`Placement Fee  : ₹${placement.feeAmount} INR`);
    console.log(`Fee Basis      : ${placement.feeBasis}`);
    console.log(`Payment Terms  : ${placement.paymentTerms}`);
    console.log(`Payment Status : ${placement.paymentStatus}`);
  }

  await prisma.$disconnect();
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
