-- ============================================================
-- FIX_API_USERS_PROFILE_SYNC.sql
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================
-- Part 1: Trigger to auto-populate profile fields from auth.users
--         whenever a new api_users row is inserted
-- ============================================================

CREATE OR REPLACE FUNCTION sync_api_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_email   text;
  v_name    text;
BEGIN
  -- Pull email and display name from auth.users
  SELECT
    au.email,
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      au.raw_user_meta_data->>'display_name',
      au.email
    )
  INTO v_email, v_name
  FROM auth.users au
  WHERE au.id = NEW.identity_id::uuid;

  -- Only overwrite if the columns are still NULL
  IF NEW.email IS NULL THEN
    NEW.email := v_email;
  END IF;
  IF NEW.user_email IS NULL THEN
    NEW.user_email := v_email;
  END IF;
  IF NEW.full_name IS NULL THEN
    NEW.full_name := v_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger (fires BEFORE insert so it fills columns before the row is written)
DROP TRIGGER IF EXISTS trg_sync_api_user_profile ON api_users;
CREATE TRIGGER trg_sync_api_user_profile
  BEFORE INSERT ON api_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_api_user_profile();


-- ============================================================
-- Part 2: RLS policy so admin can read ALL api_users rows
-- ============================================================

DROP POLICY IF EXISTS "Admin can read all api_users" ON api_users;
CREATE POLICY "Admin can read all api_users"
  ON api_users FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admin can update all api_users" ON api_users;
CREATE POLICY "Admin can update all api_users"
  ON api_users FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');


-- ============================================================
-- Part 3: Backfill the 114 existing rows that have NULL profile data
-- ============================================================

UPDATE api_users au
SET
  email      = COALESCE(au.email,      usr.email),
  user_email = COALESCE(au.user_email, usr.email),
  full_name  = COALESCE(
                 au.full_name,
                 usr.raw_user_meta_data->>'full_name',
                 usr.raw_user_meta_data->>'name',
                 usr.raw_user_meta_data->>'display_name',
                 usr.email
               )
FROM auth.users usr
WHERE au.identity_id::uuid = usr.id
  AND (au.email IS NULL OR au.user_email IS NULL OR au.full_name IS NULL);

-- Confirm how many rows were updated
SELECT COUNT(*) AS rows_backfilled
FROM api_users
WHERE email IS NOT NULL OR full_name IS NOT NULL;
