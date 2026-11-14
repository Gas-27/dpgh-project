-- Complete AFA Settings Schema Fix
-- This ensures the table exists with all necessary columns and has a default record

-- 1. Check if afa_settings table exists, if not create it
CREATE TABLE IF NOT EXISTS public.afa_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  registration_fee NUMERIC(10,2) DEFAULT 50,
  package_page_price NUMERIC(10,2) DEFAULT 50,
  agent_base_price NUMERIC(10,2) DEFAULT 50,
  agent_commission_percent NUMERIC(5,2) DEFAULT 10,
  registration_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add missing columns if they don't exist
ALTER TABLE public.afa_settings 
ADD COLUMN IF NOT EXISTS registration_fee NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS package_page_price NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS agent_base_price NUMERIC(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN DEFAULT true;

-- 3. Ensure there's at least one settings record
INSERT INTO public.afa_settings (id, registration_fee, package_page_price, agent_base_price, agent_commission_percent, registration_enabled)
VALUES (1, 50, 50, 50, 10, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Update existing record to have all fields populated (if id=1 exists but fields are null)
UPDATE public.afa_settings 
SET 
  registration_fee = COALESCE(registration_fee, 50),
  package_page_price = COALESCE(package_page_price, 50),
  agent_base_price = COALESCE(agent_base_price, 50),
  agent_commission_percent = COALESCE(agent_commission_percent, 10),
  registration_enabled = COALESCE(registration_enabled, true),
  updated_at = now()
WHERE id = 1;

-- 5. Verify the data
SELECT * FROM public.afa_settings WHERE id = 1;
