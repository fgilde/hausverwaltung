-- Add calendar-month effective dates to recurring rent components.
-- NULL keeps existing components backward-compatible and means "since lease start".
ALTER TABLE "RentComponent" ADD COLUMN "effectiveDate" TIMESTAMP(3);
