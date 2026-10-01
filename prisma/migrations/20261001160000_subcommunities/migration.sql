-- Untergemeinschaften (#42)
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CostType" ADD VALUE 'INSTANDHALTUNG';
ALTER TYPE "CostType" ADD VALUE 'VERWALTUNG';

-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN     "subcommunityId" TEXT;

-- AlterTable
ALTER TABLE "Reserve" ADD COLUMN     "subcommunityId" TEXT;

-- AlterTable
ALTER TABLE "Resolution" ADD COLUMN     "subcommunityId" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "subcommunityId" TEXT;

-- CreateTable
CREATE TABLE "Subcommunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcommunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcommunityPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subcommunityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcommunityPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subcommunity_tenantId_idx" ON "Subcommunity"("tenantId");

-- CreateIndex
CREATE INDEX "Subcommunity_propertyId_idx" ON "Subcommunity"("propertyId");

-- CreateIndex
CREATE INDEX "SubcommunityPlan_tenantId_idx" ON "SubcommunityPlan"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SubcommunityPlan_subcommunityId_year_key" ON "SubcommunityPlan"("subcommunityId", "year");

-- AddForeignKey
ALTER TABLE "Subcommunity" ADD CONSTRAINT "Subcommunity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcommunityPlan" ADD CONSTRAINT "SubcommunityPlan_subcommunityId_fkey" FOREIGN KEY ("subcommunityId") REFERENCES "Subcommunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_subcommunityId_fkey" FOREIGN KEY ("subcommunityId") REFERENCES "Subcommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_subcommunityId_fkey" FOREIGN KEY ("subcommunityId") REFERENCES "Subcommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserve" ADD CONSTRAINT "Reserve_subcommunityId_fkey" FOREIGN KEY ("subcommunityId") REFERENCES "Subcommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_subcommunityId_fkey" FOREIGN KEY ("subcommunityId") REFERENCES "Subcommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

