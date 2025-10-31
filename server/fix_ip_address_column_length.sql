
-- Increase ip_address column length to accommodate longer hostnames
ALTER TABLE order_change_history 
ALTER COLUMN ip_address TYPE VARCHAR(255);

-- Add comment
COMMENT ON COLUMN order_change_history.ip_address IS 'IP address or hostname (up to 255 characters)';
