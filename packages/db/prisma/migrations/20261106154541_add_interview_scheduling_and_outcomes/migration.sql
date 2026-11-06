-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noShowAt" TIMESTAMP(3),
ADD COLUMN     "outcomeNotes" TEXT,
ADD COLUMN     "previousScheduledAt" TIMESTAMP(3),
ADD COLUMN     "reminderConfig" JSONB,
ADD COLUMN     "rescheduleReason" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "InterviewFeedback" ADD COLUMN     "concerns" TEXT,
ADD COLUMN     "strengths" TEXT,
ADD COLUMN     "technicalScore" INTEGER,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "relatedApplicationId" TEXT,
ADD COLUMN     "relatedInterviewId" TEXT;

-- CreateTable
CREATE TABLE "InterviewHistory" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromTime" TIMESTAMP(3),
    "toTime" TIMESTAMP(3),
    "reason" TEXT,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewHistory_interviewId_idx" ON "InterviewHistory"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewHistory_action_idx" ON "InterviewHistory"("action");

-- CreateIndex
CREATE INDEX "Interview_isArchived_idx" ON "Interview"("isArchived");

-- CreateIndex
CREATE INDEX "Task_relatedInterviewId_idx" ON "Task"("relatedInterviewId");

-- CreateIndex
CREATE INDEX "Task_relatedApplicationId_idx" ON "Task"("relatedApplicationId");

-- AddForeignKey
ALTER TABLE "InterviewHistory" ADD CONSTRAINT "InterviewHistory_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
