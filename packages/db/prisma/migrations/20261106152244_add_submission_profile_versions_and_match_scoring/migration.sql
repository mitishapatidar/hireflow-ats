-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubmissionApprovalStatus" ADD VALUE 'APPROVAL_NOT_REQUIRED';
ALTER TYPE "SubmissionApprovalStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "SubmissionApprovalStatus" ADD VALUE 'APPROVAL_INVALIDATED';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "experienceMax" DECIMAL(4,1),
ADD COLUMN     "experienceMin" DECIMAL(4,1),
ADD COLUMN     "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matchDetails" JSONB,
ADD COLUMN     "matchScore" INTEGER,
ADD COLUMN     "sendState" TEXT NOT NULL DEFAULT 'NOT_SENT',
ADD COLUMN     "sentById" TEXT;

-- AlterTable
ALTER TABLE "SubmissionApproval" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "invalidatedAt" TIMESTAMP(3),
ADD COLUMN     "invalidationReason" TEXT,
ADD COLUMN     "isInvalidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profileVersion" INTEGER;

-- CreateTable
CREATE TABLE "SubmissionProfileVersion" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionTag" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "selectedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceHighlights" JSONB,
    "educationHighlights" JSONB,
    "portfolioUrl" TEXT,
    "customSections" JSONB,
    "contentSnapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "changeSummary" TEXT,
    "pdfStoragePath" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionProfileVersion_submissionId_idx" ON "SubmissionProfileVersion"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionProfileVersion_createdById_idx" ON "SubmissionProfileVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionProfileVersion_submissionId_versionNumber_key" ON "SubmissionProfileVersion"("submissionId", "versionNumber");

-- CreateIndex
CREATE INDEX "Submission_isArchived_idx" ON "Submission"("isArchived");

-- AddForeignKey
ALTER TABLE "SubmissionProfileVersion" ADD CONSTRAINT "SubmissionProfileVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionProfileVersion" ADD CONSTRAINT "SubmissionProfileVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
