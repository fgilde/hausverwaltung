-- Anhänge eingehender Mails erst manuell übernehmen (#52), Kategorie E-Mail-Anhang (#51)
-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'EMAIL_ANHANG';

-- AlterTable: eigene Datei-Metadaten, Dokument optional
ALTER TABLE "InboundEmailAttachment" ADD COLUMN "name" TEXT,
ADD COLUMN "mime" TEXT,
ADD COLUMN "size" INTEGER,
ADD COLUMN "storageKey" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL;

-- Bestehende Anhänge waren bereits Dokumente: Metadaten übernehmen.
UPDATE "InboundEmailAttachment" a
SET "name" = d."name", "mime" = d."mime", "size" = d."size", "storageKey" = d."storageKey"
FROM "Document" d WHERE d."id" = a."documentId";
DELETE FROM "InboundEmailAttachment" WHERE "storageKey" IS NULL;

ALTER TABLE "InboundEmailAttachment" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "mime" SET NOT NULL,
ALTER COLUMN "size" SET NOT NULL,
ALTER COLUMN "storageKey" SET NOT NULL;
