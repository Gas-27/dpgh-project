-- Create sub_subagent_notifications table
-- Mirrors agent_to_subagent_notifications for subagent -> sub-subagent notifications

CREATE TABLE IF NOT EXISTS public.sub_subagent_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subagent_store_id UUID NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
  sub_subagent_store_id UUID NOT NULL REFERENCES sub_subagent_stores(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE sub_subagent_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Subagent can send/manage notifications to their sub-subagents
CREATE POLICY "Subagents can manage sub-subagent notifications"
ON sub_subagent_notifications FOR ALL
USING (
  subagent_store_id IN (
    SELECT id FROM subagent_stores WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  subagent_store_id IN (
    SELECT id FROM subagent_stores WHERE user_id = auth.uid()
  )
);

-- Policy: Sub-subagent can view notifications sent to them
CREATE POLICY "Sub-subagents can view their notifications"
ON sub_subagent_notifications FOR SELECT
USING (
  sub_subagent_store_id IN (
    SELECT id FROM sub_subagent_stores WHERE user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_sub_subagent_notifications_subagent ON sub_subagent_notifications(subagent_store_id);
CREATE INDEX idx_sub_subagent_notifications_target ON sub_subagent_notifications(sub_subagent_store_id);

-- Verify the table and policies
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sub_subagent_notifications';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'sub_subagent_notifications';
