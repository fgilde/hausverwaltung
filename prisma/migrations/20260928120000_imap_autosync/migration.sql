-- AlterTable (automatischer IMAP-Abruf)
ALTER TABLE "Tenant" ADD COLUMN "imapAutoSync" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "imapSyncIntervalMin" INTEGER NOT NULL DEFAULT 30;
