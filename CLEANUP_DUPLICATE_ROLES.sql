-- ============================================================================
-- CLEANUP: Remove duplicate user_roles entries
-- Run this in Supabase SQL Editor to clean up existing duplicates
-- ============================================================================

-- STEP 1: Check for duplicate entries
SELECT user_id, role, COUNT(*) as count 
FROM public.user_roles 
GROUP BY user_id, role 
HAVING COUNT(*) > 1;

-- STEP 2: Delete duplicate rows, keeping only the first one
DELETE FROM public.user_roles 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, role) id 
  FROM public.user_roles 
  ORDER BY user_id, role, created_at ASC
);

-- STEP 3: Verify unique constraint
SELECT user_id, role, COUNT(*) as count 
FROM public.user_roles 
GROUP BY user_id, role;

-- STEP 4: Verify the table structure
SELECT * FROM public.user_roles ORDER BY created_at DESC LIMIT 20;
