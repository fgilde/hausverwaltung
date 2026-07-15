-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('GRUNDSTEUER', 'WASSER', 'ENTWAESSERUNG', 'HEIZUNG', 'WARMWASSER', 'AUFZUG', 'STRASSENREINIGUNG', 'MUELL', 'GEBAEUDEREINIGUNG', 'GARTENPFLEGE', 'BELEUCHTUNG', 'SCHORNSTEIN', 'VERSICHERUNG', 'HAUSWART', 'KABEL', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "AllocationMethodDb" AS ENUM ('AREA', 'UNITS', 'PERSONS', 'CONSUMPTION', 'MEA');

-- CreateTable
CREATE TABLE "CostEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "CostType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "AllocationMethodDb" NOT NULL DEFAULT 'AREA',
    "umlagefaehig" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostEntry_tenantId_idx" ON "CostEntry"("tenantId");

-- CreateIndex
CREATE INDEX "CostEntry_propertyId_year_idx" ON "CostEntry"("propertyId", "year");

-- AddForeignKey
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
