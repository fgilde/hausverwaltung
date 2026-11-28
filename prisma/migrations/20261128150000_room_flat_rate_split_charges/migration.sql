-- AlterEnum
ALTER TYPE "RentComponentType" ADD VALUE 'PAUSCHALE';

-- AlterEnum
ALTER TYPE "UnitType" ADD VALUE 'ZIMMER';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "splitRentCharges" BOOLEAN NOT NULL DEFAULT false;

