-- ==================================================
-- AGENT NOTIFICATIONS - DIAGNOSTIC AND FIX SQL
-- ==================================================

-- 1. CHECK IF TABLE EXISTS AND VIEW STRUCTURE
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'agent_notifications';

-- 2. VIEW CURRENT TABLE COLUMNS
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'agent_notifications'
ORDER BY ordinal_position;

-- 3. CHECK FOR MISSING INDEXES
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'agent_notifications';

-- 4. VIEW EXISTING AGENT NOTIFICATIONS DATA (LIMIT 10)
SELECT * FROM agent_notifications LIMIT 10;

-- 5. CHECK FOR ANY NULL VALUES THAT MIGHT CAUSE ISSUES
SELECT 
  COUNT(*) as total_records,
  COUNT(id) as ids,
  COUNT(agent_store_id) as agent_store_ids,
  COUNT(message) as messages,
  COUNT(is_active) as is_active_values,
  COUNT(created_at) as created_at_values
FROM agent_notifications;

-- 6. IF TABLE IS MISSING OR CORRUPTED, RECREATE IT
-- RUN THIS IF THE ABOVE SHOWS NO TABLE OR ISSUES

DROP TABLE IF EXISTS agent_notifications CASCADE;

CREATE TABLE public.agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX idx_agent_notifications_agent_store_id ON agent_notifications(agent_store_id);
CREATE INDEX idx_agent_notifications_created_at ON agent_notifications(created_at DESC);
CREATE INDEX idx_agent_notifications_is_active ON agent_notifications(is_active);

-- 8. ENABLE ROW LEVEL SECURITY
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- 9. CREATE RLS POLICIES
CREATE POLICY "Agents can view their own notifications" 
ON agent_notifications 
FOR SELECT 
USING (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

CREATE POLICY "Agents can insert their own notifications" 
ON agent_notifications 
FOR INSERT 
WITH CHECK (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

CREATE POLICY "Agents can update their own notifications" 
ON agent_notifications 
FOR UPDATE 
USING (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

CREATE POLICY "Agents can delete their own notifications" 
ON agent_notifications 
FOR DELETE 
USING (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

-- 10. VERIFY THE SETUP
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'agent_notifications'
ORDER BY indexname;

-- 11. IF THERE'S DATA IN AN OLD TABLE, MIGRATE IT
-- ONLY RUN THIS IF YOU HAVE DATA YOU NEED TO PRESERVE
-- (Skip if table was just created)
-- INSERT INTO agent_notifications (id, agent_store_id, message, is_active, expires_at, created_at, updated_at)
-- SELECT id, agent_store_id, message, is_active, expires_at, created_at, COALESCE(updated_at, now())
-- FROM agent_notifications_old
-- WHERE id NOT IN (SELECT id FROM agent_notifications);

-- 12. TEST QUERY - RUN THIS TO VERIFY IT WORKS
-- Replace 'your-agent-store-id' with an actual agent store ID from your system
-- SELECT * FROM agent_notifications 
-- WHERE agent_store_id = 'your-agent-store-id'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- 13. CLEANUP - DELETE DUPLICATE/CORRUPT RECORDS IF NEEDED
-- View duplicates
SELECT agent_store_id, message, COUNT(*) as count
FROM agent_notifications
GROUP BY agent_store_id, message
HAVING COUNT(*) > 1;

-- Delete duplicates (keeps the most recent)
DELETE FROM agent_notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (agent_store_id, message) id
  FROM agent_notifications
  ORDER BY agent_store_id, message, created_at DESC
);

-- ==================================================
-- END OF SQL FIX
-- ==================================================
