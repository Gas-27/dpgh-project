# Withdrawal System Troubleshooting Guide

## CRITICAL ISSUE: Wallet Balance Not Being Deducted

If subagents/agents are losing money but wallet balance not decreasing, follow this guide.

---

## Step 1: Verify Database Tables Exist

### Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Check if payout_requests table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'payout_requests';

-- Check if transfer_recipients table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'transfer_recipients';

-- Check subagent_stores columns
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'subagent_stores'
ORDER BY ordinal_position;
```

**Expected result:** All three tables should exist, and subagent_stores should have columns:
- `wallet_balance`
- `last_withdrawal_at`

**If tables don't exist:** Run migrations:
```bash
supabase db push
```

---

## Step 2: Check Payout Request Records

### Run this query to see all withdrawal attempts:

```sql
SELECT 
  id,
  requester_type,
  requester_id,
  amount,
  source_balance_before,
  source_balance_after,
  status,
  failure_reason,
  created_at
FROM public.payout_requests
ORDER BY created_at DESC
LIMIT 20;
```

**What to look for:**
- **status = 'success'**: Money should have been deducted
- **status = 'failed'**: Money was NOT sent to Paystack (should be refunded)
- **source_balance_after**: Should be `source_balance_before - amount`

### If payout_requests table is empty:
The Edge Function is NOT saving records. Check:
1. Table permissions (RLS policies)
2. Service role key configuration

---

## Step 3: Check Current Wallet Balances

### Query to check if balance was deducted:

```sql
-- Check specific subagent balance
SELECT id, store_name, wallet_balance, last_withdrawal_at, created_at
FROM public.subagent_stores
WHERE id = 'SUBAGENT_STORE_ID_HERE';

-- Check all subagent balances
SELECT id, store_name, wallet_balance, last_withdrawal_at
FROM public.subagent_stores
ORDER BY wallet_balance DESC;
```

**If wallet_balance didn't decrease:**
- Withdrawal succeeded in Paystack but balance update failed
- Manual correction needed (see Step 5)

---

## Step 4: Check Supabase Logs

### View Edge Function logs:

1. Go to Supabase Dashboard → Functions → `create-payout-request`
2. Look for logs from the time of withdrawal
3. **Look for critical messages:**
   - `✅ BALANCE DEDUCTED:` - Money was deducted successfully
   - `❌ CRITICAL: Failed to deduct` - Database update failed
   - `Insufficient balance` - Balance check failed
   - `Withdrawal cooldown active` - 24-hour cooldown preventing withdrawal

### Example log output:
```
[CREATE-PAYOUT] Request: subagent abc123, amount: 100
[CREATE-PAYOUT] Updating subagent wallet - Before: 500, After: 400
[CREATE-PAYOUT] ✅ BALANCE DEDUCTED: 500 -> 400
```

---

## Step 5: Manual Wallet Correction

### If balance was NOT deducted but money was sent to Paystack:

```sql
-- Verify money was actually sent to Paystack (check status = 'success')
SELECT amount FROM public.payout_requests 
WHERE requester_id = 'STORE_ID' AND status = 'success';

-- Calculate how much to deduct
-- Sum all successful withdrawals and deduct from current balance

-- CORRECT THE BALANCE (EXAMPLE):
UPDATE public.subagent_stores
SET wallet_balance = wallet_balance - 2000  -- Deduct the 2000 cedis
WHERE id = 'STORE_ID';

-- Verify the update
SELECT wallet_balance FROM public.subagent_stores WHERE id = 'STORE_ID';
```

---

## Step 6: Test the Fixed System

### Make a small test withdrawal (e.g., 5 GHS):

1. Subagent makes withdrawal for 5 GHS
2. Check logs - should see `✅ BALANCE DEDUCTED`
3. Refresh dashboard - balance should decrease by 5 GHS
4. Check `payout_requests` - should have status = 'success'
5. Check `last_withdrawal_at` - should be set (starts 24-hour cooldown)

---

## Common Issues & Solutions

### Issue: "Failed to deduct wallet" error
**Cause:** RLS policy blocking update  
**Solution:** Check RLS policies on subagent_stores and agent_stores tables

### Issue: payout_requests records are empty
**Cause:** Migrations not applied or table doesn't exist  
**Solution:** Run `supabase db push` to apply all migrations

### Issue: Paystack says "success" but wallet not deducted
**Cause:** Database update failed silently before my logging was added  
**Solution:** Manual correction + restart Edge Function with new code

### Issue: "Insufficient balance" error
**Cause:** Balance check is too strict or balance is not being read correctly  
**Solution:** Check that subagent_stores has wallet_balance column

---

## How the System SHOULD Work

1. **User requests withdrawal** (100 GHS)
2. **Edge Function receives request**
3. **Get current balance** from subagent_stores (e.g., 500 GHS)
4. **Check if balance >= amount** (500 >= 100 ✓)
5. **Create payout_requests record** with status = 'processing'
6. **DEDUCT from wallet** (500 - 100 = 400) ← **THIS STEP WAS FAILING**
7. **Send to Paystack API**
8. **On success:** Update payout_requests to status = 'success', set last_withdrawal_at
9. **On failure:** Refund wallet (400 → 500)

The issue was that Step 6 was silently failing, so money went to Paystack but wallet never decreased.

---

## Verification Checklist

- [ ] `payout_requests` table exists
- [ ] `transfer_recipients` table exists
- [ ] `subagent_stores.wallet_balance` column exists
- [ ] `subagent_stores.last_withdrawal_at` column exists
- [ ] Edge Function logs show `✅ BALANCE DEDUCTED` messages
- [ ] Test withdrawal shows balance decreasing
- [ ] Manual corrections applied for past lost funds
- [ ] Cooldown timer shows for 24 hours after withdrawal
- [ ] Dashboard refreshes show updated balance
