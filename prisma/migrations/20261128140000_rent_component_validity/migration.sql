-- Gültigkeit von Mietbestandteilen (#87): ab/bis, beide optional.
-- NULL = seit Vertragsbeginn bzw. unbefristet, bestehende Bestandteile gelten unverändert weiter.
ALTER TABLE "RentComponent" ADD COLUMN "effectiveDate" TIMESTAMP(3);
ALTER TABLE "RentComponent" ADD COLUMN "endDate" TIMESTAMP(3);
