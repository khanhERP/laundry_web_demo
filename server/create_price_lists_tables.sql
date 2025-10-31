
-- Create price_lists table
CREATE TABLE IF NOT EXISTS price_lists (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_to TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create price_list_items table
CREATE TABLE IF NOT EXISTS price_list_items (
  id SERIAL PRIMARY KEY,
  price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(price_list_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_price_lists_code ON price_lists(code);
CREATE INDEX IF NOT EXISTS idx_price_lists_is_active ON price_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_price_lists_is_default ON price_lists(is_default);
CREATE INDEX IF NOT EXISTS idx_price_list_items_price_list_id ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product_id ON price_list_items(product_id);

COMMENT ON TABLE price_lists IS 'Quản lý bảng giá';
COMMENT ON TABLE price_list_items IS 'Chi tiết sản phẩm trong bảng giá';
