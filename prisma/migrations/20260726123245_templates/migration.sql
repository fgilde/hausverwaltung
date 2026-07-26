-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('ANSCHREIBEN', 'ABRECHNUNG', 'MAHNUNG', 'VERTRAG', 'PROTOKOLL', 'SONSTIGES');

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL DEFAULT 'ANSCHREIBEN',
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_tenantId_idx" ON "Template"("tenantId");
