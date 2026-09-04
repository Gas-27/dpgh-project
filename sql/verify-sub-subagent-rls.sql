-- Verify sub_subagent_stores RLS policies
-- Run this in Supabase SQL Editor to ensure all policies are correct

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'sub_subagent_stores'
ORDER BY policyname;

-- Expected output should include:
-- 1. "Users can read their own sub-subagent stores" - SELECT - auth.uid() = user_id
-- 2. "Users can update their own stores" - UPDATE - auth.uid() = user_id
-- 3. "Admins can view all stores" - SELECT - auth.role() = 'authenticated' AND some admin check
-- 4. "Service role manages all" - ALL - service role bypass

-- If policies are missing, run these commands:

-- Enable RLS
ALTER TABLE sub_subagent_stores ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users read their own stores
CREATE POLICY "Users can read their own sub-subagent stores"
ON sub_subagent_stores
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Users update their own stores
CREATE POLICY "Users can update their own sub-subagent stores"
ON sub_subagent_stores
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy 3: Service role bypasses RLS
CREATE POLICY "Service role manages all sub-subagent stores"
ON sub_subagent_stores
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_class
WHERE relname = 'sub_subagent_stores';
