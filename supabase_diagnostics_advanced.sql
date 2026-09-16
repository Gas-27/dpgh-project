-- ==============================================================
-- ADVANCED DIAGNOSTICS FOR STOREFRONT "STORE NOT FOUND" ISSUES
-- ==============================================================

-- 1. Find ALL subagent stores with potential data issues
SELECT 
  id,
  store_name,
  LENGTH(TRIM(store_name)) as store_name_length,
  approved,
  user_id,
  created_at,
  CASE 
    WHEN store_name IS NULL THEN 'NULL_STORE_NAME'
    WHEN TRIM(store_name) = '' THEN 'EMPTY_STORE_NAME'
    WHEN store_name LIKE '%  %' THEN 'HAS_DOUBLE_SPACES'
    WHEN store_name ~ '^\s' OR store_name ~ '\s$' THEN 'HAS_LEADING_TRAILING_SPACE'
    WHEN store_name != TRIM(store_name) THEN 'NEEDS_TRIM'
    ELSE 'OK'
  END as data_status
FROM public.subagent_stores
ORDER BY store_name;

-- 2. Find agent stores with potential data issues
SELECT 
  id,
  store_name,
  LENGTH(TRIM(store_name)) as store_name_length,
  approved,
  user_id,
  created_at,
  CASE 
    WHEN store_name IS NULL THEN 'NULL_STORE_NAME'
    WHEN TRIM(store_name) = '' THEN 'EMPTY_STORE_NAME'
    WHEN store_name LIKE '%  %' THEN 'HAS_DOUBLE_SPACES'
    WHEN store_name ~ '^\s' OR store_name ~ '\s$' THEN 'HAS_LEADING_TRAILING_SPACE'
    WHEN store_name != TRIM(store_name) THEN 'NEEDS_TRIM'
    ELSE 'OK'
  END as data_status
FROM public.agent_stores
ORDER BY store_name;

-- 3. Check for duplicate store names (case-insensitive)
SELECT 
  LOWER(TRIM(store_name)) as normalized_name,
  COUNT(*) as count,
  ARRAY_AGG(id) as ids,
  ARRAY_AGG(store_name) as store_names
FROM public.subagent_stores
WHERE store_name IS NOT NULL
GROUP BY LOWER(TRIM(store_name))
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 4. Same for agent stores
SELECT 
  LOWER(TRIM(store_name)) as normalized_name,
  COUNT(*) as count,
  ARRAY_AGG(id) as ids,
  ARRAY_AGG(store_name) as store_names
FROM public.agent_stores
WHERE store_name IS NOT NULL
GROUP BY LOWER(TRIM(store_name))
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 5. Check subagent stores created in last 7 days (newly created ones might have issues)
SELECT 
  id,
  store_name,
  approved,
  user_id,
  created_at,
  EXTRACT(DAY FROM NOW() - created_at) as days_ago
FROM public.subagent_stores
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 6. Check for stores NOT approved (these might show "Store Not Found" if RLS is strict)
SELECT 
  id,
  store_name,
  approved,
  user_id,
  created_at
FROM public.subagent_stores
WHERE approved = false
LIMIT 20;

-- 7. Count breakdown of data status
SELECT 
  CASE 
    WHEN store_name IS NULL THEN 'NULL_STORE_NAME'
    WHEN TRIM(store_name) = '' THEN 'EMPTY_STORE_NAME'
    WHEN store_name LIKE '%  %' THEN 'HAS_DOUBLE_SPACES'
    WHEN store_name ~ '^\s' OR store_name ~ '\s$' THEN 'HAS_LEADING_TRAILING_SPACE'
    WHEN store_name != TRIM(store_name) THEN 'NEEDS_TRIM'
    ELSE 'OK'
  END as status,
  COUNT(*) as count
FROM public.subagent_stores
GROUP BY status
ORDER BY count DESC;

-- 8. Same for agent stores
SELECT 
  CASE 
    WHEN store_name IS NULL THEN 'NULL_STORE_NAME'
    WHEN TRIM(store_name) = '' THEN 'EMPTY_STORE_NAME'
    WHEN store_name LIKE '%  %' THEN 'HAS_DOUBLE_SPACES'
    WHEN store_name ~ '^\s' OR store_name ~ '\s$' THEN 'HAS_LEADING_TRAILING_SPACE'
    WHEN store_name != TRIM(store_name) THEN 'NEEDS_TRIM'
    ELSE 'OK'
  END as status,
  COUNT(*) as count
FROM public.agent_stores
GROUP BY status
ORDER BY count DESC;

-- 9. Check RLS policies are enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('agent_stores', 'subagent_stores', 'sub_subagent_stores')
ORDER BY tablename;

-- 10. List all RLS policies for these tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual as policy_definition
FROM pg_policies
WHERE tablename IN ('agent_stores', 'subagent_stores', 'sub_subagent_stores')
ORDER BY tablename, policyname;

-- 11. Find stores with missing agent_store data (for subagent stores)
SELECT 
  ss.id,
  ss.store_name,
  ss.agent_store_id,
  as2.store_name as agent_store_name,
  CASE 
    WHEN ss.agent_store_id IS NULL THEN 'NO_AGENT_STORE_ID'
    WHEN as2.id IS NULL THEN 'AGENT_STORE_NOT_FOUND'
    ELSE 'OK'
  END as status
FROM public.subagent_stores ss
LEFT JOIN public.agent_stores as2 ON ss.agent_store_id = as2.id
WHERE ss.agent_store_id IS NULL OR as2.id IS NULL;

-- 12. Summary statistics
SELECT 
  'subagent_stores' as table_name,
  COUNT(*) as total_stores,
  COUNT(CASE WHEN store_name IS NOT NULL THEN 1 END) as with_store_name,
  COUNT(CASE WHEN approved = true THEN 1 END) as approved,
  COUNT(CASE WHEN approved = false THEN 1 END) as not_approved
FROM public.subagent_stores
UNION ALL
SELECT 
  'agent_stores' as table_name,
  COUNT(*) as total_stores,
  COUNT(CASE WHEN store_name IS NOT NULL THEN 1 END) as with_store_name,
  COUNT(CASE WHEN approved = true THEN 1 END) as approved,
  COUNT(CASE WHEN approved = false THEN 1 END) as not_approved
FROM public.agent_stores;

-- 13. Test if public read policy is working - simulate anonymous access
-- This tests if the "Anyone can view" policy is working
SELECT 
  COUNT(*) as total_subagent_stores_visible
FROM public.subagent_stores;

-- 14. Identify stores that might be causing matching issues (special characters, etc.)
SELECT 
  id,
  store_name,
  store_name COLLATE "C" as store_name_bytes,
  LENGTH(store_name) as byte_length,
  LENGTH(TRIM(store_name)) as trimmed_length
FROM public.subagent_stores
WHERE store_name ~ '[^\x20-\x7E]'  -- Contains non-ASCII characters
   OR store_name LIKE '%\_%'  -- Contains underscore
   OR store_name LIKE '%-%'   -- Contains hyphen
LIMIT 50;
