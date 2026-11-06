-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptInAt" TIMESTAMP(3),
ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappOptInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IntegrationAccount" ADD COLUMN     "accountIdentifier" TEXT,
ADD COLUMN     "connectionState" TEXT NOT NULL DEFAULT 'SETUP_REQUIRED',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastRefreshedAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "deliveryStatus" TEXT NOT NULL DEFAULT 'SENT',
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "TeamSignature" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OUTREACH',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "providerApprovalState" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "providerTemplateId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "assignedRecruiterId" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "unreadCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CandidateActivity" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "MessageChannel",
    "direction" "MessageDirection",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateActivity_candidateId_idx" ON "CandidateActivity"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateActivity_type_idx" ON "CandidateActivity"("type");

-- CreateIndex
CREATE INDEX "CandidateActivity_createdAt_idx" ON "CandidateActivity"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationAccount_userId_idx" ON "IntegrationAccount"("userId");

-- CreateIndex
CREATE INDEX "IntegrationAccount_connectionState_idx" ON "IntegrationAccount"("connectionState");

-- CreateIndex
CREATE INDEX "Message_providerMessageId_idx" ON "Message"("providerMessageId");

-- CreateIndex
CREATE INDEX "Message_deliveryStatus_idx" ON "Message"("deliveryStatus");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "Template_status_idx" ON "Template"("status");

-- CreateIndex
CREATE INDEX "Thread_jobId_idx" ON "Thread"("jobId");

-- CreateIndex
CREATE INDEX "Thread_assignedRecruiterId_idx" ON "Thread"("assignedRecruiterId");

-- CreateIndex
CREATE INDEX "Thread_channel_idx" ON "Thread"("channel");

-- CreateIndex
CREATE INDEX "Thread_lastMessageAt_idx" ON "Thread"("lastMessageAt");

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_assignedRecruiterId_fkey" FOREIGN KEY ("assignedRecruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateActivity" ADD CONSTRAINT "CandidateActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
