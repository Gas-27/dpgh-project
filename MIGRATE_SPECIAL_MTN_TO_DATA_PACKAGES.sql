-- Step 1: Check the data_packages table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'data_packages'
ORDER BY ordinal_position;

-- Step 2: Check current afa_settings data
SELECT 
  special_mtn_mashup_1_user_price,
  special_mtn_mashup_1_agent_price,
  special_mtn_mashup_1_enabled,
  special_mtn_mashup_2_user_price,
  special_mtn_mashup_2_agent_price,
  special_mtn_mashup_2_enabled,
  special_mtn_mashup_3_user_price,
  special_mtn_mashup_3_agent_price,
  special_mtn_mashup_3_enabled,
  special_mtn_mashup_4_user_price,
  special_mtn_mashup_4_agent_price,
  special_mtn_mashup_4_enabled
FROM afa_settings
LIMIT 1;

-- Step 3: Insert Special MTN Mashup packages into data_packages
-- TIER 1: 125 mins + 0.36GB
INSERT INTO data_packages (
  network, 
  package_name, 
  size_gb, 
  mins,
  user_price, 
  agent_price, 
  is_active
)
SELECT 
  'mtn',
  'Special MTN Mashup - Tier 1',
  0.36,
  125,
  special_mtn_mashup_1_user_price,
  special_mtn_mashup_1_agent_price,
  special_mtn_mashup_1_enabled
FROM afa_settings
WHERE special_mtn_mashup_1_enabled = true
ON CONFLICT DO NOTHING;

-- TIER 2: 360 mins + 0.87GB
INSERT INTO data_packages (
  network, 
  package_name, 
  size_gb, 
  mins,
  user_price, 
  agent_price, 
  is_active
)
SELECT 
  'mtn',
  'Special MTN Mashup - Tier 2',
  0.87,
  360,
  special_mtn_mashup_2_user_price,
  special_mtn_mashup_2_agent_price,
  special_mtn_mashup_2_enabled
FROM afa_settings
WHERE special_mtn_mashup_2_enabled = true
ON CONFLICT DO NOTHING;

-- TIER 3: 700 mins + 1.6GB
INSERT INTO data_packages (
  network, 
  package_name, 
  size_gb, 
  mins,
  user_price, 
  agent_price, 
  is_active
)
SELECT 
  'mtn',
  'Special MTN Mashup - Tier 3',
  1.6,
  700,
  special_mtn_mashup_3_user_price,
  special_mtn_mashup_3_agent_price,
  special_mtn_mashup_3_enabled
FROM afa_settings
WHERE special_mtn_mashup_3_enabled = true
ON CONFLICT DO NOTHING;

-- TIER 4: 1000 mins + 2.6GB
INSERT INTO data_packages (
  network, 
  package_name, 
  size_gb, 
  mins,
  user_price, 
  agent_price, 
  is_active
)
SELECT 
  'mtn',
  'Special MTN Mashup - Tier 4',
  2.6,
  1000,
  special_mtn_mashup_4_user_price,
  special_mtn_mashup_4_agent_price,
  special_mtn_mashup_4_enabled
FROM afa_settings
WHERE special_mtn_mashup_4_enabled = true
ON CONFLICT DO NOTHING;

-- Step 4: Verify the new packages were created
SELECT id, network, package_name, size_gb, mins, user_price, agent_price, is_active
FROM data_packages
WHERE package_name LIKE 'Special MTN Mashup%'
ORDER BY mins;

-- Step 5: (OPTIONAL) Drop the special_mtn_* columns from afa_settings after verifying data moved
-- ALTER TABLE afa_settings 
-- DROP COLUMN IF EXISTS special_mtn_mashup_1_user_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_1_agent_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_1_enabled,
-- DROP COLUMN IF EXISTS special_mtn_mashup_2_user_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_2_agent_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_2_enabled,
-- DROP COLUMN IF EXISTS special_mtn_mashup_3_user_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_3_agent_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_3_enabled,
-- DROP COLUMN IF EXISTS special_mtn_mashup_4_user_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_4_agent_price,
-- DROP COLUMN IF EXISTS special_mtn_mashup_4_enabled;
