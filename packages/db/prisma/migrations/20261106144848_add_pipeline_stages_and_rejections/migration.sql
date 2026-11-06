-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionFeedback" TEXT;

-- AlterTable
ALTER TABLE "RejectionReason" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "stageType" "ApplicationStatus" NOT NULL,
    "order" INTEGER NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stage_organizationId_idx" ON "Stage"("organizationId");

-- CreateIndex
CREATE INDEX "Stage_organizationId_isArchived_order_idx" ON "Stage"("organizationId", "isArchived", "order");

-- CreateIndex
CREATE INDEX "Stage_clientId_idx" ON "Stage"("clientId");

-- CreateIndex
CREATE INDEX "Application_jobId_stageId_createdAt_idx" ON "Application"("jobId", "stageId", "createdAt");

-- CreateIndex
CREATE INDEX "RejectionReason_isArchived_idx" ON "RejectionReason"("isArchived");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
