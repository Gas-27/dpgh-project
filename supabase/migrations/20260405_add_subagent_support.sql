-- Add minimum_subagent_price to agent_stores table
ALTER TABLE agent_stores ADD COLUMN IF NOT EXISTS minimum_subagent_price DECIMAL(10,2) DEFAULT 0;

-- Create sub_agents table
CREATE TABLE IF NOT EXISTS sub_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sub_agent_name VARCHAR(255) NOT NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  support_number VARCHAR(20) NOT NULL,
  momo_number VARCHAR(20) NOT NULL,
  momo_name VARCHAR(255) NOT NULL,
  momo_network VARCHAR(50) NOT NULL,
  minimum_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sub_agent_prices table
CREATE TABLE IF NOT EXISTS sub_agent_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_agent_id UUID NOT NULL REFERENCES sub_agents(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES data_packages(id) ON DELETE CASCADE,
  sell_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sub_agent_id, package_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sub_agents_agent_store_id ON sub_agents(agent_store_id);
CREATE INDEX IF NOT EXISTS idx_sub_agents_user_id ON sub_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_agent_prices_sub_agent_id ON sub_agent_prices(sub_agent_id);

-- Add RLS policies for sub_agents table
ALTER TABLE sub_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sub-agents" ON sub_agents
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM agent_stores 
      WHERE agent_stores.id = sub_agents.agent_store_id 
      AND agent_stores.user_id = auth.uid()
    )
  );

CREATE POLICY "Agent stores can create sub-agents" ON sub_agents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_stores 
      WHERE agent_stores.id = agent_store_id 
      AND agent_stores.user_id = auth.uid()
    )
  );

-- Add RLS policies for sub_agent_prices table
ALTER TABLE sub_agent_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sub-agent prices" ON sub_agent_prices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sub_agents 
      WHERE sub_agents.id = sub_agent_prices.sub_agent_id 
      AND (sub_agents.user_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM agent_stores 
             WHERE agent_stores.id = sub_agents.agent_store_id 
             AND agent_stores.user_id = auth.uid()
           ))
    )
  );
