# Normal Wallet Topup - Quick Diagnostic & Fix

## The Real Issue

Your function IS deployed, but "Customer not found" error means:
1. **Your customer record doesn't exist in the `customers` table**, OR
2. **The customer ID being passed doesn't match the database**, OR
3. **RLS policy is blocking the query**

## Quick Diagnostic (Run These in Order)

### Step 1: Check If Customer Exists

Go to **Supabase Dashboard** → **SQL Editor** → **New Query**

```sql
-- Check if your customer exists
SELECT id, email, wallet_balance, created_at 
FROM customers 
WHERE id = 'YOUR_USER_ID_HERE';
```

Replace `YOUR_USER_ID_HERE` with your actual user ID. 

**If this returns 0 rows** → Customer doesn't exist (most likely issue)

### Step 2: Get Your Actual User ID

Run this to find your user ID:

```sql
SELECT id, email FROM auth.users LIMIT 5;
```

Copy your user ID from the `auth.users` table.

### Step 3: Create Customer Record (If Missing)

If Step 1 returned no rows, create the customer:

```sql
INSERT INTO customers (id, email, wallet_balance, created_at)
VALUES (
  'PASTE_YOUR_USER_ID_HERE',
  'PASTE_YOUR_EMAIL_HERE',
  0,
  NOW()
);
```

Replace `PASTE_YOUR_USER_ID_HERE` with the ID from Step 2, and `PASTE_YOUR_EMAIL_HERE` with your email.

### Step 4: Disable RLS (For Testing)

If customer exists but still getting error, disable RLS temporarily:

```sql
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
```

Then try topup again.

### Step 5: Check Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **initialize-wallet-topup**
3. Click **Logs** tab
4. Try the topup again
5. Look for log entries showing what's happening

---

## Most Likely Fix

**In 90% of cases, you just need to run:**

```sql
INSERT INTO customers (id, email, wallet_balance, created_at)
SELECT id, email, 0, NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM customers)
LIMIT 1;
```

This creates a customer record for your authenticated user if it doesn't exist.

---

## After You Fix

1. Run the SQL commands above
2. Try the wallet topup again
3. It should now work!

Let me know which SQL query shows what, and I'll give you the exact fix.
