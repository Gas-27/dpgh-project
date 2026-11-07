# Special MTN Mashup - Final Fixes Summary

## Status Update

✅ **Special MTN Mashup button is showing in Buy Data section** (as shown in your screenshot)

## Issues Remaining & Fixes Applied

### Issue 1: Admin Dashboard - "invalid input syntax for type uid: '1'"

**Root Cause**: The component was incorrectly handling the afa_settings ID

**Fix Applied**: Updated SpecialMTNMashupPricingManager.tsx to:
- Fetch all fields from afa_settings (not just ID)
- Use `.limit(1)` to get the first record
- Handle any ID type (UUID, integer, or string)

**Status**: ✅ Code fix deployed

### Issue 2: Agent Permission Denied Error

**Root Cause**: RLS policies on agent_special_mtn_mashup_pricing table are too restrictive or querying auth.users table causing access issues

**Fix Required**: Run this SQL in Supabase > SQL Editor

```sql
-- Drop old policies
DROP POLICY IF EXISTS "agents_can_manage_own_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "admins_can_manage_all_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "agents_own_special_mtn_pricing" ON agent_special_mtn_mashup_pricing;
DROP POLICY IF EXISTS "admins_can_manage_all_agent_pricing" ON agent_special_mtn_mashup_pricing;

-- Agent policies - simple direct comparison without table lookup
CREATE POLICY "agents_read_own_pricing" ON agent_special_mtn_mashup_pricing
FOR SELECT
USING (auth.uid() = agent_id);

CREATE POLICY "agents_insert_own_pricing" ON agent_special_mtn_mashup_pricing
FOR INSERT
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "agents_update_own_pricing" ON agent_special_mtn_mashup_pricing
FOR UPDATE
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "agents_delete_own_pricing" ON agent_special_mtn_mashup_pricing
FOR DELETE
USING (auth.uid() = agent_id);

-- Admin policies
CREATE POLICY "admins_read_all_pricing" ON agent_special_mtn_mashup_pricing
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "admins_modify_all_pricing" ON agent_special_mtn_mashup_pricing
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE agent_special_mtn_mashup_pricing ENABLE ROW LEVEL SECURITY;
```

**Status**: ⏳ Awaiting SQL execution in Supabase

### Issue 3: Admin RLS for afa_settings

**Fix Required**: Run this SQL to allow admins to update afa_settings

```sql
ALTER TABLE afa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_update_afa_settings" ON afa_settings;

CREATE POLICY "admins_update_afa_settings" ON afa_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

DROP POLICY IF EXISTS "admins_read_afa_settings" ON afa_settings;

CREATE POLICY "admins_read_afa_settings" ON afa_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);
```

**Status**: ⏳ Awaiting SQL execution in Supabase

## What Works Now

✅ Special MTN Mashup button visible in Agent Dashboard Buy Data section
✅ Packages can be filtered by Special MTN
✅ Buy Now buttons open payment dialog
✅ Admin component better handles ID types
✅ All code changes compiled successfully

## Your Next Steps

1. **Copy the SQL fixes above**
2. **Go to Supabase > Your Project > SQL Editor**
3. **Run Issue 2 SQL** (agent policies first - this is critical)
4. **Run Issue 3 SQL** (admin policies)
5. **Test Admin Dashboard**: Try saving Special MTN pricing again
6. **Test Agent Dashboard**: Try setting agent prices

## Build Status
✅ All changes compiled successfully
