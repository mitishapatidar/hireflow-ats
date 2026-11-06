-- AlterEnum
ALTER TYPE "OpportunityStage" ADD VALUE 'MEETING';

-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_clientId_fkey";

-- AlterTable
ALTER TABLE "DailyActivity" ADD COLUMN     "callsMade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailsSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "interviewsCompleted" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "calendarEventId" TEXT,
ADD COLUMN     "calendarProvider" TEXT DEFAULT 'DEMO_MODE',
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "opportunityId" TEXT,
ADD COLUMN     "outcome" TEXT,
ALTER COLUMN "clientId" DROP NOT NULL,
ALTER COLUMN "status" SET NOT NULL;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "companyName" TEXT NOT NULL DEFAULT 'Prospective Client',
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedById" TEXT,
ADD COLUMN     "convertedJobId" TEXT,
ADD COLUMN     "estimatedOpenings" INTEGER DEFAULT 1,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org-aureva-cap',
ADD COLUMN     "primaryContactId" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'New Business Mandate',
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OpportunityHistory" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStage" TEXT,
    "newStage" TEXT,
    "details" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterActivity" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "relatedCandidateId" TEXT,
    "relatedClientId" TEXT,
    "relatedOpportunityId" TEXT,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'DAILY',
    "targetCandidatesSourced" INTEGER NOT NULL DEFAULT 10,
    "targetCalls" INTEGER NOT NULL DEFAULT 20,
    "targetEmails" INTEGER NOT NULL DEFAULT 15,
    "targetSubmissions" INTEGER NOT NULL DEFAULT 3,
    "targetInterviews" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityHistory_opportunityId_idx" ON "OpportunityHistory"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityHistory_createdAt_idx" ON "OpportunityHistory"("createdAt");

-- CreateIndex
CREATE INDEX "RecruiterActivity_actorId_idx" ON "RecruiterActivity"("actorId");

-- CreateIndex
CREATE INDEX "RecruiterActivity_organizationId_idx" ON "RecruiterActivity"("organizationId");

-- CreateIndex
CREATE INDEX "RecruiterActivity_type_idx" ON "RecruiterActivity"("type");

-- CreateIndex
CREATE INDEX "RecruiterActivity_createdAt_idx" ON "RecruiterActivity"("createdAt");

-- CreateIndex
CREATE INDEX "RecruiterTarget_userId_idx" ON "RecruiterTarget"("userId");

-- CreateIndex
CREATE INDEX "RecruiterTarget_organizationId_idx" ON "RecruiterTarget"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterTarget_userId_period_key" ON "RecruiterTarget"("userId", "period");

-- CreateIndex
CREATE INDEX "Meeting_opportunityId_idx" ON "Meeting"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_convertedJobId_key" ON "Opportunity"("convertedJobId");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_idx" ON "Opportunity"("organizationId");

-- CreateIndex
CREATE INDEX "Opportunity_nextFollowUpAt_idx" ON "Opportunity"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Opportunity_isArchived_idx" ON "Opportunity"("isArchived");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_convertedJobId_fkey" FOREIGN KEY ("convertedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityHistory" ADD CONSTRAINT "OpportunityHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterActivity" ADD CONSTRAINT "RecruiterActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterActivity" ADD CONSTRAINT "RecruiterActivity_relatedCandidateId_fkey" FOREIGN KEY ("relatedCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterActivity" ADD CONSTRAINT "RecruiterActivity_relatedClientId_fkey" FOREIGN KEY ("relatedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterActivity" ADD CONSTRAINT "RecruiterActivity_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterTarget" ADD CONSTRAINT "RecruiterTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterTarget" ADD CONSTRAINT "RecruiterTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
