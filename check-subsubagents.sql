-- Check what sub-subagents exist and their subagent_store_id
SELECT 
  id,
  store_name,
  subagent_store_id,
  created_at
FROM sub_subagent_stores
ORDER BY created_at DESC
LIMIT 50;

-- Also check subagent stores
SELECT 
  id,
  store_name,
  agent_store_id,
  created_at
FROM subagent_stores
ORDER BY created_at DESC
LIMIT 50;
