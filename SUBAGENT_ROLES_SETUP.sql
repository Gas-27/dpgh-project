-- ============================================================================
-- FIX: User Roles RLS and Setup
-- Run this in Supabase SQL Editor to enable subagent role creation
-- ============================================================================

-- STEP 1: Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- STEP 2: Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- STEP 3: Drop old policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;

-- STEP 4: Create new RLS policies
CREATE POLICY "Anyone can view roles"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update roles"
  ON public.user_roles FOR UPDATE
  USING (true);

-- STEP 5: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO anon;

-- STEP 6: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- STEP 7: Verify table exists
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'user_roles';
