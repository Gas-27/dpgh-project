# Datahubnet Mashup Package ID Migration

This document provides the exact SQL updates needed to populate `data_package_id` for all mashup packages.

## Mapping Reference
These are the datahubnet package IDs for mashup packages:
- ID 14 → 1.7GB MASHUP
- ID 3 → 5.1GB MASHUP
- ID 16 → 2.6 GB + 1,077 mins MASHUP
- ID 17 → 8.2GB MASHUP
- ID 18 → 11.9GB MASHUP
- ID 20 → 3.61GB + 1485 mins MASHUP
- ID 19 → 15.3GB MASHUP

## SQL Migration Script

Run this SQL in the Supabase SQL Editor to update all mashup packages:

```sql
-- Update mashup packages with their datahubnet IDs
UPDATE public.data_packages
SET data_package_id = CASE
  WHEN network = 'mashup' AND size_gb = 1.7 THEN 14
  WHEN network = 'mashup' AND size_gb = 5.1 THEN 3
  WHEN network = 'mashup' AND size_gb = 2.6 AND size_gb_text LIKE '%1,077 mins%' THEN 16
  WHEN network = 'mashup' AND size_gb = 8.2 THEN 17
  WHEN network = 'mashup' AND size_gb = 11.9 THEN 18
  WHEN network = 'mashup' AND size_gb = 3.61 AND size_gb_text LIKE '%1485%' THEN 20
  WHEN network = 'mashup' AND size_gb = 15.3 THEN 19
  ELSE data_package_id
END
WHERE network = 'mashup' AND data_package_id IS NULL;
```

## Manual Update via Supabase UI

If you prefer to update manually:

1. Go to Supabase Dashboard → Table Editor → data_packages
2. Filter by network = 'mashup'
3. For each package, update the `data_package_id` column:
   - 1.7GB → 14
   - 5.1GB → 3
   - 2.6 GB + 1,077 mins → 16
   - 8.2GB → 17
   - 11.9GB → 18
   - 3.61GB + 1485 mins → 20
   - 15.3GB → 19

## Verification

After updating, run this query to verify:

```sql
SELECT id, network, size_gb, size_gb_text, data_package_id, price, active
FROM public.data_packages
WHERE network = 'mashup'
ORDER BY size_gb;
```

All mashup packages should now have non-NULL `data_package_id` values.
