-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "referenceNumber" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "hideClientName" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSalaryPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApplicationDraft" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formData" JSONB NOT NULL,
    "resumeKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDraft_token_key" ON "ApplicationDraft"("token");

-- CreateIndex
CREATE INDEX "ApplicationDraft_jobId_idx" ON "ApplicationDraft"("jobId");

-- CreateIndex
CREATE INDEX "ApplicationDraft_token_idx" ON "ApplicationDraft"("token");

-- CreateIndex
CREATE INDEX "ApplicationDraft_expiresAt_idx" ON "ApplicationDraft"("expiresAt");

-- CreateIndex
CREATE INDEX "ApplicationDraft_organizationId_idx" ON "ApplicationDraft"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_referenceNumber_key" ON "Application"("referenceNumber");

-- CreateIndex
CREATE INDEX "Job_isPublished_status_isArchived_idx" ON "Job"("isPublished", "status", "isArchived");

-- AddForeignKey
ALTER TABLE "ApplicationDraft" ADD CONSTRAINT "ApplicationDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraft" ADD CONSTRAINT "ApplicationDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
