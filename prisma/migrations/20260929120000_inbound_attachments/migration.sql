-- Anhänge eingehender Mails (#39)
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "imapAttachMaxMb" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "imapAttachments" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "InboundEmailAttachment" (
    "id" TEXT NOT NULL,
    "inboundEmailId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "InboundEmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundEmailAttachment_inboundEmailId_idx" ON "InboundEmailAttachment"("inboundEmailId");

-- AddForeignKey
ALTER TABLE "InboundEmailAttachment" ADD CONSTRAINT "InboundEmailAttachment_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmailAttachment" ADD CONSTRAINT "InboundEmailAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

