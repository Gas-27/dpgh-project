-- Create sub_subagent_package_prices table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sub_subagent_package_prices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    subagent_store_id uuid NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
    package_id uuid NOT NULL REFERENCES data_packages(id) ON DELETE CASCADE,
    base_price numeric(10, 2) NOT NULL DEFAULT 0,
    sell_price numeric(10, 2) NOT NULL DEFAULT 0,
    subagent_minimum_price numeric(10, 2),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(subagent_store_id, package_id)
);

-- Add RLS policies
ALTER TABLE public.sub_subagent_package_prices ENABLE ROW LEVEL SECURITY;

-- Allow subagents to read their own pricing
CREATE POLICY "subagents_can_read_own_pricing"
  ON public.sub_subagent_package_prices
  FOR SELECT
  USING (
    subagent_store_id IN (
      SELECT id FROM subagent_stores 
      WHERE user_id = auth.uid()
    )
  );

-- Allow subagents to update their own pricing
CREATE POLICY "subagents_can_update_own_pricing"
  ON public.sub_subagent_package_prices
  FOR UPDATE
  USING (
    subagent_store_id IN (
      SELECT id FROM subagent_stores 
      WHERE user_id = auth.uid()
    )
  );

-- Allow subagents to insert pricing
CREATE POLICY "subagents_can_insert_pricing"
  ON public.sub_subagent_package_prices
  FOR INSERT
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM subagent_stores 
      WHERE user_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sub_subagent_package_prices_subagent_store_id 
  ON public.sub_subagent_package_prices(subagent_store_id);

CREATE INDEX IF NOT EXISTS idx_sub_subagent_package_prices_package_id 
  ON public.sub_subagent_package_prices(package_id);
