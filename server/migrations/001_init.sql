CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'institution_user')),
  institution_code TEXT,
  display_name TEXT,
  disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (role = 'admin' AND institution_code IS NULL) OR
    (role = 'institution_user' AND institution_code IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_code TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  name TEXT NOT NULL,
  id_number TEXT,
  position TEXT NOT NULL DEFAULT 'Full-time',
  payment_method TEXT NOT NULL DEFAULT '匯款',
  bank_code TEXT,
  bank_account TEXT,
  splits JSONB NOT NULL DEFAULT '{}'::jsonb,
  labor_insurance_bracket NUMERIC DEFAULT 0,
  labor_insurance_self_pay NUMERIC DEFAULT 0,
  health_insurance_bracket NUMERIC DEFAULT 0,
  health_dependents NUMERIC DEFAULT 0,
  health_insurance_self_pay NUMERIC DEFAULT 0,
  voluntary_pension_rate NUMERIC DEFAULT 0,
  voluntary_pension_deduction NUMERIC DEFAULT 0,
  dependents_count NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_code, emp_id)
);
CREATE INDEX IF NOT EXISTS employees_institution_idx ON employees(institution_code);

CREATE TABLE IF NOT EXISTS service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_code TEXT NOT NULL,
  period TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  b NUMERIC DEFAULT 0,
  g NUMERIC DEFAULT 0,
  s NUMERIC DEFAULT 0,
  missed NUMERIC DEFAULT 0,
  self_pay NUMERIC DEFAULT 0,
  breakdown JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_code, period, emp_id)
);
CREATE INDEX IF NOT EXISTS service_records_inst_period_idx ON service_records(institution_code, period);

CREATE TABLE IF NOT EXISTS bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_code TEXT NOT NULL,
  period TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  bonus_a NUMERIC DEFAULT 0,
  bonus_c NUMERIC DEFAULT 0,
  bonus_open NUMERIC DEFAULT 0,
  bonus_dev NUMERIC DEFAULT 0,
  bonus_cross NUMERIC DEFAULT 0,
  referral NUMERIC DEFAULT 0,
  mentoring NUMERIC DEFAULT 0,
  fuel NUMERIC DEFAULT 0,
  other NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_code, period, emp_id)
);
CREATE INDEX IF NOT EXISTS bonuses_inst_period_idx ON bonuses(institution_code, period);

CREATE TABLE IF NOT EXISTS deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_code TEXT NOT NULL,
  period TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  withholding_tax NUMERIC DEFAULT 0,
  labor_level NUMERIC DEFAULT 0,
  labor_fee NUMERIC DEFAULT 0,
  health_level NUMERIC DEFAULT 0,
  health_fee NUMERIC DEFAULT 0,
  pension_rate NUMERIC DEFAULT 0,
  pension_fee NUMERIC DEFAULT 0,
  other_deduction NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_code, period, emp_id)
);
CREATE INDEX IF NOT EXISTS deductions_inst_period_idx ON deductions(institution_code, period);

CREATE TABLE IF NOT EXISTS acode_results (
  institution_code TEXT NOT NULL,
  period TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_code, period)
);
