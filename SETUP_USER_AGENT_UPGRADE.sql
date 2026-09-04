-- User to Agent Upgrade System - Database Setup
-- Run this script in Supabase SQL Editor to enable user-to-agent upgrades

-- ============================================
-- 1. Add columns to customers table
-- ============================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS has_agent_account BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_has_agent_account 
ON customers(has_agent_account);

CREATE INDEX IF NOT EXISTS idx_customers_agent_id 
ON customers(agent_id);

-- ============================================
-- 2. Add columns to agents table
-- ============================================
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_from_user BOOLEAN DEFAULT false;

-- Create index for linking user accounts
CREATE INDEX IF NOT EXISTS idx_agents_user_id 
ON agents(user_id);

CREATE INDEX IF NOT EXISTS idx_agents_created_from_user 
ON agents(created_from_user);

-- ============================================
-- 3. Create notifications table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read 
ON notifications(read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- ============================================
-- 4. Verify the structure
-- ============================================
-- Customers table columns
SELECT 'customers' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' AND column_name IN ('id', 'email', 'wallet_balance', 'has_agent_account', 'agent_id')
ORDER BY ordinal_position;

-- Agents table columns
SELECT 'agents' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agents' AND column_name IN ('id', 'email', 'user_id', 'wallet_balance', 'created_from_user')
ORDER BY ordinal_position;

-- ============================================
-- 5. Optional: Enable RLS for notifications
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid()::text = user_id::text OR user_id IN (
  SELECT id FROM customers WHERE email = auth.jwt() ->> 'email'
));

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- ============================================
-- Deployment Complete!
-- ============================================
-- The following have been set up:
-- 1. customers table: added has_agent_account and agent_id columns
-- 2. agents table: added user_id and created_from_user columns
-- 3. notifications table: created for upgrade notifications
-- 4. Indexes: created for performance optimization
-- 5. RLS: enabled on notifications for security
--
-- Next steps:
-- 1. Deploy the create-agent-account Supabase function
-- 2. Test the upgrade flow in the user dashboard
-- 3. Users can now click "Become an Agent" to upgrade
