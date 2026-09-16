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

-- Subagent's own storefront price for customers
ALTER TABLE subagent_stores
  ADD COLUMN IF NOT EXISTS afa_bundle_price numeric(10,2);

-- Ensure subagent's sub-subagent base price column exists
ALTER TABLE subagent_stores
  ADD COLUMN IF NOT EXISTS afa_subsubagent_base_price numeric(10,2);

-- Ensure sub-subagent storefront price column exists
ALTER TABLE sub_subagent_stores
  ADD COLUMN IF NOT EXISTS afa_bundle_price numeric(10,2);

-- Tracks whether the agent has already refunded a given order to their subagent (one-time only)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS agent_refunded_subagent BOOLEAN DEFAULT FALSE;

-- Tracks whether the subagent has already forwarded a refund to their sub-subagent (one-time only)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subagent_refunded_sub_subagent BOOLEAN DEFAULT FALSE;
