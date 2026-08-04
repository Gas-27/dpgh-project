-- Migration: Add AFA price columns to store tables
-- 
-- Chain:  admin.afa_settings.registration_fee (floor)
--       → agent_stores.afa_bundle_price        (agent charges customers)
--       → agent_stores.afa_subagent_base_price  (NEW: agent charges subagents — their cost)
--       → subagent_stores.afa_bundle_price      (subagent charges customers)
--       → subagent_stores.afa_subsubagent_base_price (subagent charges sub-subagents — their cost)
--       → sub_subagent_stores.afa_bundle_price  (sub-subagent charges customers)

-- Price the agent sets as the base cost for their subagents' AFA registrations
ALTER TABLE agent_stores
  ADD COLUMN IF NOT EXISTS afa_subagent_base_price numeric(10,2);

-- Ensure subagent's sub-subagent base price column exists
ALTER TABLE subagent_stores
  ADD COLUMN IF NOT EXISTS afa_subsubagent_base_price numeric(10,2);

-- Ensure sub-subagent storefront price column exists
ALTER TABLE sub_subagent_stores
  ADD COLUMN IF NOT EXISTS afa_bundle_price numeric(10,2);
