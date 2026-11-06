-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "closingNote" TEXT,
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "employmentType" TEXT DEFAULT 'FULL_TIME',
ADD COLUMN     "pauseReason" TEXT,
ADD COLUMN     "reopenReason" TEXT,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "resumeReason" TEXT;

-- AlterTable
ALTER TABLE "JobRound" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "interviewType" TEXT NOT NULL DEFAULT 'VIDEO',
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "panelMembers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "JobStatusHistory" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "JobReassignmentRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "requestingRecruiterId" TEXT NOT NULL,
    "targetRecruiterId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "JobReassignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobReassignmentRequest_jobId_idx" ON "JobReassignmentRequest"("jobId");

-- CreateIndex
CREATE INDEX "JobReassignmentRequest_requestingRecruiterId_idx" ON "JobReassignmentRequest"("requestingRecruiterId");

-- CreateIndex
CREATE INDEX "JobReassignmentRequest_targetRecruiterId_idx" ON "JobReassignmentRequest"("targetRecruiterId");

-- CreateIndex
CREATE INDEX "JobReassignmentRequest_status_idx" ON "JobReassignmentRequest"("status");

-- CreateIndex
CREATE INDEX "JobRound_isArchived_idx" ON "JobRound"("isArchived");

-- AddForeignKey
ALTER TABLE "JobReassignmentRequest" ADD CONSTRAINT "JobReassignmentRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReassignmentRequest" ADD CONSTRAINT "JobReassignmentRequest_requestingRecruiterId_fkey" FOREIGN KEY ("requestingRecruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReassignmentRequest" ADD CONSTRAINT "JobReassignmentRequest_targetRecruiterId_fkey" FOREIGN KEY ("targetRecruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReassignmentRequest" ADD CONSTRAINT "JobReassignmentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
