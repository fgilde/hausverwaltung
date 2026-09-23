-- CreateTable
CREATE TABLE "ImportPreset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportPreset_tenantId_idx" ON "ImportPreset"("tenantId");
