-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "custom" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "custom" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "custom" JSONB NOT NULL DEFAULT '{}';
