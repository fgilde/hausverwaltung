-- Kontostand laut Bank (#57)
-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "balance" DECIMAL(14,2),
ADD COLUMN     "balanceAt" TIMESTAMP(3);
