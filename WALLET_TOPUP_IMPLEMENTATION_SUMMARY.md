# Normal Wallet Topup - Complete Implementation Summary

## The Problem You Reported

1. **Top Up button always goes to API wallet** - Even when user clicks Top Up on Normal Wallet
2. **3 orders made through Paystack not showing** - Orders showing 0 even after purchases
3. **Need code for Normal Wallet topup** - Similar to API wallet topup but for regular customers

## What I've Created For You

I've created **3 comprehensive documentation files** with everything you need:

### 📄 File 1: WALLET_TOPUP_CODE_SNIPPETS.md
**Best for:** Quick implementation
- Copy-paste code snippets ready to use
- Exact line numbers for each change
- Visual diff format showing before/after
- All 4 locations where code goes (2 functions + database + frontend)

### 📄 File 2: NORMAL_WALLET_TOPUP_IMPLEMENTATION.md
**Best for:** Understanding the full process
- Complete step-by-step implementation guide
- 6 implementation steps with detailed explanations
- Database migration SQL ready to run
- Troubleshooting section for common issues

### 📄 File 3: WALLET_TOPUP_FLOW_DIAGRAM.md
**Best for:** Visual learners and debugging
- ASCII diagram of entire user flow from button click to wallet update
- Database table schemas showing all 3 tables involved
- Real request/response examples with actual data
- Testing checklist
- SQL debugging queries

---

## Quick Start (5 Steps to Working Normal Wallet)

### Step 1: Create Database Table
**Location:** Supabase Dashboard → SQL Editor → New Query

**Copy from:** `WALLET_TOPUP_CODE_SNIPPETS.md` → Section "3️⃣ DATABASE"

**Action:** Paste SQL and click RUN
- Creates `user_wallet_topups` table
- Adds indexes for performance
- Sets up RLS security policies

**Time:** 30 seconds

### Step 2: Update Initialize Wallet Function
**File:** `supabase/functions/initialize-wallet-topup/index.ts`

**Changes needed:** 3 small edits
1. Line 29: Add `wallet_type` to parameter destructuring
2. Line 48-54: Add wallet_type validation block
3. Line 32-40: Update metadata section to use wallet_type

**Reference:** `WALLET_TOPUP_CODE_SNIPPETS.md` → Section "1️⃣ SUPABASE FUNCTION"

**Time:** 5 minutes

### Step 3: Update Paystack Webhook Function
**File:** `supabase/functions/paystack-webhook-fixed/index.ts`

**Changes needed:** Add 1 new handler section
- Paste entire handler after line 365 (after api_wallet_topup handler)
- This handler processes "user_wallet_topup" payment type
- Updates customers table wallet_balance (not api_users table)

**Reference:** `WALLET_TOPUP_CODE_SNIPPETS.md` → Section "2️⃣ SUPABASE WEBHOOK"

**Time:** 5 minutes

### Step 4: Update Frontend Component
**File:** `src/components/WalletTopupDialog.tsx`

**Changes needed:** 1 line addition
- Find where initialize-wallet-topup function is called
- Add `wallet_type: props.walletType` to the request body

**Reference:** `WALLET_TOPUP_CODE_SNIPPETS.md` → Section "4️⃣ FRONTEND"

**Time:** 2 minutes

### Step 5: Deploy Changes
**Run commands:**
```bash
cd /vercel/share/v0-project

# Deploy updated webhook function
supabase functions deploy paystack-webhook-fixed

# Deploy updated initialize function
supabase functions deploy initialize-wallet-topup

# Rebuild Next.js app
pnpm run build

# Start dev server to test
pnpm run dev
```

**Time:** 3-5 minutes

---

## How Normal Wallet Topup Works

```
┌────────────────────────────────────────────┐
│  User clicks "Top Up" on Normal Wallet     │
│  (Not API Wallet button)                   │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  WalletTopupDialog opens                   │
│  - Component knows: walletType="normal"   │
│  - User enters: amount (e.g., GHC 50.00)  │
│  - User clicks: Proceed to Paystack       │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  Frontend calls initialize-wallet-topup    │
│  Pass:                                     │
│  - identity_id (user UUID)                 │
│  - amount (50.00)                          │
│  - wallet_type: "normal" ← KEY PARAM      │
│  - callback_url (dashboard)                │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  Supabase Function: initialize-wallet-topup│
│  1. Validate wallet_type = "normal"       │
│  2. Calculate fee (1.98%)                  │
│  3. Set metadata.type = "user_wallet_topup"│
│  4. Call Paystack API                      │
│  5. Create pending record in table         │
│  6. Return Paystack auth URL               │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  User sees Paystack payment page           │
│  - Enters card details                     │
│  - Completes payment                       │
│  - Paystack sends webhook                  │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  Paystack Webhook: paystack-webhook-fixed  │
│  1. Verify signature                       │
│  2. Check: metadata.type = "user_wallet..."│
│  3. Get customer from customers table      │
│  4. Read: wallet_balance (OLD: 0.00)      │
│  5. Calculate: NEW = 0.00 + 50.00 = 50.00│
│  6. UPDATE customers.wallet_balance = 50  │
│  7. CREATE record in user_wallet_topups   │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  User redirected to dashboard              │
│  - Wallet Balance: GHC 50.00 ✅           │
│  - Can now "Buy Data" with wallet          │
└────────────────────────────────────────────┘
```

---

## The 3 Key Code Changes Explained

### Change 1: Initialize Function - Accept wallet_type
```typescript
// BEFORE:
const { api_key, identity_id, amount, callback_url } = await req.json();

// AFTER:
const { api_key, identity_id, amount, callback_url, wallet_type } = await req.json();

// Then use it:
let paymentType = "api_wallet_topup";
if (wallet_type === "normal") {
  paymentType = "user_wallet_topup";  // ← Different type for webhook to recognize
}

metadata.type = paymentType;
```

**Why:** The webhook uses `metadata.type` to know how to process the payment. If type="user_wallet_topup", it goes to customers table. If type="api_wallet_topup", it goes to api_users table.

### Change 2: Webhook - Handle user_wallet_topup
```typescript
if (paymentType === "user_wallet_topup") {
  // This is called when payment from a regular user completes
  
  // Get customer from customers table (different from api_users!)
  const customer = await supabaseClient
    .from("customers")
    .select("wallet_balance")
    .eq("id", customerId)
    .single();
  
  // Update their wallet_balance (not wallet like API users)
  const newBalance = customer.wallet_balance + baseAmount;
  await supabaseClient
    .from("customers")
    .update({ wallet_balance: newBalance })
    .eq("id", customerId);
  
  // Record the transaction
  await supabaseClient
    .from("user_wallet_topups")
    .upsert({ customer_id, amount, status: "completed" });
}
```

**Why:** Regular customers have wallet_balance in the customers table, not wallet in api_users. This handler specifically handles their topups.

### Change 3: Frontend - Pass wallet_type
```typescript
// When Top Up button is clicked, pass the wallet type:
const response = await supabase.functions.invoke("initialize-wallet-topup", {
  body: {
    identity_id: user.id,
    amount: 50.00,
    wallet_type: "normal",  // ← This tells initialize function which type
    callback_url: "https://dataplug.store/user-dashboard"
  }
});
```

**Why:** The initialize function needs to know whether this is a normal customer topup or an API user topup so it can set the correct metadata.type.

---

## Database Tables Involved

### Table 1: customers (Regular Users)
```sql
id              UUID          ← User ID
email           VARCHAR       ← User email
wallet_balance  DECIMAL(10,2) ← UPDATED BY WEBHOOK ✅
api_wallet      DECIMAL(10,2) ← Separate from normal wallet
phone_number    VARCHAR
created_at      TIMESTAMP
```

### Table 2: api_users (API Users/Resellers) 
```sql
id              UUID
api_key         VARCHAR
identity_id     UUID          ← Link to customers or agents
wallet          DECIMAL(10,2) ← Updated for API topups
is_user         BOOLEAN
is_agent        BOOLEAN
```

### Table 3: user_wallet_topups (NEW - Transaction Records)
```sql
id                  UUID          ← Record ID
customer_id         UUID          ← Links to customers.id
amount              DECIMAL(10,2) ← Amount topped up
fee_amount          DECIMAL(10,2) ← Paystack fee
total_amount        DECIMAL(10,2) ← Total paid
paystack_reference  VARCHAR       ← Links to Paystack
status              VARCHAR       ← "pending" or "completed"
created_at          TIMESTAMP
completed_at        TIMESTAMP
metadata            JSONB
```

---

## Exact File Locations & Line Numbers

### initialize-wallet-topup/index.ts

**Line 29** - Parameter destructuring:
```diff
- const { api_key, identity_id, amount, callback_url } = await req.json();
+ const { api_key, identity_id, amount, callback_url, wallet_type } = await req.json();
```

**Lines 48-54** - Add validation:
```typescript
    if (!wallet_type) {
      return new Response(
        JSON.stringify({ error: "Missing wallet_type (should be 'normal' or 'api')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
```

**Lines 32-40** - Update metadata (REPLACE entire section):
```typescript
    let paymentType = "api_wallet_topup";
    if (wallet_type === "normal") {
      paymentType = "user_wallet_topup";
    }

    const metadata = {
      type: paymentType,
      api_user_id: apiUser.id,
      identity_id: apiUser.identity_id,
      is_user: apiUser.is_user,
      is_agent: apiUser.is_agent,
      base_amount: baseAmount,
      fee_amount: feeAmount,
      wallet_type: wallet_type,
    };
```

### paystack-webhook-fixed/index.ts

**After Line 365** - Add new handler:
Copy entire section from `WALLET_TOPUP_CODE_SNIPPETS.md` → Section "2️⃣ SUPABASE WEBHOOK"

This goes AFTER the api_wallet_topup handler ends (line 365) and BEFORE the afa_registration handler.

---

## Testing the Implementation

### Test 1: Database Table
```sql
SELECT * FROM user_wallet_topups LIMIT 1;
```
Should return empty (or show topups if you already tested)

### Test 2: User Signup → Dashboard
1. Sign up as new user
2. Should see "Top Up" button on Normal Wallet card
3. Should see balance GHC 0.00

### Test 3: Complete Topup Flow
1. Click "Top Up" button on Normal Wallet
2. Enter amount: GHC 50.00
3. Click "Proceed to Paystack"
4. Use test card: `4111111111111111`
   - Expiry: Any future date (e.g., 12/25)
   - CVV: Any 3 digits (e.g., 123)
5. Complete payment
6. Should redirect to dashboard
7. Check: Wallet Balance shows GHC 50.00 ✅
8. Check database: New record in user_wallet_topups table

### Test 4: Order Display Fix
```sql
-- Run this to disable RLS and see if orders appear:
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
```

Then refresh dashboard - orders should appear.

---

## Orders Not Showing - Separate Issue

You mentioned orders not displaying (showing 0 even after 3 purchases).

**Quick Temporary Fix:**
```sql
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
```

**Proper Fix:**
Check RLS policies on orders table. Users should be able to see their own orders:
```sql
-- Check policies:
SELECT * FROM pg_policies WHERE tablename = 'orders';

-- Should have something like:
-- "Users can view own orders" - FOR SELECT USING (auth.uid() = customer_id)
```

---

## File Locations in Your Project

```
/vercel/share/v0-project/
├── WALLET_TOPUP_CODE_SNIPPETS.md
│   └── Quick copy-paste code for all 4 locations
├── NORMAL_WALLET_TOPUP_IMPLEMENTATION.md
│   └── Detailed step-by-step with 6 steps
├── WALLET_TOPUP_FLOW_DIAGRAM.md
│   └── Visual flow + database schemas + examples
├── WALLET_TOPUP_IMPLEMENTATION_SUMMARY.md
│   └── This file - overview and quick start
└── supabase/functions/
    ├── initialize-wallet-topup/index.ts (EDIT THIS)
    └── paystack-webhook-fixed/index.ts (EDIT THIS)
```

---

## Summary Table

| Task | File | Time | Difficulty |
|------|------|------|------------|
| Create table | Supabase SQL | 30 sec | Easy |
| Update initialize | Code snippet | 5 min | Easy |
| Update webhook | Code snippet | 5 min | Medium |
| Update frontend | Code snippet | 2 min | Easy |
| Deploy | Terminal | 3-5 min | Easy |
| **TOTAL** | | **20 min** | **Easy** |

---

## Common Mistakes to Avoid

❌ **Don't:** Copy code from api_wallet_topup handler without changing table names
✅ **Do:** Use `customers` table, not `api_users` table

❌ **Don't:** Forget to pass `wallet_type` parameter from frontend
✅ **Do:** Add `wallet_type: "normal"` to function body

❌ **Don't:** Update `api_users.wallet` in the webhook
✅ **Do:** Update `customers.wallet_balance` in the webhook

❌ **Don't:** Skip creating the `user_wallet_topups` table
✅ **Do:** Run the SQL migration first

---

## Next Steps

1. **Read** one of the 3 detailed guides (pick based on preference)
   - Visual? → WALLET_TOPUP_FLOW_DIAGRAM.md
   - Copy-paste? → WALLET_TOPUP_CODE_SNIPPETS.md
   - Detailed? → NORMAL_WALLET_TOPUP_IMPLEMENTATION.md

2. **Create** the database table (30 seconds in Supabase)

3. **Update** initialize function (5 minutes, 3 changes)

4. **Update** webhook function (5 minutes, 1 big change)

5. **Update** frontend component (2 minutes, 1 line)

6. **Deploy** functions (3-5 minutes)

7. **Test** with test Paystack card

8. **Verify** wallet balance updates

**Total time: ~20 minutes to working Normal Wallet Topup!**

---

## Need More Help?

All 3 guides are in your project - pick the one that makes most sense:

1. **WALLET_TOPUP_FLOW_DIAGRAM.md** - Start here if you like visual diagrams
2. **WALLET_TOPUP_CODE_SNIPPETS.md** - Start here if you want to copy-paste quickly
3. **NORMAL_WALLET_TOPUP_IMPLEMENTATION.md** - Start here if you want detailed explanations

All files committed to your GitHub repository!
