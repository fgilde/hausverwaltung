-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "areaModel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalArea" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "AreaAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "leaseId" TEXT,
    "label" TEXT,
    "area" DECIMAL(12,2) NOT NULL,
    "pricePerSqm" DECIMAL(10,2),
    "outdoor" BOOLEAN NOT NULL DEFAULT false,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaAllocation_tenantId_idx" ON "AreaAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "AreaAllocation_propertyId_idx" ON "AreaAllocation"("propertyId");

-- AddForeignKey
ALTER TABLE "AreaAllocation" ADD CONSTRAINT "AreaAllocation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAllocation" ADD CONSTRAINT "AreaAllocation_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
