-- ============================================
-- FIX 1: Admin Dashboard - afa_settings UUID
-- ============================================

-- Check if afa_settings ID column exists and is UUID
-- If ID is integer/string, we need to update the component
-- For now, let's add RLS policy that allows authenticated admins to update

ALTER TABLE afa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_update_afa_settings" ON afa_settings;

CREATE POLICY "admins_update_afa_settings" ON afa_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to read afa_settings
DROP POLICY IF EXISTS "admins_read_afa_settings" ON afa_settings;

CREATE POLICY "admins_read_afa_settings" ON afa_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================
-- FIX 2: Agent Dashboard - Permission Denied
-- ============================================

-- Drop and recreate agent pricing RLS policies
DROP POLICY IF EXISTS "agents_can_manage_own_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "admins_can_manage_all_pricing" ON agent_special_mtn_mashup_pricing;

-- Simple agent policy - agents can only access their own records
CREATE POLICY "agents_read_own_pricing" ON agent_special_mtn_mashup_pricing
FOR SELECT
USING (auth.uid() = agent_id);

CREATE POLICY "agents_insert_own_pricing" ON agent_special_mtn_mashup_pricing
FOR INSERT
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "agents_update_own_pricing" ON agent_special_mtn_mashup_pricing
FOR UPDATE
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "agents_delete_own_pricing" ON agent_special_mtn_mashup_pricing
FOR DELETE
USING (auth.uid() = agent_id);

-- Admin policies - admins can manage all pricing records
CREATE POLICY "admins_read_all_pricing" ON agent_special_mtn_mashup_pricing
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "admins_modify_all_pricing" ON agent_special_mtn_mashup_pricing
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE agent_special_mtn_mashup_pricing ENABLE ROW LEVEL SECURITY;
