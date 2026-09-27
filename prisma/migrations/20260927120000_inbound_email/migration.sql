-- AlterTable (IMAP-Postfach am Mandanten)
ALTER TABLE "Tenant" ADD COLUMN "imapHost" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "imapPort" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "imapUser" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "imapPassword" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "imapSecure" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "imapMailbox" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "lastInboundSyncAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "personId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_tenantId_messageId_key" ON "InboundEmail"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_tenantId_idx" ON "InboundEmail"("tenantId");

-- CreateIndex
CREATE INDEX "InboundEmail_personId_idx" ON "InboundEmail"("personId");

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
