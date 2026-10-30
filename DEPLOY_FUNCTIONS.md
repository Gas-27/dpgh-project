# Deploying Supabase Functions

## The Problem
You're getting a **404 error** when trying to top up the normal wallet because the `initialize-wallet-topup` function hasn't been deployed to your Supabase project yet.

## Solution: Deploy Functions via Supabase Dashboard

### Step 1: Deploy initialize-wallet-topup Function

1. Go to your **Supabase Dashboard**
2. Click on your project
3. Go to **Edge Functions** (left sidebar)
4. Click **Create a new function**
5. Name it: `initialize-wallet-topup`
6. Copy the entire code from: `/supabase/functions/initialize-wallet-topup/index.ts` in your project
7. Paste it into the Supabase editor
8. Click **Deploy**

### Step 2: Deploy paystack-webhook-fixed Function

1. In **Edge Functions**, click **Create a new function**
2. Name it: `paystack-webhook-fixed`
3. Copy the entire code from: `/supabase/functions/paystack-webhook-fixed/index.ts`
4. Paste it into the Supabase editor
5. Click **Deploy**

### Step 3: Verify Functions Are Deployed

1. Go to **Edge Functions** page
2. You should see both functions listed:
   - `initialize-wallet-topup`
   - `paystack-webhook-fixed`
3. Both should show status as **"Active"** (green)

### Step 4: Test Normal Wallet Topup

1. Go back to your app
2. Go to **My Dashboard** → **Top Up**
3. Click **Top Up Wallet** (for Normal Wallet)
4. Try topping up with GHC 1.00
5. Should now work without 404 error

## Alternative: Deploy via CLI (if you have Supabase CLI installed)

```bash
cd /vercel/share/v0-project
supabase functions deploy initialize-wallet-topup
supabase functions deploy paystack-webhook-fixed
```

## If You Still Get "Customer not found" Error

This means the function is deployed but can't find the customer. Check:

1. Make sure you're logged in as a user (not anonymous)
2. Check that your user ID is in the `customers` table in Supabase
3. Run this query in Supabase SQL Editor:

```sql
SELECT id, email FROM customers LIMIT 10;
```

You should see your account in the results.

## Function Endpoints

After deployment, the functions will be available at:
- `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/initialize-wallet-topup`
- `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/paystack-webhook-fixed`

Your app will automatically call these when you click "Top Up".
