-- =============================================================================
-- FIX: Admin approval of agent stores resets on refresh
--
-- ROOT CAUSE:
--   The existing "Admins can update all stores" policy uses has_role(auth.uid(), 'admin').
--   If that function is missing OR the admin user is not in user_roles, the UPDATE
--   silently fails with an RLS error. The frontend was not checking the error so
--   it showed "approved" locally but the DB never changed — refresh reverted it.
--
-- THIS MIGRATION:
--   1. Ensures the has_role helper function exists.
--   2. Drops and recreates the admin UPDATE policy to be more robust.
--   3. Ensures the currently-logged-in admin is in user_roles (replace the UUID).
--   4. Adds a broad admin SELECT policy so the admin can always read all stores.
-- =============================================================================


-- 1. Create has_role helper if it doesn't exist
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1
      AND user_roles.role = $2
  );
$$;


-- 2. Ensure user_roles table exists (it should, but just in case)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow admins to read user_roles
CREATE POLICY IF NOT EXISTS "Admins can view user_roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);


-- 3. Drop old admin policies on agent_stores and recreate them clearly
DROP POLICY IF EXISTS "Admins can update all stores" ON public.agent_stores;
DROP POLICY IF EXISTS "Admins can view all stores" ON public.agent_stores;

-- Admin SELECT — sees every store regardless of approved status
CREATE POLICY "Admins can view all stores"
  ON public.agent_stores FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin UPDATE — can change any column including approved
CREATE POLICY "Admins can update all stores"
  ON public.agent_stores FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =============================================================================
-- IMPORTANT: Run this INSERT to make your admin account an admin.
-- Replace '00000000-0000-0000-0000-000000000000' with your actual auth.users id.
-- You can find your user id in: Supabase Dashboard → Authentication → Users
-- =============================================================================
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;


-- Quick verification — run this to confirm the policies look correct:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'agent_stores';
