-- Gelesen/erledigt im Posteingang (#43)
-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN     "doneAt" TIMESTAMP(3),
ADD COLUMN     "readAt" TIMESTAMP(3);
