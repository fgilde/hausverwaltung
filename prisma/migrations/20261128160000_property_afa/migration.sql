-- Steuer (#103): AfA-Angaben am Objekt, Kostenart Schuldzinsen.
-- AlterEnum
ALTER TYPE "CostType" ADD VALUE 'SCHULDZINSEN';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "afaBasis" DECIMAL(14,2),
ADD COLUMN     "afaDegressive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "afaRate" DECIMAL(5,2),
ADD COLUMN     "afaStart" TIMESTAMP(3),
ADD COLUMN     "buildYear" INTEGER;

