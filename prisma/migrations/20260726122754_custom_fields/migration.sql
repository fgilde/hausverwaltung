-- CreateEnum
CREATE TYPE "CustomFieldEntity" AS ENUM ('PROPERTY', 'UNIT', 'PERSON', 'LEASE');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "custom" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" "CustomFieldEntity" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomFieldDef_tenantId_idx" ON "CustomFieldDef"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_tenantId_entity_key_key" ON "CustomFieldDef"("tenantId", "entity", "key");
