-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "visitAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TicketUpdate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "status" "TicketStatus",
    "visitAt" TIMESTAMP(3),
    "message" TEXT,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketUpdate_ticketId_idx" ON "TicketUpdate"("ticketId");

-- AddForeignKey
ALTER TABLE "TicketUpdate" ADD CONSTRAINT "TicketUpdate_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

