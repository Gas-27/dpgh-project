-- Check AFA settings table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'afa_settings'
ORDER BY ordinal_position;

-- Check what's actually in the table
SELECT * FROM afa_settings LIMIT 5;
