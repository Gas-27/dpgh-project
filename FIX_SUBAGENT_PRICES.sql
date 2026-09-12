-- Fix for subagent prices not saving
-- Run this in Supabase SQL Editor

-- 1. Create unique constraint on agent_package_prices if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agent_package_prices_agent_store_id_package_id_key'
  ) THEN
    ALTER TABLE public.agent_package_prices 
    ADD CONSTRAINT agent_package_prices_agent_store_id_package_id_key 
    UNIQUE (agent_store_id, package_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;

-- 2. Create subagent_package_prices table for subagent-specific prices
CREATE TABLE IF NOT EXISTS public.subagent_package_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id uuid NOT NULL REFERENCES public.subagent_stores(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  sell_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(subagent_store_id, package_id)
);

-- 3. Enable RLS
ALTER TABLE public.subagent_package_prices ENABLE ROW LEVEL SECURITY;

-- 4. Create permissive policies
DROP POLICY IF EXISTS "subagent_package_prices_select" ON public.subagent_package_prices;
DROP POLICY IF EXISTS "subagent_package_prices_insert" ON public.subagent_package_prices;
DROP POLICY IF EXISTS "subagent_package_prices_update" ON public.subagent_package_prices;
DROP POLICY IF EXISTS "subagent_package_prices_delete" ON public.subagent_package_prices;

CREATE POLICY "subagent_package_prices_select" ON public.subagent_package_prices FOR SELECT USING (true);
CREATE POLICY "subagent_package_prices_insert" ON public.subagent_package_prices FOR INSERT WITH CHECK (true);
CREATE POLICY "subagent_package_prices_update" ON public.subagent_package_prices FOR UPDATE USING (true);
CREATE POLICY "subagent_package_prices_delete" ON public.subagent_package_prices FOR DELETE USING (true);

-- 5. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subagent_package_prices TO authenticated, anon;

-- 6. Create index for performance
CREATE INDEX IF NOT EXISTS idx_subagent_package_prices_subagent_store_id ON public.subagent_package_prices(subagent_store_id);

-- 7. Set allow_subagent_registration default to false
ALTER TABLE public.agent_stores 
ALTER COLUMN allow_subagent_registration SET DEFAULT false;

-- 8. Update existing NULL values to false
UPDATE public.agent_stores 
SET allow_subagent_registration = false 
WHERE allow_subagent_registration IS NULL;

SELECT 'Database updated successfully!' as status;
