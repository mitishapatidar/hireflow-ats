-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "nextStep" TEXT,
ADD COLUMN     "paymentTerms" TEXT DEFAULT 'NET_30',
ADD COLUMN     "relationshipNotes" TEXT;

-- AlterTable
ALTER TABLE "ClientDocument" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "fileSize" INTEGER DEFAULT 0,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mimeType" TEXT DEFAULT 'application/pdf',
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "meetingType" TEXT DEFAULT 'CLIENT_CHECK_IN',
ADD COLUMN     "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "status" TEXT DEFAULT 'SCHEDULED';

-- CreateIndex
CREATE INDEX "ClientDocument_isVerified_idx" ON "ClientDocument"("isVerified");

-- CreateIndex
CREATE INDEX "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");
