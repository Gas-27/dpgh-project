-- =============================================================================
-- FIX 1: Repair the broken trigger on sub_subagent_stores
-- -----------------------------------------------------------------------------
-- The trigger function references NEW.top_reference but the actual column is
-- NEW.topup_reference. This causes every INSERT on sub_subagent_stores to fail
-- with "record new has no field top_reference".
--
-- Run this in your Supabase SQL Editor (Database > SQL Editor).
-- =============================================================================

-- Step 1: Find the trigger and its function name
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sub_subagent_stores';

-- Step 2: View the current trigger function body (replace function name if different)
-- SELECT prosrc FROM pg_proc WHERE proname = 'your_trigger_function_name';

-- Step 3: Drop and recreate the trigger function with the correct column name.
-- IMPORTANT: Replace 'set_sub_subagent_topup_reference' with your actual function name.
-- The pattern below assumes the function generates a sequential reference on insert.

CREATE OR REPLACE FUNCTION set_sub_subagent_topup_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Only set if not already provided
  IF NEW.topup_reference IS NULL OR NEW.topup_reference = '' THEN
    SELECT COUNT(*) + 1 INTO next_num FROM sub_subagent_stores;
    NEW.topup_reference := 'Agt' || next_num::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Ensure the trigger uses this corrected function
-- (Only needed if the trigger was pointing to the old broken function)
DROP TRIGGER IF EXISTS trigger_set_sub_subagent_topup_reference ON sub_subagent_stores;

CREATE TRIGGER trigger_set_sub_subagent_topup_reference
  BEFORE INSERT ON sub_subagent_stores
  FOR EACH ROW
  EXECUTE FUNCTION set_sub_subagent_topup_reference();


-- =============================================================================
-- FIX 2: Retroactively credit agent wallets for refunds done today (2026-07-29)
-- where the refunded_amount on the order is 0 but fulfillment_status = 'refunded'.
-- -----------------------------------------------------------------------------
-- This adds the data_packages.agent_price to each agent_store's wallet_balance
-- for every order that was refunded today but got 0 credited due to the bug.
-- =============================================================================

-- Preview first (no changes) — check what will be updated
SELECT
  o.id AS order_id,
  o.agent_store_id,
  o.package_id,
  o.amount,
  o.base_price,
  o.refunded_amount,
  dp.agent_price,
  a.wallet_balance AS current_wallet_balance,
  (a.wallet_balance + COALESCE(dp.agent_price, o.amount, 0)) AS new_wallet_balance
FROM orders o
JOIN agent_stores a ON a.id = o.agent_store_id
LEFT JOIN data_packages dp ON dp.id = o.package_id
WHERE o.fulfillment_status = 'refunded'
  AND DATE(o.created_at) = '2026-07-29'
  AND (o.refunded_amount IS NULL OR o.refunded_amount = 0)
  AND o.agent_store_id IS NOT NULL;

-- Apply the wallet credit (run this after verifying the preview above)
UPDATE agent_stores a
SET wallet_balance = a.wallet_balance + refund_amounts.credit
FROM (
  SELECT
    o.agent_store_id,
    SUM(COALESCE(dp.agent_price, o.amount, 0)) AS credit
  FROM orders o
  LEFT JOIN data_packages dp ON dp.id = o.package_id
  WHERE o.fulfillment_status = 'refunded'
    AND DATE(o.created_at) = '2026-07-29'
    AND (o.refunded_amount IS NULL OR o.refunded_amount = 0)
    AND o.agent_store_id IS NOT NULL
  GROUP BY o.agent_store_id
) refund_amounts
WHERE a.id = refund_amounts.agent_store_id;

-- Mark these orders with the correct refunded_amount so they show correctly
UPDATE orders o
SET refunded_amount = COALESCE(dp.agent_price, o.amount, 0)
FROM data_packages dp
WHERE dp.id = o.package_id
  AND o.fulfillment_status = 'refunded'
  AND DATE(o.created_at) = '2026-07-29'
  AND (o.refunded_amount IS NULL OR o.refunded_amount = 0)
  AND o.agent_store_id IS NOT NULL;


-- =============================================================================
-- FIX 3: Also credit subagent wallets for refunds done today where credit = 0
-- =============================================================================

UPDATE subagent_stores s
SET wallet_balance = s.wallet_balance + refund_amounts.credit
FROM (
  SELECT
    o.subagent_store_id,
    SUM(COALESCE(dp.agent_price, o.amount, 0)) AS credit
  FROM orders o
  LEFT JOIN data_packages dp ON dp.id = o.package_id
  WHERE o.fulfillment_status = 'refunded'
    AND DATE(o.created_at) = '2026-07-29'
    AND (o.refunded_amount IS NULL OR o.refunded_amount = 0)
    AND o.subagent_store_id IS NOT NULL
    AND o.agent_store_id IS NULL
  GROUP BY o.subagent_store_id
) refund_amounts
WHERE s.id = refund_amounts.subagent_store_id;
