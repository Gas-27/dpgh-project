-- Fix AFA Settings table to have all necessary columns

-- Add missing columns if they don't exist
ALTER TABLE afa_settings 
ADD COLUMN IF NOT EXISTS registration_fee NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS package_page_price NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS agent_base_price NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN DEFAULT true;

-- Update old column names to match new structure (for migration)
UPDATE afa_settings 
SET registration_fee = bundle_price,
    agent_base_price = bundle_price,
    package_page_price = bundle_price,
    registration_enabled = is_enabled
WHERE registration_fee IS NULL;

-- Verify the updates
SELECT id, registration_fee, package_page_price, agent_base_price, registration_enabled, agent_commission_percent 
FROM afa_settings;
