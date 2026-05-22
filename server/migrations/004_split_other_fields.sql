-- Split bonus 'other' into other1 (BGS side) and other2 (A碼 side)
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS other1 NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS other2 NUMERIC NOT NULL DEFAULT 0;
-- Migrate existing data: treat old 'other' as BGS side (other1)
UPDATE bonuses SET other1 = other WHERE other IS NOT NULL AND other != 0;

-- Split deduction 'other_deduction' into other_deduction1 (BGS) and other_deduction2 (A碼)
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS other_deduction1 NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS other_deduction2 NUMERIC NOT NULL DEFAULT 0;
-- Migrate existing data: treat old 'other_deduction' as BGS side (other_deduction1)
UPDATE deductions SET other_deduction1 = other_deduction WHERE other_deduction IS NOT NULL AND other_deduction != 0;
