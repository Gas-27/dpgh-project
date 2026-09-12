-- DIAGNOSTIC: Check if sub-subagents have correct parent links and RLS is working

-- 1. Count total sub-subagents
SELECT COUNT(*) as total_sub_subagents FROM sub_subagent_stores;

-- 2. Show all sub-subagents with their parent subagent info
SELECT 
  ssa.id,
  ssa.store_name,
  ssa.subagent_store_id,
  sa.store_name as parent_subagent_name,
  sa.user_id as parent_user_id,
  ssa.user_id as subsub_user_id,
  ssa.created_at
FROM sub_subagent_stores ssa
LEFT JOIN subagent_stores sa ON sa.id = ssa.subagent_store_id
ORDER BY ssa.created_at DESC;

-- 3. Count sub-subagents grouped by parent
SELECT 
  subagent_store_id,
  COUNT(*) as count,
  (SELECT store_name FROM subagent_stores WHERE id = sub_subagent_stores.subagent_store_id) as parent_name
FROM sub_subagent_stores
GROUP BY subagent_store_id
ORDER BY count DESC;

-- 4. Check RLS policies on sub_subagent_stores table
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'sub_subagent_stores'
ORDER BY policyname;

-- 5. Check if subagent_store_id column allows NULL (it shouldn't)
SELECT 
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'sub_subagent_stores'
AND column_name IN ('id', 'subagent_store_id', 'user_id');
