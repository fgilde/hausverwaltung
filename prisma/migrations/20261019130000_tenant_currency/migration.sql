CREATE TYPE "Currency" AS ENUM ('EUR', 'CZK');

ALTER TABLE "Tenant" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'EUR';

ALTER TABLE "Document" ADD COLUMN "invoiceCurrency" TEXT;
