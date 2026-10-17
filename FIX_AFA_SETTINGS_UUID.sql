-- Complete AFA Settings Schema Fix (UUID version)
-- This ensures the table has all necessary columns and a default record

-- 1. Get the existing UUID (if any record exists)
-- SELECT id FROM public.afa_settings LIMIT 1;

-- 2. Add missing columns if they don't exist
ALTER TABLE public.afa_settings 
ADD COLUMN IF NOT EXISTS registration_fee NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS package_page_price NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS agent_base_price NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN DEFAULT true;

-- 3. If no record exists, create one with a proper UUID
INSERT INTO public.afa_settings (id, registration_fee, package_page_price, agent_base_price, agent_commission_percent, registration_enabled)
SELECT gen_random_uuid(), 50, 50, 50, 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.afa_settings);

-- 4. Update existing records to have all fields populated
UPDATE public.afa_settings 
SET 
  registration_fee = COALESCE(registration_fee, 50),
  package_page_price = COALESCE(package_page_price, 50),
  agent_base_price = COALESCE(agent_base_price, 50),
  agent_commission_percent = COALESCE(agent_commission_percent, 10),
  registration_enabled = COALESCE(registration_enabled, true),
  updated_at = now();

-- 5. Verify the data (show the first record)
SELECT id, registration_fee, package_page_price, agent_base_price, agent_commission_percent, registration_enabled 
FROM public.afa_settings 
LIMIT 1;
