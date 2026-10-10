-- =====================================================
-- COMPLETE SQL FIX FOR SPECIAL MTN MASHUP
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- ======================
-- FIX 1: AGENT PERMISSIONS
-- ======================
-- Drop old policies on agent_special_mtn_mashup_pricing
DROP POLICY IF EXISTS "agents_can_manage_own_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "admins_can_manage_all_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "agents_own_special_mtn_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "admins_can_manage_all_agent_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "agents_read_own_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "agents_insert_own_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "agents_update_own_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "agents_delete_own_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "admins_read_all_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "admins_modify_all_pricing" ON agent_special_mtn_mashup_pricing;

-- Create new clean policies for agents
CREATE POLICY "agents_crud_own_pricing" ON agent_special_mtn_mashup_pricing
FOR ALL
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);

-- Create new clean policies for admins
CREATE POLICY "admins_crud_all_pricing" ON agent_special_mtn_mashup_pricing
FOR ALL
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Enable RLS on agent table
ALTER TABLE agent_special_mtn_mashup_pricing ENABLE ROW LEVEL SECURITY;

-- ======================
-- FIX 2: ADMIN PERMISSIONS
-- ======================
-- Drop all old policies on afa_settings
DROP POLICY IF EXISTS "admins_update_afa_settings" ON afa_settings;
DROP POLICY IF EXISTS "admins_read_afa_settings" ON afa_settings;
DROP POLICY IF EXISTS "afa_settings_admin_access" ON afa_settings;
DROP POLICY IF EXISTS "afa_settings_anyone_read" ON afa_settings;

-- Create admin-only access policy for afa_settings
CREATE POLICY "admins_full_access" ON afa_settings
FOR ALL
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Enable RLS on afa_settings
ALTER TABLE afa_settings ENABLE ROW LEVEL SECURITY;

-- ======================
-- VERIFY
-- ======================
-- Run these SELECT statements to verify policies are in place:
-- SELECT policyname, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'agent_special_mtn_mashup_pricing';
-- SELECT policyname, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'afa_settings';
