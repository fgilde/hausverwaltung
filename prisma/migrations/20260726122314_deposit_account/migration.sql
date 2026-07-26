-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "interestRate" DECIMAL(5,2);

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
