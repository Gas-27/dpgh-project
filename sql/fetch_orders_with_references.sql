-- Fetch ALL orders with complete references to all related accounts
-- This ensures every order pulls customer, agent, subagent, sub-subagent, and API user data

SELECT 
  o.id,
  o.customer_number,
  o.network,
  o.size_gb,
  o.amount,
  o.status,
  o.fulfillment_status,
  o.order_status,
  o.payment_method,
  o.refunded_amount,
  o.refunded_at,
  o.created_at,
  o.updated_at,
  
  -- Customer/User References
  o.customer_id,
  u.email AS customer_email,
  u.name AS customer_name,
  
  -- Agent Store References
  o.agent_store_id,
  a.store_name AS agent_store_name,
  a.whatsapp_number AS agent_whatsapp,
  a.support_number AS agent_support,
  a.wallet_balance AS agent_wallet_balance,
  
  -- Subagent Store References
  o.subagent_store_id,
  s.store_name AS subagent_store_name,
  s.whatsapp_number AS subagent_whatsapp,
  s.support_number AS subagent_support,
  s.wallet_balance AS subagent_wallet_balance,
  s.agent_store_id AS subagent_parent_agent_id,
  
  -- Sub-Subagent Store References
  o.sub_subagent_store_id,
  ss.store_name AS sub_subagent_store_name,
  ss.whatsapp_number AS sub_subagent_whatsapp,
  ss.support_number AS sub_subagent_support,
  ss.wallet_balance AS sub_subagent_wallet_balance,
  ss.subagent_store_id AS sub_subagent_parent_subagent_id,
  
  -- API User References
  o.api_user,
  api.wallet AS api_user_wallet,
  api.topup_reference AS api_topup_reference,
  
  -- Pricing References
  o.agent_price,
  o.subagent_package_prices_id,
  spp.base_price AS subagent_package_base_price,
  spp.sell_price AS subagent_package_sell_price,
  
  -- Refund Status
  o.agent_refunded_subagent,
  o.subagent_refunded_sub_subagent

FROM orders o

-- Left join user/customer table
LEFT JOIN users u ON o.customer_id = u.id

-- Left join agent stores
LEFT JOIN agent_stores a ON o.agent_store_id = a.id

-- Left join subagent stores
LEFT JOIN subagent_stores s ON o.subagent_store_id = s.id

-- Left join sub-subagent stores
LEFT JOIN sub_subagent_stores ss ON o.sub_subagent_store_id = ss.id

-- Left join API users
LEFT JOIN api_users api ON o.api_user = api.topup_reference

-- Left join subagent package prices
LEFT JOIN subagent_package_prices spp ON o.subagent_package_prices_id = spp.id

-- Order by most recent first
ORDER BY o.created_at DESC;


-- ============================================================================
-- ALTERNATIVE: Filtered queries for specific use cases
-- ============================================================================

-- Fetch only REFUNDED orders with all references
SELECT 
  o.id,
  o.customer_number,
  o.status,
  o.fulfillment_status,
  o.refunded_amount,
  o.refunded_at,
  o.created_at,
  u.email AS customer_email,
  a.store_name AS agent_store_name,
  s.store_name AS subagent_store_name,
  ss.store_name AS sub_subagent_store_name,
  api.topup_reference AS api_user_ref,
  a.wallet_balance AS agent_wallet,
  s.wallet_balance AS subagent_wallet,
  ss.wallet_balance AS sub_subagent_wallet,
  api.wallet AS api_user_wallet

FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN agent_stores a ON o.agent_store_id = a.id
LEFT JOIN subagent_stores s ON o.subagent_store_id = s.id
LEFT JOIN sub_subagent_stores ss ON o.sub_subagent_store_id = ss.id
LEFT JOIN api_users api ON o.api_user = api.topup_reference

WHERE o.fulfillment_status = 'refunded' 
   OR o.status = 'refunded'
   OR LOWER(o.order_status) = 'refunded'

ORDER BY o.refunded_at DESC;


-- ============================================================================
-- Fetch orders by source with all details
-- ============================================================================

-- Count orders by source
SELECT 
  CASE 
    WHEN o.sub_subagent_store_id IS NOT NULL THEN 'Sub-Subagent'
    WHEN o.subagent_store_id IS NOT NULL THEN 'Subagent'
    WHEN o.agent_store_id IS NOT NULL THEN 'Agent'
    WHEN o.api_user IS NOT NULL THEN 'API'
    ELSE 'Direct'
  END AS source_type,
  COUNT(*) AS order_count,
  SUM(o.amount) AS total_amount,
  SUM(o.refunded_amount) AS total_refunded
  
FROM orders o

GROUP BY source_type
ORDER BY order_count DESC;


-- ============================================================================
-- Fetch specific order with complete hierarchy
-- ============================================================================

-- For a given order ID, fetch complete chain with all references
SELECT 
  o.*,
  u.email AS customer_email,
  u.name AS customer_name,
  a.store_name AS agent_name,
  a.store_url AS agent_url,
  a.wallet_balance AS agent_wallet,
  s.store_name AS subagent_name,
  s.store_url AS subagent_url,
  s.wallet_balance AS subagent_wallet,
  ss.store_name AS sub_subagent_name,
  ss.store_url AS sub_subagent_url,
  ss.wallet_balance AS sub_subagent_wallet,
  api.topup_reference AS api_reference,
  api.wallet AS api_wallet

FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN agent_stores a ON o.agent_store_id = a.id
LEFT JOIN subagent_stores s ON o.subagent_store_id = s.id
LEFT JOIN sub_subagent_stores ss ON o.sub_subagent_store_id = ss.id
LEFT JOIN api_users api ON o.api_user = api.topup_reference

WHERE o.id = $1;  -- Replace $1 with specific order ID
