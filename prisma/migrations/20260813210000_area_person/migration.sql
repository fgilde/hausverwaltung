-- AlterTable
ALTER TABLE "AreaAllocation" ADD COLUMN     "personId" TEXT;

-- AddForeignKey
ALTER TABLE "AreaAllocation" ADD CONSTRAINT "AreaAllocation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

