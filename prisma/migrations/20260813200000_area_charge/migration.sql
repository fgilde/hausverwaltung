-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "areaAllocationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Charge_areaAllocationId_period_key" ON "Charge"("areaAllocationId", "period");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_areaAllocationId_fkey" FOREIGN KEY ("areaAllocationId") REFERENCES "AreaAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

