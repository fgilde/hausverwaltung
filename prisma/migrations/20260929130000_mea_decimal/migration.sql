-- Miteigentumsanteile mit Nachkommastellen (#40). Bestehende Ganzzahlen bleiben unverändert.
-- AlterTable
ALTER TABLE "Owner" ALTER COLUMN "share" SET DEFAULT 1000,
ALTER COLUMN "share" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Property" ALTER COLUMN "meaTotal" SET DEFAULT 1000,
ALTER COLUMN "meaTotal" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "mea" SET DATA TYPE DOUBLE PRECISION;

