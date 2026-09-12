-- Create table to track free data claims
CREATE TABLE IF NOT EXISTS free_data_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  gb_amount INTEGER NOT NULL DEFAULT 1,
  total_gb_purchased NUMERIC NOT NULL,
  agent_store_id UUID REFERENCES agent_stores(id) ON DELETE SET NULL,
  subagent_store_id UUID REFERENCES subagent_stores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by phone number and date
CREATE INDEX IF NOT EXISTS idx_free_data_claims_phone_date ON free_data_claims(phone_number, created_at DESC);

-- Enable RLS
ALTER TABLE free_data_claims ENABLE ROW LEVEL SECURITY;

-- Policy to allow inserts from anyone (for storefront claims)
CREATE POLICY "Allow insert free data claims" ON free_data_claims
  FOR INSERT WITH CHECK (true);

-- Policy to allow reads for checking if already claimed
CREATE POLICY "Allow read own claims" ON free_data_claims
  FOR SELECT USING (true);
