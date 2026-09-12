-- Add last_withdrawal_at column to track 24-hour cooldown
ALTER TABLE subagent_stores ADD COLUMN last_withdrawal_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE agent_stores ADD COLUMN last_withdrawal_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update payout_requests to ensure completed_at is tracked
-- (already in schema, but ensure it's set on success)

-- Add index for faster cooldown queries
CREATE INDEX idx_subagent_stores_last_withdrawal ON subagent_stores(last_withdrawal_at);
CREATE INDEX idx_agent_stores_last_withdrawal ON agent_stores(last_withdrawal_at);
