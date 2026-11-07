-- Fix sub_subagent_package_prices table schema
-- This script adds missing columns to the existing table

-- First, check if the table exists and add missing columns
ALTER TABLE IF EXISTS sub_subagent_package_prices
ADD COLUMN IF NOT EXISTS subagent_store_id UUID NOT NULL,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10, 2);

-- If subagent_store_id column already exists but needs a foreign key, add it
ALTER TABLE IF EXISTS sub_subagent_package_prices
ADD CONSTRAINT IF NOT EXISTS sub_subagent_prices_subagent_store_fk
FOREIGN KEY (subagent_store_id) REFERENCES subagent_stores(id) ON DELETE CASCADE;

-- Create an index on subagent_store_id for faster queries
CREATE INDEX IF NOT EXISTS idx_sub_subagent_prices_subagent_store_id 
ON sub_subagent_package_prices(subagent_store_id);

-- If the table doesn't exist, create it with the correct schema
CREATE TABLE IF NOT EXISTS sub_subagent_package_prices (
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
CREATE INDEX IF NOT EXISTS idx_sub_subagent_prices_subagent_store_id 
ON sub_subagent_package_prices(subagent_store_id);

CREATE INDEX IF NOT EXISTS idx_sub_subagent_prices_package_id 
ON sub_subagent_package_prices(package_id);

-- Enable RLS if needed
ALTER TABLE sub_subagent_package_prices ENABLE ROW LEVEL SECURITY;

-- If RLS is enabled, create policies
CREATE POLICY IF NOT EXISTS "Allow subagent to view their sub-subagent prices"
ON sub_subagent_package_prices FOR SELECT
USING (
    subagent_store_id IN (
        SELECT id FROM subagent_stores WHERE user_id = auth.uid()
    )
);

CREATE POLICY IF NOT EXISTS "Allow subagent to update their sub-subagent prices"
ON sub_subagent_package_prices FOR UPDATE
USING (
    subagent_store_id IN (
        SELECT id FROM subagent_stores WHERE user_id = auth.uid()
    )
);

CREATE POLICY IF NOT EXISTS "Allow subagent to insert sub-subagent prices"
ON sub_subagent_package_prices FOR INSERT
WITH CHECK (
    subagent_store_id IN (
        SELECT id FROM subagent_stores WHERE user_id = auth.uid()
    )
);

CREATE POLICY IF NOT EXISTS "Allow subagent to delete their sub-subagent prices"
ON sub_subagent_package_prices FOR DELETE
USING (
    subagent_store_id IN (
        SELECT id FROM subagent_stores WHERE user_id = auth.uid()
    )
);
