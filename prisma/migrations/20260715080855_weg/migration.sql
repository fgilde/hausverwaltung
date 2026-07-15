-- CreateTable
CREATE TABLE "EconomicPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserve" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reserve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReserveTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reserveId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "ReserveTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EconomicPlan_tenantId_idx" ON "EconomicPlan"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicPlan_propertyId_year_key" ON "EconomicPlan"("propertyId", "year");

-- CreateIndex
CREATE INDEX "Reserve_tenantId_idx" ON "Reserve"("tenantId");

-- CreateIndex
CREATE INDEX "ReserveTransaction_tenantId_idx" ON "ReserveTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "ReserveTransaction_reserveId_idx" ON "ReserveTransaction"("reserveId");

-- AddForeignKey
ALTER TABLE "EconomicPlan" ADD CONSTRAINT "EconomicPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserve" ADD CONSTRAINT "Reserve_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReserveTransaction" ADD CONSTRAINT "ReserveTransaction_reserveId_fkey" FOREIGN KEY ("reserveId") REFERENCES "Reserve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
