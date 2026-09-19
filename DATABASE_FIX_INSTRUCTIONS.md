# Database Schema Fix for Sub-Subagent Pricing

## Problem
The `sub_subagent_package_prices` table is missing required columns:
- `subagent_store_id` - UUID reference to the subagent store
- `base_price` - Decimal field to store the pricing

## Error Messages
```
column sub_subagent_package_prices.subagent_store_id does not exist
Could not find the 'base_price' column of 'sub_subagent_package_prices' in the schema cache
```

## Solution

### Step 1: Run the SQL Migration
Execute the SQL script `FIX_SUB_SUBAGENT_PRICING_SCHEMA.sql` in your Supabase SQL editor:

**Option A: Add Missing Columns (Recommended)**
```sql
ALTER TABLE IF EXISTS sub_subagent_package_prices
ADD COLUMN IF NOT EXISTS subagent_store_id UUID NOT NULL,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10, 2);

ALTER TABLE IF EXISTS sub_subagent_package_prices
ADD CONSTRAINT IF NOT EXISTS sub_subagent_prices_subagent_store_fk
FOREIGN KEY (subagent_store_id) REFERENCES subagent_stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sub_subagent_prices_subagent_store_id 
ON sub_subagent_package_prices(subagent_store_id);
```

**Option B: Full Table Recreation (If Option A fails)**
```sql
-- Backup existing data if any
CREATE TABLE sub_subagent_package_prices_backup AS 
SELECT * FROM sub_subagent_package_prices;

-- Drop the old table
DROP TABLE IF EXISTS sub_subagent_package_prices;

-- Create new table with correct schema
CREATE TABLE sub_subagent_package_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subagent_store_id UUID NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES data_packages(id) ON DELETE CASCADE,
    base_price DECIMAL(10, 2) NOT NULL,
    sell_price DECIMAL(10, 2),
    subagent_minimum_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(subagent_store_id, package_id)
);

-- Create indexes
CREATE INDEX idx_sub_subagent_prices_subagent_store_id 
ON sub_subagent_package_prices(subagent_store_id);

CREATE INDEX idx_sub_subagent_prices_package_id 
ON sub_subagent_package_prices(package_id);
```

### Step 2: Verify the Schema
After running the SQL, verify the table structure:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sub_subagent_package_prices'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (UUID)
- `subagent_store_id` (UUID)
- `package_id` (UUID)
- `base_price` (DECIMAL)
- `sell_price` (DECIMAL, nullable)
- `subagent_minimum_price` (DECIMAL, nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Step 3: Enable Row Level Security (Optional but Recommended)
```sql
ALTER TABLE sub_subagent_package_prices ENABLE ROW LEVEL SECURITY;

-- Allow subagents to view and manage their own pricing
CREATE POLICY "subagent_pricing_policy"
ON sub_subagent_package_prices
FOR ALL
USING (
    subagent_store_id IN (
        SELECT id FROM subagent_stores WHERE user_id = auth.uid()
    )
);
```

### Step 4: Test in Application
1. Go to SubagentDashboard
2. Navigate to "Sub-Subagent Pricing" tab
3. Try setting prices for a network
4. Click "Save Prices"
5. Should see success message (no more database errors)

## Code Changes Made
- Updated `SubSubagentPricesManager.tsx` to use `base_price` column
- Added comprehensive debug logging for troubleshooting
- Ensured all insert statements include required columns

## If Issues Persist
1. Check the browser console for exact error messages
2. Verify the table columns using the SQL query above
3. Check that `subagent_stores` and `data_packages` tables exist
4. Run all three SQL migration options to ensure complete setup
