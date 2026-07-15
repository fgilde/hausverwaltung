-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "smtpFrom" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPassword" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtpUser" TEXT;
