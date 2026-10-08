-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('ENTWURF', 'EINGEREICHT', 'VERSENDET', 'ZUGESTELLT', 'FEHLER');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "epostEkp" TEXT,
ADD COLUMN     "epostPasswordEnc" TEXT,
ADD COLUMN     "epostSecretEnc" TEXT,
ADD COLUMN     "epostTest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "epostVendorId" TEXT,
ADD COLUMN     "pingenClientId" TEXT,
ADD COLUMN     "pingenClientSecretEnc" TEXT,
ADD COLUMN     "pingenOrgId" TEXT,
ADD COLUMN     "pingenStaging" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "documentId" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "options" JSONB,
    "status" "LetterStatus" NOT NULL DEFAULT 'ENTWURF',
    "statusText" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Letter_tenantId_idx" ON "Letter"("tenantId");

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "address" TEXT;

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'BRIEF';
