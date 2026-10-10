-- ============================================================
-- AGENT NOTIFICATIONS FIX - STEP BY STEP
-- ============================================================

-- STEP 1: CHECK IF TABLE EXISTS
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'agent_notifications';

-- STEP 2: VIEW TABLE STRUCTURE (if exists)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'agent_notifications'
ORDER BY ordinal_position;

-- STEP 3: VIEW INDEXES
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'agent_notifications';

-- STEP 4: COUNT RECORDS
SELECT COUNT(*) as total_notifications FROM agent_notifications;

-- STEP 5: VIEW FIRST 5 RECORDS (no agent ID needed)
SELECT id, agent_store_id, message, created_at FROM agent_notifications ORDER BY created_at DESC LIMIT 5;

-- ============================================================
-- IF TABLE IS MISSING OR CORRUPTED, RUN THIS ENTIRE SECTION
-- ============================================================

-- Drop corrupted table
DROP TABLE IF EXISTS agent_notifications CASCADE;

-- Create new table
CREATE TABLE public.agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add indexes
CREATE INDEX idx_agent_notifications_agent_store_id ON agent_notifications(agent_store_id);
CREATE INDEX idx_agent_notifications_created_at ON agent_notifications(created_at DESC);
CREATE INDEX idx_agent_notifications_is_active ON agent_notifications(is_active);

-- Enable RLS
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- ============================================================
-- SAME FOR agent_to_subagent_notifications TABLE
-- ============================================================

-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'agent_to_subagent_notifications';

-- Drop if corrupted
DROP TABLE IF EXISTS agent_to_subagent_notifications CASCADE;

-- Create table
CREATE TABLE public.agent_to_subagent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add indexes
CREATE INDEX idx_agent_to_subagent_agent_store_id ON agent_to_subagent_notifications(agent_store_id);
CREATE INDEX idx_agent_to_subagent_created_at ON agent_to_subagent_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE agent_to_subagent_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Agents can view their subagent notifications" 
ON agent_to_subagent_notifications 
FOR SELECT 
USING (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

CREATE POLICY "Agents can insert subagent notifications" 
ON agent_to_subagent_notifications 
FOR INSERT 
WITH CHECK (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

CREATE POLICY "Agents can update subagent notifications" 
ON agent_to_subagent_notifications 
FOR UPDATE 
USING (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

CREATE POLICY "Agents can delete subagent notifications" 
ON agent_to_subagent_notifications 
FOR DELETE 
USING (agent_store_id IN (
  SELECT id FROM agent_stores WHERE user_id = auth.uid()
));

-- ============================================================
-- VERIFY EVERYTHING IS WORKING
-- ============================================================

-- Count records in both tables
SELECT 'agent_notifications' as table_name, COUNT(*) as record_count FROM agent_notifications
UNION ALL
SELECT 'agent_to_subagent_notifications', COUNT(*) FROM agent_to_subagent_notifications;

-- List all agent store IDs (to verify data exists)
SELECT id, store_name FROM agent_stores LIMIT 10;
