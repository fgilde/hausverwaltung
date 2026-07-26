-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('STOERUNG', 'SCHADEN', 'WARTUNG', 'RECHNUNG', 'VERTRAG', 'SONSTIGES');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'WARTEND';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "category" "TicketCategory" NOT NULL DEFAULT 'SONSTIGES',
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "reminderDate" TIMESTAMP(3),
ADD COLUMN     "timeSpentMin" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
