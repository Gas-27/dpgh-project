-- SOLUTION: Make data_packages public-readable by disabling RLS
-- This table contains public package information that should be visible to all users
-- (authenticated and unauthenticated) on the storefronts

-- Check if RLS is currently enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'data_packages';

-- Disable RLS on data_packages table
ALTER TABLE data_packages DISABLE ROW LEVEL SECURITY;

-- Verify RLS is now disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'data_packages';

-- Drop any existing RLS policies that might have been blocking access
DROP POLICY IF EXISTS "allow_select_data_packages" ON data_packages;
DROP POLICY IF EXISTS "data_packages_public_select" ON data_packages;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON data_packages;
DROP POLICY IF EXISTS "Enable read access for all users" ON data_packages;

-- Verify no policies remain
SELECT * FROM pg_policies WHERE tablename = 'data_packages';
