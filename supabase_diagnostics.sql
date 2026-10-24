-- ============ DIAGNOSTIC SQL QUERIES FOR STOREFRONT ISSUES ============

-- 1. Check if RLS is enabled on all store tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('agent_stores', 'subagent_stores', 'sub_subagent_stores')
AND schemaname = 'public';

-- 2. List all RLS policies on store tables
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('agent_stores', 'subagent_stores', 'sub_subagent_stores')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check agent_stores - looking for problematic records
SELECT 
  id,
  store_name,
  user_id,
  approved,
  created_at,
  CASE 
    WHEN store_name IS NULL THEN 'MISSING_STORE_NAME'
    WHEN store_name = '' THEN 'EMPTY_STORE_NAME'
    WHEN user_id IS NULL THEN 'MISSING_USER_ID'
    ELSE 'OK'
  END as status
FROM public.agent_stores
ORDER BY created_at DESC;

-- 4. Check subagent_stores - looking for problematic records
SELECT 
  id,
  store_name,
  agent_store_id,
  user_id,
  approved,
  created_at,
  CASE 
    WHEN store_name IS NULL THEN 'MISSING_STORE_NAME'
    WHEN store_name = '' THEN 'EMPTY_STORE_NAME'
    WHEN agent_store_id IS NULL THEN 'MISSING_AGENT_STORE_ID'
    WHEN user_id IS NULL THEN 'MISSING_USER_ID'
    ELSE 'OK'
  END as status
FROM public.subagent_stores
ORDER BY created_at DESC;

-- 5. Check sub_subagent_stores - looking for problematic records
SELECT 
  id,
  store_name,
  subagent_store_id,
  user_id,
  approved,
  created_at,
  CASE 
    WHEN store_name IS NULL THEN 'MISSING_STORE_NAME'
    WHEN store_name = '' THEN 'EMPTY_STORE_NAME'
    WHEN subagent_store_id IS NULL THEN 'MISSING_SUBAGENT_STORE_ID'
    WHEN user_id IS NULL THEN 'MISSING_USER_ID'
    ELSE 'OK'
  END as status
FROM public.sub_subagent_stores
ORDER BY created_at DESC;

-- 6. Find stores with problematic names (spaces, special chars that might break matching)
SELECT 
  id,
  store_name,
  LENGTH(store_name) as name_length,
  'agent_stores' as table_name
FROM public.agent_stores
WHERE store_name LIKE '%  %' OR store_name LIKE '% ' OR store_name LIKE ' %'
UNION ALL
SELECT 
  id,
  store_name,
  LENGTH(store_name),
  'subagent_stores'
FROM public.subagent_stores
WHERE store_name LIKE '%  %' OR store_name LIKE '% ' OR store_name LIKE ' %'
UNION ALL
SELECT 
  id,
  store_name,
  LENGTH(store_name),
  'sub_subagent_stores'
FROM public.sub_subagent_stores
WHERE store_name LIKE '%  %' OR store_name LIKE '% ' OR store_name LIKE ' %';

-- 7. Count stores by status (approved vs not approved)
SELECT 
  'agent_stores' as table_name,
  approved,
  COUNT(*) as count
FROM public.agent_stores
GROUP BY approved
UNION ALL
SELECT 
  'subagent_stores',
  approved,
  COUNT(*)
FROM public.subagent_stores
GROUP BY approved
UNION ALL
SELECT 
  'sub_subagent_stores',
  approved,
  COUNT(*)
FROM public.sub_subagent_stores
GROUP BY approved;

-- 8. Find stores that might be duplicates or have similar names (could cause matching issues)
SELECT 
  store_name,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as ids,
  'agent_stores' as table_name
FROM public.agent_stores
GROUP BY LOWER(TRIM(store_name))
HAVING COUNT(*) > 1
UNION ALL
SELECT 
  store_name,
  COUNT(*),
  STRING_AGG(id::text, ', '),
  'subagent_stores'
FROM public.subagent_stores
GROUP BY LOWER(TRIM(store_name))
HAVING COUNT(*) > 1
UNION ALL
SELECT 
  store_name,
  COUNT(*),
  STRING_AGG(id::text, ', '),
  'sub_subagent_stores'
FROM public.sub_subagent_stores
GROUP BY LOWER(TRIM(store_name))
HAVING COUNT(*) > 1;

-- 9. Check for users with multiple stores (might indicate data integrity issues)
SELECT 
  user_id,
  COUNT(*) as store_count,
  STRING_AGG(store_name, ', ') as store_names,
  'agent_stores' as table_name
FROM public.agent_stores
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 3
UNION ALL
SELECT 
  user_id,
  COUNT(*),
  STRING_AGG(store_name, ', '),
  'subagent_stores'
FROM public.subagent_stores
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 3
UNION ALL
SELECT 
  user_id,
  COUNT(*),
  STRING_AGG(store_name, ', '),
  'sub_subagent_stores'
FROM public.sub_subagent_stores
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 3;

-- 10. Test a specific storefront lookup - replace 'jerry' with the problematic store name
-- This simulates what the frontend does
SELECT 
  id,
  store_name,
  approved,
  user_id,
  created_at
FROM public.subagent_stores
WHERE LOWER(TRIM(store_name)) = LOWER('jerry')
LIMIT 10;

-- 11. Check if there are any stores created within the last 24 hours that might not have RLS applied yet
SELECT 
  id,
  store_name,
  created_at,
  'agent_stores' as table_name
FROM public.agent_stores
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  id,
  store_name,
  created_at,
  'subagent_stores'
FROM public.subagent_stores
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  id,
  store_name,
  created_at,
  'sub_subagent_stores'
FROM public.sub_subagent_stores
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 12. Get summary statistics
SELECT 
  'agent_stores' as table_name,
  COUNT(*) as total_stores,
  COUNT(CASE WHEN store_name IS NOT NULL AND store_name != '' THEN 1 END) as stores_with_names,
  COUNT(CASE WHEN approved = true THEN 1 END) as approved_stores,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as stores_with_users
FROM public.agent_stores
UNION ALL
SELECT 
  'subagent_stores',
  COUNT(*),
  COUNT(CASE WHEN store_name IS NOT NULL AND store_name != '' THEN 1 END),
  COUNT(CASE WHEN approved = true THEN 1 END),
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END)
FROM public.subagent_stores
UNION ALL
SELECT 
  'sub_subagent_stores',
  COUNT(*),
  COUNT(CASE WHEN store_name IS NOT NULL AND store_name != '' THEN 1 END),
  COUNT(CASE WHEN approved = true THEN 1 END),
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END)
FROM public.sub_subagent_stores;
