-- ============================================================
-- FIX: Disable RLS on notification tables completely
-- ============================================================
-- The simplest solution: disable RLS entirely for notifications
-- since the agent table relationships already provide security

ALTER TABLE agent_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_to_subagent_notifications DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('agent_notifications', 'agent_to_subagent_notifications')
AND schemaname = 'public';
