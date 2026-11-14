-- Migration: Template Pricing for Sub-Subagents
-- 
-- This migration sets up the proper pricing flow:
-- 1. SubAgents set prices in subagent_package_prices (template prices)
-- 2. When a new sub-subagent registers, these template prices are copied
--    to sub_subagent_package_prices as their base cost
-- 3. Sub-subagents can then set their own selling prices above the base

-- Step 1: Create a function that copies template prices when a sub-subagent is created
CREATE OR REPLACE FUNCTION copy_template_prices_to_subsubagent()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new sub-subagent is created, copy all template prices from their parent (subagent)
  INSERT INTO sub_subagent_package_prices (
    subagent_store_id,
    sub_subagent_store_id,
    package_id,
    base_price,
    subagent_minimum_price,
    sell_price
  )
  SELECT
    sap.subagent_store_id,
    NEW.id as sub_subagent_store_id,
    sap.package_id,
    sap.sell_price as base_price,
    sap.sell_price as subagent_minimum_price,
    sap.sell_price as sell_price
  FROM subagent_package_prices sap
  WHERE sap.subagent_store_id = NEW.subagent_store_id
  ON CONFLICT (subagent_store_id, package_id, sub_subagent_store_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger to call this function when a sub-subagent is created
DROP TRIGGER IF EXISTS trigger_copy_template_prices ON sub_subagent_stores;

CREATE TRIGGER trigger_copy_template_prices
AFTER INSERT ON sub_subagent_stores
FOR EACH ROW
EXECUTE FUNCTION copy_template_prices_to_subsubagent();

-- Step 3: Make sure the RLS policies allow SubAgents to write to subagent_package_prices
-- This should already exist from Store Prices tab, but just in case:
DROP POLICY IF EXISTS "Allow subagents to manage pricing" ON subagent_package_prices;

CREATE POLICY "Allow subagents to manage pricing"
ON subagent_package_prices
FOR ALL
TO authenticated
USING (
  subagent_store_id IN (
    SELECT id FROM subagent_stores WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  subagent_store_id IN (
    SELECT id FROM subagent_stores WHERE user_id = auth.uid()
  )
);
