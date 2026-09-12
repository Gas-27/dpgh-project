-- Set allow_subagent_registration to default FALSE
ALTER TABLE public.agent_stores 
ALTER COLUMN allow_subagent_registration SET DEFAULT false;

-- Update existing records with NULL to false
UPDATE public.agent_stores 
SET allow_subagent_registration = false 
WHERE allow_subagent_registration IS NULL;

-- Ensure column is NOT NULL
ALTER TABLE public.agent_stores 
ALTER COLUMN allow_subagent_registration SET NOT NULL;

-- Add delete capability for subagents in admin dashboard
-- Ensure RLS policies allow deletion
DROP POLICY IF EXISTS "admins_can_delete_subagents" ON public.subagent_stores;

CREATE POLICY "admins_can_delete_subagents"
  ON public.subagent_stores FOR DELETE
  USING (true);

GRANT DELETE ON public.subagent_stores TO authenticated, anon;
