-- =============================================================
-- FIX: Allow admin users to read ALL rows in api_users
-- =============================================================
-- Run this once in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This adds a policy so that any user whose JWT role = 'admin'
-- can SELECT all rows from api_users, bypassing the per-user filter.

-- Drop if it already exists so re-running is safe
DROP POLICY IF EXISTS "Admin can read all api_users" ON api_users;

CREATE POLICY "Admin can read all api_users"
ON api_users
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND auth.jwt() ->> 'role' = 'admin'
);

-- Also allow admin to UPDATE any api_users row (needed for wallet top-up)
DROP POLICY IF EXISTS "Admin can update all api_users" ON api_users;

CREATE POLICY "Admin can update all api_users"
ON api_users
FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND auth.jwt() ->> 'role' = 'admin'
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.jwt() ->> 'role' = 'admin'
);
