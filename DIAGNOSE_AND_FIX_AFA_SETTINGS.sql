-- STEP 1: Check current RLS policies on afa_settings
SELECT policyname, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'afa_settings'
ORDER BY policyname;

-- STEP 2: Check the actual table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'afa_settings'
ORDER BY ordinal_position;

-- STEP 3: Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'afa_settings';

-- STEP 4: List the actual content
SELECT id, special_mtn_mashup_1_enabled, special_mtn_mashup_2_enabled FROM afa_settings LIMIT 1;
