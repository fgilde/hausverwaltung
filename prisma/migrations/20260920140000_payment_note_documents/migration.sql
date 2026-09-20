-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "note" TEXT;

-- CreateTable (implizite m2m Payment <-> Document)
CREATE TABLE "_DocumentToPayment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DocumentToPayment_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DocumentToPayment_B_index" ON "_DocumentToPayment"("B");

-- AddForeignKey
ALTER TABLE "_DocumentToPayment" ADD CONSTRAINT "_DocumentToPayment_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentToPayment" ADD CONSTRAINT "_DocumentToPayment_B_fkey" FOREIGN KEY ("B") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
