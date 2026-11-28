-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "costEntryId" TEXT,
ADD COLUMN     "insuranceId" TEXT,
ADD COLUMN     "leaseId" TEXT,
ADD COLUMN     "maintenanceContractId" TEXT,
ADD COLUMN     "ticketId" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_maintenanceContractId_fkey" FOREIGN KEY ("maintenanceContractId") REFERENCES "MaintenanceContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "Insurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_costEntryId_fkey" FOREIGN KEY ("costEntryId") REFERENCES "CostEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

