-- 將 institution_code (單一 TEXT) 改為 institution_codes (TEXT 陣列)，支援機構使用者多機構權限

-- 移除舊的 table-level CHECK 約束
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check;

-- 新增陣列欄位
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_codes TEXT[] NOT NULL DEFAULT '{}';

-- 遷移既有資料：將現有 institution_code 搬入陣列
UPDATE users SET institution_codes = ARRAY[institution_code] WHERE institution_code IS NOT NULL;

-- 移除舊欄位
ALTER TABLE users DROP COLUMN institution_code;

-- 新增約束：admin 不能有機構、institution_user 至少要有一個機構
ALTER TABLE users ADD CONSTRAINT users_institution_check CHECK (
  (role = 'admin' AND institution_codes = '{}') OR
  (role = 'institution_user' AND array_length(institution_codes, 1) >= 1)
);
