-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "BankConnector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "privateKeyEnc" TEXT NOT NULL,
    "baseUrl" TEXT,
    "psuType" TEXT NOT NULL DEFAULT 'business',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "aspspName" TEXT NOT NULL,
    "aspspCountry" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "accountUid" TEXT NOT NULL,
    "consentValidUntil" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAuthState" (
    "state" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aspspName" TEXT NOT NULL,
    "aspspCountry" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAuthState_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankConnector_tenantId_key" ON "BankConnector"("tenantId");

-- CreateIndex
CREATE INDEX "BankLink_tenantId_idx" ON "BankLink"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_externalId_key" ON "Payment"("tenantId", "externalId");

-- AddForeignKey
ALTER TABLE "BankConnector" ADD CONSTRAINT "BankConnector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankLink" ADD CONSTRAINT "BankLink_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "BankConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankLink" ADD CONSTRAINT "BankLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

