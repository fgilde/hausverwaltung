-- Unterhaltungen (Threads) für E-Mails (#43)
-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "references" TEXT,
ADD COLUMN     "threadId" TEXT;

-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN     "references" TEXT,
ADD COLUMN     "threadId" TEXT;

-- CreateIndex
CREATE INDEX "EmailMessage_tenantId_threadId_idx" ON "EmailMessage"("tenantId", "threadId");

-- CreateIndex
CREATE INDEX "EmailMessage_tenantId_messageId_idx" ON "EmailMessage"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_tenantId_threadId_idx" ON "InboundEmail"("tenantId", "threadId");
