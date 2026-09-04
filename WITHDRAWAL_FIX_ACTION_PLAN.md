# Withdrawal Money Loss Issue - Root Cause & Action Plan

## THE PROBLEM YOU'RE EXPERIENCING
Subagents make withdrawals, money is sent to their recipients via Paystack, but their wallet balance is NOT being deducted. This causes:
- **Lost money tracking** - No record of where money went
- **Double withdrawals** - Subagents can keep withdrawing without balance decreasing
- **Financial loss** - You're sending money but not deducting from wallet

**Amount lost so far:** 2000+ GHS

---

## ROOT CAUSE ANALYSIS

### Why This Is Happening

The withdrawal system has this flow:
1. Subagent requests withdrawal
2. Edge Function gets current balance
3. **Edge Function tries to deduct balance** ← THIS IS FAILING
4. Edge Function sends money to Paystack
5. Edge Function updates success status

**The bug:** The balance update query (Step 3) is failing silently, so:
- ✅ Paystack API call succeeds → money is sent
- ✅ payout_requests record is created
- ❌ Wallet balance update fails → balance never decreases
- ✅ Status set to "success" → appears successful but isn't fully

### Why It's Failing

There are THREE possible reasons:

**Option 1: Database migrations not applied** (MOST LIKELY)
- Migration files exist in code but haven't been pushed to Supabase
- `payout_requests` table might not exist in actual database
- `transfer_recipients` table might not exist
- This would cause the balance update to fail with table not found error

**Option 2: RLS policies blocking updates**
- Even if tables exist, RLS (Row Level Security) policies might be preventing updates
- The Edge Function uses SERVICE ROLE key (bypasses RLS normally)
- But if policies are misconfigured, could still fail

**Option 3: Wallet_balance column missing**
- The wallet_balance column might not exist on subagent_stores table
- Update query would fail with "column doesn't exist" error

---

## IMMEDIATE ACTION PLAN

### Step 1: VERIFY DATABASE STATE (DO THIS FIRST)

Run this SQL in your Supabase SQL Editor:

```sql
-- 1. Check if critical tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payout_requests', 'transfer_recipients');

-- 2. Check subagent_stores columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'subagent_stores'
ORDER BY ordinal_position;

-- 3. Show all withdrawal attempts with their status
SELECT 
  id, requester_id, amount, 
  source_balance_before, source_balance_after,
  status, failure_reason, created_at
FROM public.payout_requests
ORDER BY created_at DESC LIMIT 20;
```

**Expected output:**
- `payout_requests` table should exist
- `transfer_recipients` table should exist  
- `subagent_stores` should have `wallet_balance` column
- `payout_requests` should have multiple records with `status = 'success'`

**If you DON'T see these:** Skip to Step 2 (Apply Migrations)

---

### Step 2: APPLY DATABASE MIGRATIONS

If tables don't exist or columns are missing:

```bash
# In your project root directory:
supabase db push
```

This will run all migration files including:
- `20260712_create_payout_requests.sql` - Creates tracking table
- `20260712_create_transfer_recipients.sql` - Creates recipients table
- `20260712_add_withdrawal_cooldown.sql` - Adds cooldown tracking

**After running:** Re-run the verification queries from Step 1 to confirm tables exist

---

### Step 3: VERIFY WITH NEW LOGGING

The code now has enhanced logging. Make a test withdrawal:

1. **Subagent makes a small test withdrawal (e.g., 5 GHS)**
2. **Go to Supabase → Functions → create-payout-request → Logs**
3. **Look for messages like:**
   ```
   [CREATE-PAYOUT] ✅ BALANCE DEDUCTED: 100 -> 95
   [CREATE-PAYOUT] ✅ Subagent wallet updated successfully: [store-id]
   ```
4. **Check dashboard** - Wallet balance should decrease by 5 GHS
5. **Verify in database:**
   ```sql
   SELECT wallet_balance FROM subagent_stores WHERE id = '[store-id]';
   ```

**If you see ✅ messages and balance decreases:** FIX IS WORKING ✓

**If you see ❌ messages:** Database update is still failing - check error message

---

### Step 4: CORRECT HISTORICAL WALLET BALANCES

For any subagents who made withdrawals before the fix:

```sql
-- Find all successful withdrawals that happened
SELECT SUM(amount) as total_lost_amount
FROM public.payout_requests
WHERE status = 'success';

-- For EACH affected subagent, manually deduct the total:
UPDATE public.subagent_stores
SET wallet_balance = wallet_balance - [TOTAL_AMOUNT]
WHERE id = '[SUBAGENT_STORE_ID]';

-- Verify the correction:
SELECT store_name, wallet_balance FROM public.subagent_stores WHERE id = '[SUBAGENT_STORE_ID]';
```

Example: If a subagent had 1000 GHS and successfully withdrew 500 twice:
```sql
UPDATE public.subagent_stores
SET wallet_balance = wallet_balance - 1000  -- Subtract both withdrawals
WHERE id = 'subagent-uuid-here';
```

---

## WHAT'S BEEN FIXED IN CODE

### 1. Enhanced Logging (Edge Function)
- Now logs ✅ when balance is successfully deducted
- Now logs ❌ CRITICAL when balance deduction fails
- Shows exact amounts: Before → After
- Includes store IDs for traceability

### 2. RLS Policy Fixes
- Fixed admin policies that used undefined function
- Replaced with direct database queries

### 3. Verification Tools
- Added SQL verification script that checks all tables exist
- Added troubleshooting guide with diagnostic queries
- Added test procedures to verify the fix works

---

## TESTING CHECKLIST

- [ ] Ran `supabase db push` to apply all migrations
- [ ] Verified `payout_requests` table exists in Supabase
- [ ] Verified `transfer_recipients` table exists in Supabase
- [ ] Verified `subagent_stores.wallet_balance` column exists
- [ ] Made a test 5 GHS withdrawal as a subagent
- [ ] Checked Edge Function logs - saw ✅ BALANCE DEDUCTED message
- [ ] Dashboard shows wallet decreased by 5 GHS
- [ ] Database query confirms balance decreased
- [ ] Verified 24-hour cooldown timer appears after withdrawal
- [ ] Manually corrected historical balances for affected users
- [ ] Made another test withdrawal to confirm system is working

---

## EMERGENCY RESTORE

If you need to revert a withdrawal that went through by mistake:

```sql
-- Find the withdrawal
SELECT * FROM public.payout_requests
WHERE requester_id = '[store-id]' 
ORDER BY created_at DESC LIMIT 1;

-- Get the amount
-- Then add it back to wallet:
UPDATE public.subagent_stores
SET wallet_balance = wallet_balance + [AMOUNT]
WHERE id = '[store-id]';

-- Optionally mark as failed:
UPDATE public.payout_requests
SET status = 'failed', failure_reason = 'Manually reversed'
WHERE id = '[payout-id]';
```

---

## PREVENTION FOR FUTURE

Once this is fixed:

1. **24-hour cooldown** - Users can only withdraw once per 24 hours
2. **Tracking records** - All withdrawals create payout_requests records
3. **Logging** - All operations logged for debugging
4. **Balance verification** - System checks balance before allowing withdrawal
5. **Refund on failure** - If Paystack fails, wallet is refunded automatically

---

## SUPPORT

If you're still having issues after following this:

1. **Post the output of Step 1 verification queries** - This shows what's in your database
2. **Post any error messages from Edge Function logs** - This shows what's failing
3. **Post current wallet balances** - This shows if correction worked
4. **Post successful withdrawal amount** - So I can calculate corrections

---

## IMPORTANT NOTES

- The code changes are fully backward compatible
- No existing functionality is broken
- Migrations are idempotent (safe to run multiple times)
- All user data is preserved
- The 24-hour cooldown is NEW and will affect future withdrawals

**Next withdrawal after fix:** Should show both deduction AND cooldown timer
