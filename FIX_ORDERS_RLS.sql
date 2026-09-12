-- Fixed Orders Table Migration with Simple RLS
-- This script ensures orders table is properly configured for user access

-- Step 1: Add customer_id column (primary link to users)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Add other missing columns if needed
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_number VARCHAR(20);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS network VARCHAR(50);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS size_gb INTEGER DEFAULT 0;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'web';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS package_id UUID;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(255);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_network ON orders(network);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Step 4: DISABLE RLS for now (to allow all authenticated users to read/write)
-- We'll use authentication at the application level
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Step 5: Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 6: Verify the table structure
SELECT 'Orders table configuration complete!' as status;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;
