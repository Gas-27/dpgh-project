-- ============================================================
-- PART 1: Fix topup_reference — match by email since identity_id
-- may have type mismatches. Correct each user individually.
-- ============================================================

-- Fix users: match api_users to customers by email, overwrite topup_reference
UPDATE api_users au
SET topup_reference = c.topup_reference
FROM customers c
WHERE au.role = 'user'
  AND (
    au.email = c.email
    OR au.user_email = c.email
  );

-- Fix agents: match api_users to agent_stores by email, overwrite topup_reference
UPDATE api_users au
SET topup_reference = a.topup_reference
FROM agent_stores a
WHERE au.role = 'agent'
  AND (
    au.email = a.email
    OR au.user_email = a.email
  );

-- Verify corrections
SELECT role, email, user_email, topup_reference FROM api_users ORDER BY role, email LIMIT 30;

-- ============================================================
-- PART 2: Drop ALL existing policies on api_users (clean slate)
-- and recreate with correct user_roles check
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'api_users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON api_users', pol.policyname);
  END LOOP;
END $$;

-- Admin: full read access via user_roles table
CREATE POLICY "admin_read_api_users"
ON api_users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admin: full update access (wallet top-ups, custom prices)
CREATE POLICY "admin_update_api_users"
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

-- Regular users/agents: read own row only
CREATE POLICY "own_read_api_users"
ON api_users FOR SELECT
USING (identity_id::uuid = auth.uid());

-- Regular users/agents: update own row only
CREATE POLICY "own_update_api_users"
ON api_users FOR UPDATE
USING (identity_id::uuid = auth.uid())
WITH CHECK (identity_id::uuid = auth.uid());

-- Regular users/agents: insert own row only
CREATE POLICY "own_insert_api_users"
ON api_users FOR INSERT
WITH CHECK (identity_id::uuid = auth.uid());

ALTER TABLE api_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 3: api_user_package_prices — admin needs full access
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'api_user_package_prices' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON api_user_package_prices', pol.policyname);
  END LOOP;
END $$;

-- Admin can read all custom prices
CREATE POLICY "admin_read_api_user_package_prices"
ON api_user_package_prices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admin can insert custom prices
CREATE POLICY "admin_insert_api_user_package_prices"
ON api_user_package_prices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admin can update custom prices
CREATE POLICY "admin_update_api_user_package_prices"
ON api_user_package_prices FOR UPDATE
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

-- Admin can delete custom prices
CREATE POLICY "admin_delete_api_user_package_prices"
ON api_user_package_prices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- API users can read their own prices
CREATE POLICY "own_read_api_user_package_prices"
ON api_user_package_prices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM api_users
    WHERE api_users.id = api_user_package_prices.api_user_id
    AND api_users.identity_id::uuid = auth.uid()
  )
);

ALTER TABLE api_user_package_prices ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 4: Fix trigger to match by email (more reliable than identity_id cast)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_api_user_topup_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'user' AND NEW.topup_reference IS NULL THEN
    SELECT c.topup_reference
    INTO NEW.topup_reference
    FROM customers c
    WHERE c.email = NEW.email OR c.email = NEW.user_email
    LIMIT 1;
  ELSIF NEW.role = 'agent' AND NEW.topup_reference IS NULL THEN
    SELECT a.topup_reference
    INTO NEW.topup_reference
    FROM agent_stores a
    WHERE a.email = NEW.email OR a.email = NEW.user_email
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_api_user_topup_reference ON api_users;
CREATE TRIGGER trg_sync_api_user_topup_reference
  BEFORE INSERT ON api_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_api_user_topup_reference();

-- ============================================================
-- Final verification
-- ============================================================

SELECT 'api_users policies' AS tbl, policyname, cmd FROM pg_policies WHERE tablename = 'api_users'
UNION ALL
SELECT 'api_user_package_prices policies', policyname, cmd FROM pg_policies WHERE tablename = 'api_user_package_prices'
ORDER BY tbl, policyname;
