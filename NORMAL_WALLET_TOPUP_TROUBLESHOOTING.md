# Normal Wallet Topup Troubleshooting Guide

## Issue: "Customer not found" Error

### Root Cause Analysis

The error "Customer not found" occurs when the `initialize-wallet-topup` function cannot find the customer record in the database using the provided `identity_id`.

**Possible causes:**
1. Customer record doesn't exist in the `customers` table
2. RLS policy preventing access to the `customers` table
3. Wrong customer ID being passed
4. Function using wrong table name or column

---

## Debug Steps

### Step 1: Check if Customer Record Exists

Run this SQL in Supabase SQL Editor to verify your customer account exists:

```sql
-- Replace YOUR_USER_ID with your actual user ID from Auth
SELECT id, email, wallet_balance FROM customers 
WHERE id = 'YOUR_USER_ID';
```

**If it returns 0 rows:**
- You don't have a customer record
- Solution: Create one manually or register properly

**If it returns data:**
- Record exists, problem is elsewhere

---

### Step 2: Check RLS Policies on Customers Table

Run this SQL:

```sql
-- Check if RLS is enabled
SELECT tablename FROM pg_tables 
WHERE tablename = 'customers';

-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'customers';

-- List all RLS policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'customers' 
ORDER BY tablename, policyname;
```

**What to look for:**
- If `rowsecurity = true` but NO policies exist = Database is blocked
- Solution: Disable RLS or add proper policies

---

### Step 3: Disable RLS on Customers Table (Temporary Fix)

If RLS is causing issues, run this in Supabase SQL Editor:

```sql
-- Disable RLS on customers table temporarily for testing
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Grant permissions to service role
GRANT SELECT, INSERT, UPDATE ON customers TO service_role;

-- After testing, you can re-enable with:
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
```

---

### Step 4: Check Function Logs

1. Go to **Supabase Dashboard** → **Functions**
2. Click **initialize-wallet-topup**
3. Go to **Logs** tab
4. Look for entries like:
   - `[INITIALIZE-WALLET-TOPUP] Looking for customer with ID: ...`
   - `[INITIALIZE-WALLET-TOPUP] Customer query result`
   - `[INITIALIZE-WALLET-TOPUP] Customer not found. Error details:`

**This tells you:**
- What ID is being searched for
- What error the database returned (RLS? Not found? Query error?)

---

### Step 5: Verify Function is Using Correct Table

The function should query:
```
FROM "customers" 
WHERE id = identity_id
```

It should NOT query:
```
FROM "api_users" 
WHERE api_key = ...  (for normal wallet)
```

---

## Complete Fix Steps

### If You Need to Create a Customer Record

Run this in Supabase SQL Editor (replace with your actual values):

```sql
-- Get your user ID from Auth
-- Replace 'your-user-id' with your actual Auth UUID
-- Replace 'your@email.com' with your actual email

INSERT INTO customers (id, email, wallet_balance, created_at)
VALUES (
  'your-user-id',
  'your@email.com',
  0,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Verify it was created
SELECT * FROM customers WHERE id = 'your-user-id';
```

---

### If RLS is the Problem

```sql
-- Check what policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'customers';

-- Temporarily disable RLS for testing
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Try the topup again
-- If it works, add proper RLS policies:

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role
CREATE POLICY "Service role can access all" ON customers
  FOR ALL USING (true)
  WITH CHECK (true)
  AS PERMISSIVE
  FOR ROLE service_role;

-- Create policy for authenticated users
CREATE POLICY "Users can view own customer record" ON customers
  FOR SELECT
  USING (auth.uid()::text = id::text);
```

---

## Expected Behavior After Fix

1. User clicks "Top Up Wallet" (Normal)
2. Function finds customer record
3. Function calls Paystack
4. User redirected to Paystack payment page
5. After payment, webhook updates `customers.wallet_balance`
6. Dashboard shows updated balance

---

## Debugging Checklist

- [ ] Customer record exists in database
- [ ] RLS is disabled or has proper policies
- [ ] Function logs show customer ID being searched
- [ ] No "row level security" errors in function logs
- [ ] Paystack key is set in environment variables
- [ ] user_wallet_topups table exists

---

## Commands to Run

**Quick fix (disable RLS temporarily):**
```sql
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
```

**Check your customer:**
```sql
SELECT * FROM customers LIMIT 5;
```

**See function logs:**
- Dashboard → Functions → initialize-wallet-topup → Logs

---

## If Still Not Working

After trying these steps, check:
1. Supabase function logs (what exact error is returned?)
2. Browser console (what's the full error message?)
3. Network tab (is the request even reaching the function?)
4. Environment variables (is PAYSTACK_SECRET_KEY set?)
