-- ============================================================================
-- COMPLETE SUBAGENT DASHBOARD FIX - SQL
-- Run this COMPLETE SQL in Supabase SQL Editor - ALL AT ONCE
-- ============================================================================

-- STEP 1: Fix auth.users RLS (disable to allow auth system to work)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- STEP 2: Ensure subagent_stores table exists and is properly configured
CREATE TABLE IF NOT EXISTS public.subagent_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_store_id uuid NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  approved boolean DEFAULT false,
  wallet_balance numeric DEFAULT 0,
  momo_number text,
  momo_network text,
  momo_name text,
  whatsapp_number text,
  support_number text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(store_name)
);

-- STEP 3: Drop ALL existing policies on subagent_stores
DROP POLICY IF EXISTS "Anyone can view subagent stores" ON public.subagent_stores;
DROP POLICY IF EXISTS "Agents can manage their subagents" ON public.subagent_stores;
DROP POLICY IF EXISTS "Subagents can view own store" ON public.subagent_stores;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.subagent_stores;
DROP POLICY IF EXISTS "Anyone can insert subagent stores" ON public.subagent_stores;
DROP POLICY IF EXISTS "Anyone can update subagent stores" ON public.subagent_stores;

-- STEP 4: Enable RLS
ALTER TABLE public.subagent_stores ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create SIMPLE, PERMISSIVE policies
CREATE POLICY "subagent_stores_select" ON public.subagent_stores FOR SELECT USING (true);
CREATE POLICY "subagent_stores_insert" ON public.subagent_stores FOR INSERT WITH CHECK (true);
CREATE POLICY "subagent_stores_update" ON public.subagent_stores FOR UPDATE USING (true);
CREATE POLICY "subagent_stores_delete" ON public.subagent_stores FOR DELETE USING (true);

-- STEP 6: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subagent_stores TO authenticated, anon;

-- STEP 7: Ensure user_roles table is properly set up
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- STEP 8: Drop ALL existing policies on user_roles
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;

-- STEP 9: Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- STEP 10: Create SIMPLE, PERMISSIVE policies
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE USING (true);
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE USING (true);

-- STEP 11: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated, anon;

-- STEP 12: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subagent_stores_user_id ON public.subagent_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_subagent_stores_store_name ON public.subagent_stores(store_name);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- STEP 13: Test queries
SELECT 'Testing subagent_stores query:' as test;
SELECT id, store_name, user_id FROM public.subagent_stores LIMIT 5;

SELECT 'Testing user_roles query:' as test;
SELECT user_id, role FROM public.user_roles LIMIT 5;

-- STEP 14: Verify setup
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('subagent_stores', 'user_roles')
ORDER BY tablename;
