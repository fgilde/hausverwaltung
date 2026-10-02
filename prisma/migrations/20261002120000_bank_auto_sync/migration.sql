-- Automatische Kontensynchronisierung, höchstens täglich (#54)
-- AlterTable
ALTER TABLE "BankConnector" ADD COLUMN     "autoSync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAutoSyncAt" TIMESTAMP(3);
