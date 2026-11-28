-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN     "unitTypes" "UnitType"[] DEFAULT ARRAY[]::"UnitType"[];

-- CreateTable
CREATE TABLE "LeaseOccupancy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "persons" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaseOccupancy_tenantId_idx" ON "LeaseOccupancy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseOccupancy_leaseId_validFrom_key" ON "LeaseOccupancy"("leaseId", "validFrom");

-- AddForeignKey
ALTER TABLE "LeaseOccupancy" ADD CONSTRAINT "LeaseOccupancy_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

