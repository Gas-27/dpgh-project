-- ============================================================
-- FINAL FIX: api_users RLS using user_roles table
-- The admin role is stored in user_roles table, NOT in JWT claims.
-- All previous policies using auth.jwt()->>'role' = 'admin' were wrong.
-- ============================================================

-- Drop all previous api_users RLS policies (clean slate)
DROP POLICY IF EXISTS "Admin can read all api_users" ON api_users;
DROP POLICY IF EXISTS "Admin can update all api_users" ON api_users;
DROP POLICY IF EXISTS "Users can read own api_user" ON api_users;
DROP POLICY IF EXISTS "Users can update own api_user" ON api_users;
DROP POLICY IF EXISTS "Users can insert own api_user" ON api_users;
DROP POLICY IF EXISTS "Agents can read own api_user" ON api_users;
DROP POLICY IF EXISTS "Agents can update own api_user" ON api_users;
DROP POLICY IF EXISTS "Agents can insert own api_user" ON api_users;

-- 1. Admin can read ALL rows (uses user_roles table — not JWT claim)
CREATE POLICY "Admin can read all api_users"
ON api_users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 2. Admin can update ANY row (for wallet top-up and custom pricing)
CREATE POLICY "Admin can update all api_users"
ON api_users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 3. Users/agents can read their own row
CREATE POLICY "Users can read own api_user"
ON api_users FOR SELECT
USING (identity_id::uuid = auth.uid());

-- 4. Users/agents can update their own row
CREATE POLICY "Users can update own api_user"
ON api_users FOR UPDATE
USING (identity_id::uuid = auth.uid())
WITH CHECK (identity_id::uuid = auth.uid());

-- 5. Users/agents can insert their own row
CREATE POLICY "Users can insert own api_user"
ON api_users FOR INSERT
WITH CHECK (identity_id::uuid = auth.uid());

-- Verify RLS is enabled
ALTER TABLE api_users ENABLE ROW LEVEL SECURITY;

-- Check policies were created
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'api_users'
ORDER BY policyname;
