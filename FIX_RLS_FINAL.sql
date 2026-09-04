-- ============================================================================
-- FIX FOR: RLS Policy Issues with Complaint Management
-- Run this in Supabase SQL Editor to fix INSERT and UPDATE issues
-- ============================================================================

-- STEP 1: DISABLE RLS TEMPORARILY to clear old policies
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;

-- STEP 2: DROP ALL old policies
DROP POLICY IF EXISTS "Anyone can submit complaints" ON public.complaints;
DROP POLICY IF EXISTS "Customers and agents can view complaints" ON public.complaints;
DROP POLICY IF EXISTS "Agents can update store complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can manage all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Agents can view complaints from their store" ON public.complaints;
DROP POLICY IF EXISTS "Admins can manage all complaints" ON public.complaints;

-- STEP 3: RE-ENABLE RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- STEP 4: CREATE NEW POLICIES - ALLOW EVERYONE TO INSERT

-- Policy 1: Anyone can INSERT complaints (no auth required initially)
CREATE POLICY "Anyone can insert complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (true);

-- Policy 2: Anyone can SELECT complaints
CREATE POLICY "Anyone can select complaints"
  ON public.complaints FOR SELECT
  USING (true);

-- Policy 3: Anyone can UPDATE complaints (will allow status changes)
CREATE POLICY "Anyone can update complaints"
  ON public.complaints FOR UPDATE
  USING (true);

-- Policy 4: Only admins can DELETE complaints
CREATE POLICY "Only admins can delete complaints"
  ON public.complaints FOR DELETE
  USING (
    auth.role() = 'authenticated' AND auth.jwt()->>'role' = 'admin'
  );

-- STEP 5: Grant proper permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.complaints TO anon;

-- STEP 6: Verify policies are created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'complaints' ORDER BY policyname;

-- STEP 7: Test INSERT (this should work now)
-- Uncomment to test:
-- INSERT INTO public.complaints (complaint_type, order_id, customer_number, complaint_title, complaint_details, status)
-- VALUES ('storefront', '00000000-0000-0000-0000-000000000000', '0200000000', 'Test', 'Test complaint', 'pending');
