-- Create subagent_wallet_topups table for tracking subagent wallet top-ups
CREATE TABLE IF NOT EXISTS subagent_wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id UUID NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subagent_wallet_topups_store ON subagent_wallet_topups(subagent_store_id);
CREATE INDEX IF NOT EXISTS idx_subagent_wallet_topups_reference ON subagent_wallet_topups(paystack_reference);

-- Enable RLS
ALTER TABLE subagent_wallet_topups ENABLE ROW LEVEL SECURITY;

-- Allow subagents to view their own topups
CREATE POLICY "Subagents can view their own topups" ON subagent_wallet_topups
  FOR SELECT USING (
    subagent_store_id IN (
      SELECT id FROM subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Allow insert from service role (used by edge functions)
CREATE POLICY "Service role can insert topups" ON subagent_wallet_topups
  FOR INSERT WITH CHECK (true);
