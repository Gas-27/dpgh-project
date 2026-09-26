-- ============================================================
-- Sync topup_reference from customers/agent_stores tables
-- ============================================================

-- Create or replace function to populate topup_reference for both users and agents
CREATE OR REPLACE FUNCTION sync_api_user_topup_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate topup_reference based on role
  IF NEW.role = 'user' THEN
    -- For users: fetch from customers table
    SELECT topup_reference
    INTO NEW.topup_reference
    FROM customers
    WHERE identity_id::uuid = NEW.identity_id::uuid
    LIMIT 1;
  ELSIF NEW.role = 'agent' THEN
    -- For agents: fetch from agent_stores table
    SELECT topup_reference
    INTO NEW.topup_reference
    FROM agent_stores
    WHERE identity_id::uuid = NEW.identity_id::uuid
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_sync_api_user_topup_reference ON api_users;

-- Create trigger to run BEFORE INSERT on api_users
CREATE TRIGGER trg_sync_api_user_topup_reference
  BEFORE INSERT ON api_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_api_user_topup_reference();

-- ============================================================
-- Backfill existing rows: users from customers, agents from agent_stores
-- ============================================================

-- Backfill user rows from customers table
UPDATE api_users au
SET topup_reference = c.topup_reference
FROM customers c
WHERE au.role = 'user'
  AND au.identity_id::uuid = c.identity_id::uuid
  AND au.topup_reference IS NULL;

-- Backfill agent rows from agent_stores table
UPDATE api_users au
SET topup_reference = a.topup_reference
FROM agent_stores a
WHERE au.role = 'agent'
  AND au.identity_id::uuid = a.identity_id::uuid
  AND au.topup_reference IS NULL;

-- Check results
SELECT 
  role,
  COUNT(*) AS total,
  COUNT(CASE WHEN topup_reference IS NOT NULL THEN 1 END) AS with_topup_reference
FROM api_users
GROUP BY role;
