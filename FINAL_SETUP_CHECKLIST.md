# Final Setup Checklist for DataPlug System

## Critical Setup Steps (Must Complete)

### 1. Supabase SQL Fixes
Run EACH of these SQL files in your Supabase SQL Editor in order:

**Step 1a: Fix RLS Policies for Complaints**
- File: `FIX_RLS_FINAL.sql`
- What it does: Allows customers to submit and admins to manage complaints
- Where: Supabase Dashboard → SQL Editor → New Query → Paste → Run

**Step 1b: Fix Complaint Status Persistence** 
- File: `FIX_COMPLAINT_STATUS_PERSISTENCE.sql`
- What it does: Allows status updates to be saved (no more reverting to pending)
- Where: Supabase Dashboard → SQL Editor → New Query → Paste → Run

**Step 1c: Fix Base Pricing Structure (if not done)**
- File: `SUPABASE_SETUP.sql`
- What it does: Creates complaints table and pricing tables
- Only run if tables don't exist yet

### 2. Payment/Spin Wheel Setup

**Step 2a: Add Paystack Secret Key**
- Go to: Supabase Dashboard → Project Settings → Edge Functions → Environment Variables
- Add variable: `PAYSTACK_SECRET_KEY`
- Value: Your Paystack secret key from https://dashboard.paystack.com

**Step 2b: Deploy Payment Function**
Run in terminal:
```bash
supabase functions deploy initialize-payment
```

**Step 2c: Test Payment**
- Navigate to Spin Wheel on your site
- Enter valid phone (0245123456)
- Click "Pay to Spin"
- Should redirect to Paystack payment page

### 3. Verification Steps

**Check 1: Complaints Working**
- [ ] Go to Packages page
- [ ] Wait 300 minutes (5 hours) or manually check an old order
- [ ] Click "Report"
- [ ] Fill details and submit
- [ ] Should see "✓ Report has been sent to network providers"
- [ ] Admin should see complaint in Admin Dashboard → Complaints

**Check 2: Complaint Status Updates Persist**
- [ ] Admin clicks "In Progress" on a complaint
- [ ] Refresh page
- [ ] Status should still be "In Progress" (not revert to pending)

**Check 3: Bulk Select Works**
- [ ] Admin Dashboard → Complaints tab
- [ ] Check "Select All" checkbox for pending complaints
- [ ] Click "Resolve Selected (N)"
- [ ] Complaints should update to "Resolved"

**Check 4: Payment Works**
- [ ] Spin Wheel page → Enter phone number
- [ ] Click "Pay to Spin"
- [ ] Should redirect to Paystack page
- [ ] If error, check PAYMENT_DEBUGGING_GUIDE.md

### 4. Agent Dashboard Features

**Verify Agent Complaints:**
- [ ] Login as agent
- [ ] Agent Dashboard → Complaints tab
- [ ] Should only see complaints from their own store
- [ ] Can view, manage, and forward to admin

**Verify Subagent Pricing:**
- [ ] Agent Dashboard → Subagent Prices tab
- [ ] Should show admin's base prices (NOT agent's store prices)
- [ ] Can set subagent base prices
- [ ] Cannot set price below admin's base price
- [ ] Profit column shows agent's profit margin

### 5. Subagent Dashboard

**Verify Store Prices:**
- [ ] Subagent Dashboard → Store Prices tab
- [ ] Should show agent's base prices for subagents
- [ ] Can set selling prices above that base
- [ ] Profit shows subagent's profit
- [ ] Delivery threshold: 300 minutes (5 hours)

### 6. Database Queries to Test

Run these in Supabase SQL Editor to verify setup:

**Test 1: Check complaints can be inserted**
```sql
SELECT COUNT(*) FROM public.complaints;
```
Should return a number (0 or more).

**Test 2: Check RLS policies exist**
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'complaints';
```
Should return multiple policies including "Anyone can submit complaints".

**Test 3: Check pricing tables**
```sql
SELECT * FROM public.data_packages LIMIT 1;
SELECT * FROM public.agent_package_prices LIMIT 1;
SELECT * FROM public.subagent_package_prices LIMIT 1;
```
Each should return data or be empty (if no agents/subagents yet).

## Common Issues & Fixes

### Issue: "Complaint submission fails with RLS error"
**Fix:** Run `FIX_RLS_FINAL.sql`

### Issue: "Status changes revert to pending on refresh"
**Fix:** Run `FIX_COMPLAINT_STATUS_PERSISTENCE.sql`

### Issue: "Payment shows 400 Bad Request"
**Fix:** 
1. Check PAYSTACK_SECRET_KEY is set
2. Deploy payment function: `supabase functions deploy initialize-payment`
3. Check phone number is valid (10 digits)
4. See PAYMENT_DEBUGGING_GUIDE.md

### Issue: "Subagent sees agent's store prices instead of base prices"
**Fix:** Code already fixed. Ensure you cleared browser cache and refreshed.

## Deployment Checklist

After all setup:
- [ ] All SQL files run successfully
- [ ] PAYSTACK_SECRET_KEY added to Supabase
- [ ] Payment function deployed
- [ ] Browser cache cleared
- [ ] Test complaints submission
- [ ] Test complaint status updates
- [ ] Test bulk select
- [ ] Test payment flow
- [ ] Verify pricing structure
- [ ] Verify agent can only see own complaints

## Support

If issues persist:
1. Check browser console (F12) for error messages
2. Check Supabase function logs for edge function errors
3. Refer to PAYMENT_DEBUGGING_GUIDE.md for payment issues
4. Verify all SQL files were run successfully
