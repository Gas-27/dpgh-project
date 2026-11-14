# Special MTN Mashup - Bug Fixes & Issues

## Issue 1: Admin Dashboard - UUID Validation Error ✅ FIXED IN CODE

**Error**: "Invalid input syntax for type uuid: "1""

**Root Cause**: Component used hardcoded string `'1'` instead of fetching the actual UUID from afa_settings table.

**Fix Applied**: Updated `SpecialMTNMashupPricingManager.tsx` to fetch the real settings ID before saving.

**File Changed**: `/src/components/SpecialMTNMashupPricingManager.tsx` (lines 88-117)

**Status**: ✅ Code fix deployed, build verified

---

## Issue 2: Agent Dashboard - Permission Denied ⏳ REQUIRES SQL FIX

**Error**: "permission denied for table users"

**Root Cause**: RLS policy checks `auth.users.raw_user_meta_data->>'role'` which requires querying auth.users table. Agents can't access this table, causing policy check to fail.

**SQL Fix Required** - Run in Supabase SQL Editor:

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "agents_own_special_mtn_pricing" ON agent_special_mtn_mashup_pricing;

-- Agent policy - only their own data
CREATE POLICY "agents_own_special_mtn_pricing" ON agent_special_mtn_mashup_pricing
  FOR ALL
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

-- Admin policy - manage all agent pricing
CREATE POLICY "admins_can_manage_all_agent_pricing" ON agent_special_mtn_mashup_pricing
  FOR ALL
  USING (
    EXISTS(
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );
```

**Why This Works**: 
- First policy uses simple comparison (no table query needed)
- Second policy only runs for admin checks
- Agents get immediate access, admins get override access

**Status**: ⏳ Awaiting SQL execution

---

## Issue 3: Minimum Price Enforcement ✅ IMPLEMENTED

**Implementation**: Added validation to prevent agents from setting prices below admin base prices.

**Features Added**:
1. **Pre-save validation**: Checks all 4 tiers before allowing save
2. **User-friendly errors**: Shows minimum price for each tier that's too low
3. **Visual feedback**: Input borders turn red when price is below minimum
4. **Inline hints**: Displays minimum price requirement below input

**How It Works**:
- Agent sets a price lower than admin base → Input border turns red
- Agent tries to save → Toast notification shows specific minimum price
- Save is blocked until all prices meet minimum requirements
- Clear messaging helps agents understand pricing constraints

**File Modified**: `/src/components/AgentSpecialMTNPricingManager.tsx`

**Status**: ✅ Code implemented and tested, build verified

---

## Summary of All Fixes

| Issue | Status | Action |
|-------|--------|--------|
| Admin UUID validation error | ✅ Fixed in code | Test Admin Dashboard save |
| Agent permission denied (RLS) | ⏳ Requires SQL | Run SQL fix in Supabase |
| Agent minimum price enforcement | ✅ Implemented | Agents now see red border + error when price too low |

---

## What Changed

### Admin Component - SpecialMTNMashupPricingManager.tsx
- ✅ Fetches real UUID from afa_settings before saving
- ✅ No more hardcoded '1' string ID

### Agent Component - AgentSpecialMTNPricingManager.tsx
- ✅ Added price validation before save
- ✅ Checks all 4 tiers against admin base prices
- ✅ Red border on input if price too low
- ✅ Helpful error message shows minimum
- ✅ Toast notification prevents invalid saves

---

## Your Action Items

### Step 1: Run SQL Fix (CRITICAL)
Copy and run in Supabase > SQL Editor:

```sql
DROP POLICY IF EXISTS "agents_own_special_mtn_pricing" ON agent_special_mtn_mashup_pricing;

CREATE POLICY "agents_own_special_mtn_pricing" ON agent_special_mtn_mashup_pricing
  FOR ALL
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "admins_can_manage_all_agent_pricing" ON agent_special_mtn_mashup_pricing
  FOR ALL
  USING (
    EXISTS(
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );
```

### Step 2: Test
1. **Admin Dashboard**: Go to Prices tab → Special MTN Mashup → Change a price → Click Save
   - Should work now (no UUID error)

2. **Agent Dashboard**: Go to Store Prices → Special Packages → Set prices → Click Save
   - Should work now (no permission error)
   - Try setting a price below admin base (e.g., 5 instead of 6)
   - Should show red border + error preventing save

### Step 3: Verify
- Admin pricing saves successfully
- Agent pricing saves successfully  
- Agent cannot save prices below admin minimum
- Visual feedback shows when prices are too low

---

## Build Status
✅ All code changes compiled successfully
✅ Ready for testing once SQL fix is applied

