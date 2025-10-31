
-- Add customerId column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Update existing orders to link with customers based on phone number
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_phone IS NOT NULL 
  AND c.phone IS NOT NULL
  AND o.customer_phone = c.phone
  AND o.customer_id IS NULL;
