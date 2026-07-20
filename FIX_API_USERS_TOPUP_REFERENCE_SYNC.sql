-- ============================================================
-- Sync topup_reference from customers table for user role
-- ============================================================

-- Create or replace function to populate topup_reference for users
CREATE OR REPLACE FUNCTION sync_api_user_topup_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only populate topup_reference for users (not agents)
  IF NEW.role = 'user' THEN
    SELECT topup_reference
    INTO NEW.topup_reference
    FROM customers
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
-- Backfill existing user rows that have NULL topup_reference
-- ============================================================
UPDATE api_users au
SET topup_reference = c.topup_reference
FROM customers c
WHERE au.role = 'user'
  AND au.identity_id::uuid = c.identity_id::uuid
  AND au.topup_reference IS NULL;

-- Check how many rows were backfilled
SELECT COUNT(*) AS user_rows_with_topup_reference
FROM api_users
WHERE role = 'user' AND topup_reference IS NOT NULL;
