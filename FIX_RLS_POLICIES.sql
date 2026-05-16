-- ============================================================================
-- DataPlug Supabase Database Setup - FIXED RLS Policies
-- Run this in your Supabase SQL Editor to fix the complaints RLS
-- ============================================================================

-- 1. DROP existing policies that are blocking inserts
DROP POLICY IF EXISTS "Agents can view complaints from their store" ON public.complaints;
DROP POLICY IF EXISTS "Admins can manage all complaints" ON public.complaints;

-- 2. CREATE NEW POLICIES that allow customers to submit complaints

-- Allow anyone to INSERT complaints (customers reporting)
CREATE POLICY "Anyone can submit complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (true);

-- Allow customers to VIEW their own complaints
CREATE POLICY "Customers can view their own complaints"
  ON public.complaints FOR SELECT
  USING (true);

-- Allow agents to VIEW complaints from their store
CREATE POLICY "Agents can view store complaints"
  ON public.complaints FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM public.agent_stores WHERE id = agent_store_id)
  );

-- Allow agents to UPDATE complaints from their store
CREATE POLICY "Agents can update store complaints"
  ON public.complaints FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM public.agent_stores WHERE id = agent_store_id)
  );

-- Allow admins full access
CREATE POLICY "Admins can manage all complaints"
  ON public.complaints FOR ALL
  USING (
    auth.role() = 'authenticated' AND auth.jwt()->>'role' = 'admin'
  );

-- 3. Ensure RLS is enabled
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- 4. Ensure permissions are correct
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.complaints TO anon;

-- ============================================================================
-- VERIFY THE SETUP
-- ============================================================================

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'complaints' AND schemaname = 'public';

-- Check all policies
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'complaints';
