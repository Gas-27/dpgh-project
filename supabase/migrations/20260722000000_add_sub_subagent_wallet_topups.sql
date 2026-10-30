-- Create sub_subagent_wallet_topups table for tracking sub-subagent wallet top-ups
CREATE TABLE IF NOT EXISTS sub_subagent_wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_subagent_store_id UUID NOT NULL REFERENCES sub_subagent_stores(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sub_subagent_wallet_topups_store ON sub_subagent_wallet_topups(sub_subagent_store_id);
CREATE INDEX IF NOT EXISTS idx_sub_subagent_wallet_topups_reference ON sub_subagent_wallet_topups(paystack_reference);

-- Enable RLS
ALTER TABLE sub_subagent_wallet_topups ENABLE ROW LEVEL SECURITY;

-- Allow sub-subagents to view their own topups
CREATE POLICY "Sub-subagents can view their own topups" ON sub_subagent_wallet_topups
  FOR SELECT USING (
    sub_subagent_store_id IN (
      SELECT id FROM sub_subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Allow parent subagents to view topups of their sub-subagents
CREATE POLICY "Parent subagents can view sub-subagent topups" ON sub_subagent_wallet_topups
  FOR SELECT USING (
    sub_subagent_store_id IN (
      SELECT ss.id FROM sub_subagent_stores ss
      JOIN subagent_stores s ON s.id = ss.subagent_store_id
      WHERE s.user_id = auth.uid()
    )
  );

-- Allow insert from service role (used by edge functions)
CREATE POLICY "Service role can insert sub-subagent topups" ON sub_subagent_wallet_topups
  FOR INSERT WITH CHECK (true);
