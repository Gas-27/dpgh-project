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
-- AFA (Airtime for Airtime) Registration Tables
-- ============================================================================

-- AFA Packages table - Admin manages available AFA packages and base prices
CREATE TABLE IF NOT EXISTS public.afa_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, -- e.g., "Premium AFA", "Standard AFA"
  description text,
  base_price numeric(10,2) NOT NULL, -- Admin base price
  max_price numeric(10,2), -- Optional max price agents can set
  min_price numeric(10,2), -- Optional min price agents can set
  commission_percent numeric(5,2) DEFAULT 10, -- Default commission % for agents
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_afa_packages_active ON public.afa_packages(is_active);

-- Agent AFA Prices - Agents set custom prices per AFA package
CREATE TABLE IF NOT EXISTS public.agent_afa_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id uuid NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  afa_package_id uuid NOT NULL REFERENCES public.afa_packages(id) ON DELETE CASCADE,
  sell_price numeric(10,2) NOT NULL,
  commission_amount numeric(10,2), -- Calculated commission
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(agent_store_id, afa_package_id)
);

CREATE INDEX idx_agent_afa_prices_agent ON public.agent_afa_prices(agent_store_id);
CREATE INDEX idx_agent_afa_prices_package ON public.agent_afa_prices(afa_package_id);

-- Subagent AFA Prices - Subagents set custom prices per AFA package
CREATE TABLE IF NOT EXISTS public.subagent_afa_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id uuid NOT NULL REFERENCES public.subagent_stores(id) ON DELETE CASCADE,
  afa_package_id uuid NOT NULL REFERENCES public.afa_packages(id) ON DELETE CASCADE,
  sell_price numeric(10,2) NOT NULL,
  commission_amount numeric(10,2), -- Calculated commission
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(subagent_store_id, afa_package_id)
);

CREATE INDEX idx_subagent_afa_prices_subagent ON public.subagent_afa_prices(subagent_store_id);
CREATE INDEX idx_subagent_afa_prices_package ON public.subagent_afa_prices(afa_package_id);

-- AFA Registrations - Customer AFA registrations
CREATE TABLE IF NOT EXISTS public.afa_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text NOT NULL,
  customer_id text,
  date_of_birth date,
  town text,
  occupation text,
  region text,
  crop text,
  registration_status text DEFAULT 'pending', -- pending, verified, active, rejected, inactive
  afa_ref_id text, -- Reference ID from AFA provider
  payment_status text DEFAULT 'pending', -- pending, completed, failed
  amount_paid numeric(10,2),
  agent_store_id uuid REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE CASCADE,
  afa_package_id uuid REFERENCES public.afa_packages(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_afa_registrations_customer ON public.afa_registrations(customer_phone);
CREATE INDEX idx_afa_registrations_status ON public.afa_registrations(registration_status);
CREATE INDEX idx_afa_registrations_agent ON public.afa_registrations(agent_store_id);
CREATE INDEX idx_afa_registrations_subagent ON public.afa_registrations(subagent_store_id);

-- Enable RLS on AFA tables
ALTER TABLE public.afa_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_afa_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subagent_afa_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afa_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admin can manage AFA packages
CREATE POLICY "Only admin can view AFA packages"
  ON public.afa_packages FOR SELECT
  USING (true); -- Allow all to view

CREATE POLICY "Only admin can create AFA packages"
  ON public.afa_packages FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admin can update AFA packages"
  ON public.afa_packages FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- RLS Policy: Agents can only manage their own AFA prices
CREATE POLICY "Agents can view their AFA prices"
  ON public.agent_afa_prices FOR SELECT
  USING (
    agent_store_id = (SELECT id FROM public.agent_stores WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Agents can manage their AFA prices"
  ON public.agent_afa_prices FOR INSERT
  WITH CHECK (
    agent_store_id = (SELECT id FROM public.agent_stores WHERE user_id = auth.uid())
  );

-- RLS Policy: Subagents can only manage their own AFA prices
CREATE POLICY "Subagents can view their AFA prices"
  ON public.subagent_afa_prices FOR SELECT
  USING (
    subagent_store_id = (SELECT id FROM public.subagent_stores WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Subagents can manage their AFA prices"
  ON public.subagent_afa_prices FOR INSERT
  WITH CHECK (
    subagent_store_id = (SELECT id FROM public.subagent_stores WHERE user_id = auth.uid())
  );

-- RLS Policy: Users can view their own AFA registrations
CREATE POLICY "Users can view AFA registrations"
  ON public.afa_registrations FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.agent_stores WHERE id = agent_store_id
      UNION
      SELECT user_id FROM public.subagent_stores WHERE id = subagent_store_id
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Anyone can create AFA registrations"
  ON public.afa_registrations FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES - Run these to verify setup
-- ============================================================================

-- Check if AFA tables exist
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'afa_packages' AND table_schema = 'public'
);

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'agent_afa_prices' AND table_schema = 'public'
);

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'afa_registrations' AND table_schema = 'public'
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
