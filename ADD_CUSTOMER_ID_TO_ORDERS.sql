-- Add customer_id column to orders table if it doesn't exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Update existing orders with customer_id from order metadata if needed
-- This assumes there's a way to match orders to users
UPDATE orders
SET customer_id = auth.uid()
WHERE customer_id IS NULL
  AND id IN (SELECT id FROM orders WHERE created_at > NOW() - INTERVAL '24 hours');

-- Ensure RLS policies include customer_id
-- Users can view only their own orders
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (customer_id = auth.uid());

-- Allow admins to view all orders
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_permissions 
      WHERE user_id = auth.uid()
    )
  );
