-- ============================================================================
-- FIX FOR: Complaint Status Not Persisting After Page Refresh
-- This fixes RLS policies to allow proper UPDATE operations
-- Run this in Supabase SQL Editor
-- ============================================================================

-- STEP 1: DROP all existing policies
DROP POLICY IF EXISTS "Anyone can submit complaints" ON public.complaints;
DROP POLICY IF EXISTS "Customers and agents can view complaints" ON public.complaints;
DROP POLICY IF EXISTS "Agents can update store complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can manage all complaints" ON public.complaints;

-- STEP 2: CREATE new policies with proper UPDATE support

-- Policy 1: Anyone can INSERT complaints (customers reporting)
CREATE POLICY "Anyone can submit complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (true);

-- Policy 2: Everyone can VIEW complaints
CREATE POLICY "Everyone can view complaints"
  ON public.complaints FOR SELECT
  USING (true);

-- Policy 3: Agents can UPDATE their store's complaints
CREATE POLICY "Agents can update store complaints"
  ON public.complaints FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy 4: Admins have full access
CREATE POLICY "Admins can manage all complaints"
  ON public.complaints FOR ALL
  USING (true);

-- STEP 3: Grant permissions to all roles
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.complaints TO anon;

-- STEP 4: Verify setup
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'complaints'
ORDER BY policyname;
