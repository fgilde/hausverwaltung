-- CreateEnum
CREATE TYPE "RentComponentType" AS ENUM ('NEBENKOSTEN', 'HEIZKOSTEN', 'STELLPLATZ', 'MODERNISIERUNG', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('STAFFEL', 'INDEX');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('BAR', 'BUERGSCHAFT', 'VERPFAENDET', 'KAUTIONSKONTO');

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "noticePeriodM" INTEGER,
ADD COLUMN     "personCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "RentComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "type" "RentComponentType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "RentComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "newRentCold" DECIMAL(10,2) NOT NULL,
    "indexBase" DECIMAL(8,2),
    "indexNew" DECIMAL(8,2),
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "RentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "type" "DepositType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receivedDate" TIMESTAMP(3),
    "returnedDate" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentComponent_tenantId_idx" ON "RentComponent"("tenantId");

-- CreateIndex
CREATE INDEX "RentComponent_leaseId_idx" ON "RentComponent"("leaseId");

-- CreateIndex
CREATE INDEX "RentAdjustment_tenantId_idx" ON "RentAdjustment"("tenantId");

-- CreateIndex
CREATE INDEX "RentAdjustment_leaseId_idx" ON "RentAdjustment"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_leaseId_key" ON "Deposit"("leaseId");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_idx" ON "Deposit"("tenantId");

-- AddForeignKey
ALTER TABLE "RentComponent" ADD CONSTRAINT "RentComponent_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
