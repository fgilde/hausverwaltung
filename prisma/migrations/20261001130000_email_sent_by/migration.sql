-- Absender-Benutzer ausgehender Mails (#44)
-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "sentById" TEXT;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
