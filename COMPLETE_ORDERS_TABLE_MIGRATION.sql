-- Complete Orders Table Migration for Supabase
-- This script adds all missing columns to the orders table

-- Step 1: Add customer_id column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Add customer_number column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_number VARCHAR(20);

-- Step 3: Add network column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS network VARCHAR(50);

-- Step 4: Add size_gb column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS size_gb INTEGER;

-- Step 5: Add amount column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);

-- Step 6: Add status column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Step 7: Add fulfillment_status column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'pending';

-- Step 8: Add payment_method column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Step 9: Add source column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'web';

-- Step 10: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_network ON orders(network);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Step 11: Enable RLS (Row Level Security) if not already enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Step 12: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;

-- Step 13: Create RLS policy - Users can view only their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT
  USING (customer_id = auth.uid());

-- Step 14: Create RLS policy - Admins can view all orders
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Step 15: Create RLS policy - Users can insert their own orders
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Step 16: Create RLS policy - Admins can update all orders
CREATE POLICY "Admins can update all orders" ON orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Step 17: Create RLS policy - Allow service role to perform admin operations
-- This is needed for Supabase Edge Functions and API routes
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

-- Success message
SELECT 'Orders table migration completed successfully!' as status;
