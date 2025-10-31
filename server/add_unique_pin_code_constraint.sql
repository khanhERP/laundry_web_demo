
-- Add unique constraint to pin_code column
ALTER TABLE store_settings DROP CONSTRAINT IF EXISTS store_settings_pin_code_unique;

CREATE UNIQUE INDEX IF NOT EXISTS store_settings_pin_code_unique_idx 
ON store_settings (pin_code) 
WHERE pin_code IS NOT NULL AND pin_code != '';
