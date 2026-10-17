-- Add suspended field to subagent_stores
ALTER TABLE subagent_stores ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subagent_stores_suspended ON subagent_stores(suspended);
