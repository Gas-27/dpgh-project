-- ============================================================================
-- DataPlug Supabase Database Setup - Complete SQL Code
-- Run this in your Supabase SQL Editor to set up all required tables
-- ============================================================================

-- 1. Create Complaints Table
-- This table stores all customer complaints from storefront and agent stores
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_type text NOT NULL, -- 'storefront' (from main site) or 'agent' (from agent store)
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_store_id uuid REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE CASCADE,
  customer_number text NOT NULL,
  complaint_title text NOT NULL,
  complaint_details text NOT NULL,
  status text DEFAULT 'pending', -- pending, in-progress, resolved
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX idx_complaints_agent_store ON public.complaints(agent_store_id);
CREATE INDEX idx_complaints_subagent_store ON public.complaints(subagent_store_id);
CREATE INDEX idx_complaints_order ON public.complaints(order_id);
CREATE INDEX idx_complaints_type ON public.complaints(complaint_type);

-- 2. Add subagent_package_prices table (if not exists)
-- This table stores pricing for subagents
CREATE TABLE IF NOT EXISTS public.subagent_package_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id uuid NOT NULL REFERENCES public.subagent_stores(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  sell_price numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(subagent_store_id, package_id)
);

CREATE INDEX idx_subagent_prices_subagent ON public.subagent_package_prices(subagent_store_id);
CREATE INDEX idx_subagent_prices_package ON public.subagent_package_prices(package_id);

-- 3. Enable RLS on complaints table for security
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Allow agents to see complaints from their store
CREATE POLICY "Agents can view complaints from their store"
  ON public.complaints FOR SELECT
  USING (
    (agent_store_id = (SELECT id FROM public.agent_stores WHERE user_id = auth.uid())) OR
    (auth.role() = 'authenticated' AND auth.jwt()->>'role' = 'admin')
  );

-- Allow admins to manage all complaints
CREATE POLICY "Admins can manage all complaints"
  ON public.complaints FOR ALL
  USING (auth.role() = 'authenticated' AND auth.jwt()->>'role' = 'admin');

-- 4. Enable RLS on subagent_package_prices
ALTER TABLE public.subagent_package_prices ENABLE ROW LEVEL SECURITY;

-- Allow subagents to view and edit their prices
CREATE POLICY "Subagents can manage their prices"
  ON public.subagent_package_prices FOR ALL
  USING (
    subagent_store_id = (SELECT id FROM public.subagent_stores WHERE user_id = auth.uid())
  );

-- 5. Verify existing tables have necessary columns
-- Add allow_subagent_registration to agent_stores if not exists
ALTER TABLE public.agent_stores ADD COLUMN IF NOT EXISTS allow_subagent_registration boolean DEFAULT false;

-- Add fulfillment_status to orders if not exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text DEFAULT 'pending';

-- 6. Create view for easier complaint queries with related data
CREATE OR REPLACE VIEW complaints_with_details AS
SELECT 
  c.id,
  c.complaint_type,
  c.order_id,
  c.agent_store_id,
  c.subagent_store_id,
  c.customer_number,
  c.complaint_title,
  c.complaint_details,
  c.status,
  c.created_at,
  c.updated_at,
  o.network,
  o.size_gb,
  o.amount,
  o.fulfillment_status,
  o.created_at as order_created_at,
  ag.store_name as agent_store_name,
  ag.phone_number as agent_phone,
  sa.store_name as subagent_store_name,
  sa.whatsapp_number as subagent_whatsapp
FROM public.complaints c
LEFT JOIN public.orders o ON c.order_id = o.id
LEFT JOIN public.agent_stores ag ON c.agent_store_id = ag.id
LEFT JOIN public.subagent_stores sa ON c.subagent_store_id = sa.id;

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.subagent_package_prices TO authenticated;
GRANT SELECT ON complaints_with_details TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES - Run these to verify setup
-- ============================================================================

-- Check if complaints table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'complaints' AND table_schema = 'public'
);

-- Check if subagent_package_prices table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'subagent_package_prices' AND table_schema = 'public'
);

-- Check if allow_subagent_registration column exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'agent_stores' AND column_name = 'allow_subagent_registration'
);

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you get "permission denied" errors, run this to grant proper permissions:
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- To drop and recreate complaints table (if corrupted):
-- DROP TABLE IF EXISTS public.complaints CASCADE;
-- Then run the CREATE TABLE statement above
