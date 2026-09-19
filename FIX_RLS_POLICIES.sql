-- =================================================
-- FIX: Agent Notifications RLS Policies
-- =================================================
-- The error "new row violates row-level security policy" happens because
-- the INSERT policy is checking if the agent is the owner, but the new row
-- being created has agent_store_id that needs to be validated differently.

-- STEP 1: Drop existing policies (if they exist)
DROP POLICY IF EXISTS "Agents can view their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can insert their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can update their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can delete their own notifications" ON agent_notifications;

-- STEP 2: Create simplified, working policies
-- SELECT: Agent can see notifications for their store
CREATE POLICY "agent_notifications_select"
ON agent_notifications
FOR SELECT
USING (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- INSERT: Agent can insert notifications for their store
CREATE POLICY "agent_notifications_insert"
ON agent_notifications
FOR INSERT
WITH CHECK (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- UPDATE: Agent can update their own notifications
CREATE POLICY "agent_notifications_update"
ON agent_notifications
FOR UPDATE
USING (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- DELETE: Agent can delete their own notifications
CREATE POLICY "agent_notifications_delete"
ON agent_notifications
FOR DELETE
USING (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- =================================================
-- FIX: Subagent Notifications RLS Policies
-- =================================================
DROP POLICY IF EXISTS "agent_to_subagent_select" ON agent_to_subagent_notifications;
DROP POLICY IF EXISTS "agent_to_subagent_insert" ON agent_to_subagent_notifications;
DROP POLICY IF EXISTS "agent_to_subagent_update" ON agent_to_subagent_notifications;
DROP POLICY IF EXISTS "agent_to_subagent_delete" ON agent_to_subagent_notifications;

-- SELECT: Agent can see notifications they sent
CREATE POLICY "agent_to_subagent_select"
ON agent_to_subagent_notifications
FOR SELECT
USING (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- INSERT: Agent can insert notifications
CREATE POLICY "agent_to_subagent_insert"
ON agent_to_subagent_notifications
FOR INSERT
WITH CHECK (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- UPDATE: Agent can update their notifications
CREATE POLICY "agent_to_subagent_update"
ON agent_to_subagent_notifications
FOR UPDATE
USING (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- DELETE: Agent can delete their notifications
CREATE POLICY "agent_to_subagent_delete"
ON agent_to_subagent_notifications
FOR DELETE
USING (
  agent_store_id IN (
    SELECT id FROM agent_stores WHERE user_id = auth.uid()
  )
);

-- =================================================
-- VERIFY: Run these to test if policies work
-- =================================================
-- This should return rows for the logged-in agent
SELECT * FROM agent_notifications LIMIT 10;

-- This should also work now
SELECT * FROM agent_to_subagent_notifications LIMIT 10;
