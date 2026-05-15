-- Add note columns to bonuses table
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS bgs_other_subsidy_note TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS bgs_other_note         TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS cross_area_note        TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS service_bonus_note     TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS quota_dev_note         TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS cert_bonus_note        TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS referral_note          TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS mentoring_note         TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS holiday_bonus_note     TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS other_subsidy_note     TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS other_note             TEXT NOT NULL DEFAULT '';
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS fuel_note              TEXT NOT NULL DEFAULT '';

-- Add note columns to deductions table
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS labor_fee_note             TEXT NOT NULL DEFAULT '';
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS health_fee_note            TEXT NOT NULL DEFAULT '';
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS pension_fee_note           TEXT NOT NULL DEFAULT '';
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS bgs_other_deduction_note   TEXT NOT NULL DEFAULT '';
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS withholding_tax_note       TEXT NOT NULL DEFAULT '';
ALTER TABLE deductions ADD COLUMN IF NOT EXISTS other_deduction_note       TEXT NOT NULL DEFAULT '';
