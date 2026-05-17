-- ============================================================================
-- FIX: Subagent Redirect Issue - Ensure user_roles table is properly configured
-- Run this in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- STEP 2: Disable RLS temporarily to reset
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- STEP 3: Re-enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create simple permissive policies
CREATE POLICY "Enable read access for all users"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON public.user_roles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON public.user_roles FOR UPDATE
  USING (true);

CREATE POLICY "Enable delete for authenticated users"
  ON public.user_roles FOR DELETE
  USING (true);

-- STEP 5: Grant permissions to both authenticated and anonymous users
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated, anon;

-- STEP 6: Ensure foreign key constraint exists
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- STEP 7: Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- STEP 8: Test - view all user roles
SELECT user_id, role, created_at FROM public.user_roles ORDER BY created_at DESC LIMIT 10;
