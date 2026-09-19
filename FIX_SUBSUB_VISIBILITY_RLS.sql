-- =====================================================================
-- FIX: Subagents cannot see the sub-subagents registered under them
-- =====================================================================
-- ROOT CAUSE: The agent->subagent flow works because of this policy on
-- subagent_stores:
--
--   "Agents can view subagents"
--     USING (agent_store_id IN (SELECT id FROM agent_stores WHERE user_id = auth.uid()))
--
-- The sub_subagent_stores table (created via the dashboard) is missing the
-- equivalent policy, so a parent subagent's SELECT returns 0 rows even though
-- the sub-subagent records exist. This mirrors the working pattern exactly.
-- =====================================================================

-- STEP 1 (DIAGNOSTIC): confirm the rows actually exist (run as service role / SQL editor)
-- SELECT id, store_name, subagent_store_id, created_at
-- FROM public.sub_subagent_stores
-- ORDER BY created_at DESC;

-- STEP 2 (DIAGNOSTIC): see which policies currently exist
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'sub_subagent_stores';

-- Make sure RLS is enabled
ALTER TABLE public.sub_subagent_stores ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- A sub-subagent can view their own store
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Sub-subagents can view own store" ON public.sub_subagent_stores;
CREATE POLICY "Sub-subagents can view own store" ON public.sub_subagent_stores
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- THE KEY FIX: A subagent can view the sub-subagents registered under them
-- (exact mirror of "Agents can view subagents")
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Subagents can view sub-subagents" ON public.sub_subagent_stores;
CREATE POLICY "Subagents can view sub-subagents" ON public.sub_subagent_stores
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- A subagent can update their sub-subagents' settings
-- (exact mirror of "Agents can update subagent settings")
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Subagents can update sub-subagents" ON public.sub_subagent_stores;
CREATE POLICY "Subagents can update sub-subagents" ON public.sub_subagent_stores
  FOR UPDATE TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Admins can view/manage all sub-subagent stores
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all sub-subagent stores" ON public.sub_subagent_stores;
CREATE POLICY "Admins can view all sub-subagent stores" ON public.sub_subagent_stores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- STEP 3 (VERIFY): re-run the policy list, you should now see the new policies
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'sub_subagent_stores';
