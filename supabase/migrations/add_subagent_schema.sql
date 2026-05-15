-- Update app_role enum to include 'subagent'
ALTER TYPE app_role ADD VALUE 'subagent' BEFORE 'user';

-- 1. Subagent stores table
CREATE TABLE IF NOT EXISTS subagent_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  parent_agent_store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
  store_name VARCHAR NOT NULL,
  whatsapp_number VARCHAR NOT NULL,
  support_number VARCHAR NOT NULL,
  whatsapp_group VARCHAR,
  show_whatsapp_group_icon BOOLEAN DEFAULT TRUE,
  momo_name VARCHAR NOT NULL,
  momo_network VARCHAR NOT NULL,
  momo_number VARCHAR NOT NULL,
  approved BOOLEAN DEFAULT FALSE,
  wallet_balance DECIMAL DEFAULT 0,
  topup_reference VARCHAR UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subagent_stores_user_id ON subagent_stores(user_id);
CREATE INDEX idx_subagent_stores_parent_agent ON subagent_stores(parent_agent_store_id);

-- 2. Subagent package prices table (pricing set by subagent)
CREATE TABLE IF NOT EXISTS subagent_package_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id UUID NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES data_packages(id) ON DELETE CASCADE,
  base_cost DECIMAL NOT NULL, -- What agent costs them (set by agent)
  sell_price DECIMAL NOT NULL, -- What subagent sells to customer
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subagent_store_id, package_id)
);

CREATE INDEX idx_subagent_package_prices_subagent ON subagent_package_prices(subagent_store_id);

-- 3. Subagent orders table
CREATE TABLE IF NOT EXISTS subagent_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id UUID NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
  parent_agent_store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
  customer_number VARCHAR NOT NULL,
  network VARCHAR NOT NULL,
  package_id UUID NOT NULL REFERENCES data_packages(id),
  size_gb DECIMAL NOT NULL,
  customer_amount DECIMAL NOT NULL, -- What customer paid (subagent's sell price)
  agent_cost DECIMAL NOT NULL, -- What subagent paid agent
  admin_base_price DECIMAL NOT NULL, -- Admin's base price (for reference)
  profit DECIMAL GENERATED ALWAYS AS (customer_amount - agent_cost) STORED,
  payment_method VARCHAR DEFAULT 'wallet',
  paystack_reference VARCHAR,
  status VARCHAR DEFAULT 'pending',
  fulfillment_status VARCHAR DEFAULT 'pending',
  api_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subagent_orders_store ON subagent_orders(subagent_store_id);
CREATE INDEX idx_subagent_orders_agent ON subagent_orders(parent_agent_store_id);
CREATE INDEX idx_subagent_orders_created ON subagent_orders(created_at DESC);

-- 4. Subagent withdrawal requests table
CREATE TABLE IF NOT EXISTS subagent_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id UUID NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  status VARCHAR DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_subagent_withdrawal_requests_store ON subagent_withdrawal_requests(subagent_store_id);

-- 5. Subagent wallet topups table
CREATE TABLE IF NOT EXISTS subagent_wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id UUID NOT NULL REFERENCES subagent_stores(id) ON DELETE CASCADE,
  admin_id UUID,
  amount DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subagent_wallet_topups_store ON subagent_wallet_topups(subagent_store_id);

-- Update agent_package_prices to include subagent base price
ALTER TABLE agent_package_prices ADD COLUMN IF NOT EXISTS subagent_base_price DECIMAL;

-- Create notifications for subagent creation
INSERT INTO notifications (title, message, target_role, created_at)
VALUES (
  'Subagent Feature Available',
  'You can now create subagents under your store! Set base prices and let them manage their own shops.',
  'agent',
  NOW()
) ON CONFLICT DO NOTHING;
