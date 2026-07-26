-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('GEBAEUDE', 'HAFTPFLICHT', 'GLAS', 'ELEMENTAR', 'RECHTSSCHUTZ', 'SONSTIGES');

-- CreateTable
CREATE TABLE "Insurance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "InsuranceType" NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyNo" TEXT,
    "premium" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTax" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "aktenzeichen" TEXT,
    "grundsteuerwert" DECIMAL(14,2),
    "messbetrag" DECIMAL(12,2),
    "hebesatz" DECIMAL(6,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyTax_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Insurance_tenantId_idx" ON "Insurance"("tenantId");

-- CreateIndex
CREATE INDEX "Insurance_propertyId_idx" ON "Insurance"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTax_propertyId_key" ON "PropertyTax"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyTax_tenantId_idx" ON "PropertyTax"("tenantId");

-- AddForeignKey
ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTax" ADD CONSTRAINT "PropertyTax_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
