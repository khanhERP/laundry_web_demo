
-- Create order_change_history table
CREATE TABLE IF NOT EXISTS order_change_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45) NOT NULL,
  user_id INTEGER,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL DEFAULT 'edit',
  detailed_description TEXT NOT NULL,
  store_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_change_history_order_id ON order_change_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_change_history_changed_at ON order_change_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_order_change_history_store_code ON order_change_history(store_code);

-- Add comment to table
COMMENT ON TABLE order_change_history IS 'Stores the history of changes made to orders including who, when, and what was changed';
