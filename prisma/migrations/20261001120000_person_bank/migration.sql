-- Bankverbindung bei Kontakten (#45)
-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "iban" TEXT,
ADD COLUMN     "accountHolder" TEXT;
