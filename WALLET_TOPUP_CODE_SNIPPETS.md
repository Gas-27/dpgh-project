# Quick Reference: Normal Wallet Topup Code Snippets

## Where to Add Code - Visual Guide

### 1️⃣ SUPABASE FUNCTION: initialize-wallet-topup

**File:** `supabase/functions/initialize-wallet-topup/index.ts`

#### Change 1: Line 29 - Add wallet_type to destructuring
```diff
- const { api_key, identity_id, amount, callback_url } = await req.json();
+ const { api_key, identity_id, amount, callback_url, wallet_type } = await req.json();
```

#### Change 2: Line 48-54 - Add wallet_type validation
```typescript
// ADD THIS BLOCK AFTER callback_url validation:
    if (!wallet_type) {
      return new Response(
        JSON.stringify({ error: "Missing wallet_type (should be 'normal' or 'api')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
```

#### Change 3: Line 32-37 - Update metadata (REPLACE THIS SECTION)
```diff
- const metadata = {
-   type: "api_wallet_topup",
-   api_user_id: apiUser.id,
-   identity_id: apiUser.identity_id,
-   is_user: apiUser.is_user,
-   is_agent: apiUser.is_agent,
-   base_amount: baseAmount,
-   fee_amount: feeAmount,
- };

+ // Determine payment type based on wallet_type
+ let paymentType = "api_wallet_topup";
+ if (wallet_type === "normal") {
+   paymentType = "user_wallet_topup";
+ }
+
+ const metadata = {
+   type: paymentType,
+   api_user_id: apiUser.id,
+   identity_id: apiUser.identity_id,
+   is_user: apiUser.is_user,
+   is_agent: apiUser.is_agent,
+   base_amount: baseAmount,
+   fee_amount: feeAmount,
+   wallet_type: wallet_type,
+ };
```

---

### 2️⃣ SUPABASE WEBHOOK: paystack-webhook-fixed

**File:** `supabase/functions/paystack-webhook-fixed/index.ts`

#### ADD THIS ENTIRE SECTION after line 365 (after API_WALLET_TOPUP handler ends):

```typescript
    // =====================================
    // USER NORMAL WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "user_wallet_topup") {
      const customerId = metadata.identity_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);
      const feeAmount = Number(metadata.fee_amount) || 0;
      const totalAmount = Number(amount) / 100;
      
      if (!customerId) {
        console.error("[USER WALLET TOPUP] Missing customer_id");
        return new Response(JSON.stringify({ error: "Missing customer_id" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // Check if topup already processed (prevent duplicates)
      const { data: existingTopup } = await supabaseClient
        .from("user_wallet_topups")
        .select("id, status")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingTopup?.status === "completed") {
        console.log(`[USER WALLET TOPUP] Already processed for reference ${reference}`);
        return new Response(JSON.stringify({ message: "Topup already processed" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Get current wallet balance
      const { data: customer, error: userError } = await supabaseClient
        .from("customers")
        .select("id, wallet_balance")
        .eq("id", customerId)
        .single();

      if (userError || !customer) {
        console.error(`[USER WALLET TOPUP] Customer not found: ${customerId}`);
        return new Response(JSON.stringify({ error: "Customer not found" }), {
          status: 404,
          headers: corsHeaders
        });
      }

      const currentBalance = Number(customer.wallet_balance) || 0;
      const newBalance = currentBalance + baseAmount;

      // Update customers wallet_balance
      const { error: updateError } = await supabaseClient
        .from("customers")
        .update({ wallet_balance: newBalance })
        .eq("id", customerId);

      if (updateError) {
        console.error(`[USER WALLET TOPUP] Failed to update wallet:`, updateError);
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      // Record the topup
      const { error: upsertError } = await supabaseClient
        .from("user_wallet_topups")
        .upsert({
          id: existingTopup?.id,
          customer_id: customerId,
          amount: baseAmount,
          fee_amount: feeAmount,
          total_amount: totalAmount,
          paystack_reference: reference,
          status: "completed",
          completed_at: new Date().toISOString(),
          metadata: metadata
        }, { onConflict: "paystack_reference" });

      console.log(`[USER WALLET TOPUP] ✅ Credited GHS ${baseAmount} to ${customerId}`);
      console.log(`[USER WALLET TOPUP] Balance: ${currentBalance} → ${newBalance}`);

      return new Response(
        JSON.stringify({
          message: "User wallet topup processed successfully",
          customer_id: customerId,
          amount_credited: baseAmount,
          previous_balance: currentBalance,
          new_balance: newBalance,
          transaction_reference: reference,
        }),
        { status: 200, headers: corsHeaders }
      );
    }
```

---

### 3️⃣ DATABASE: Create user_wallet_topups Table

**Run in Supabase SQL Editor:**

```sql
-- Create user_wallet_topups table
CREATE TABLE IF NOT EXISTS user_wallet_topups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  paystack_reference VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_user_wallet_topups_customer_id ON user_wallet_topups(customer_id);
CREATE INDEX idx_user_wallet_topups_paystack_reference ON user_wallet_topups(paystack_reference);
CREATE INDEX idx_user_wallet_topups_status ON user_wallet_topups(status);

ALTER TABLE user_wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topups" ON user_wallet_topups
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Service role can manage topups" ON user_wallet_topups
  FOR ALL USING (auth.role() = 'service_role');
```

---

### 4️⃣ FRONTEND: Update WalletTopupDialog Call

**File:** `src/components/WalletTopupDialog.tsx` or wherever you invoke initialize-wallet-topup

```typescript
// FIND THIS CODE:
const response = await supabase.functions.invoke("initialize-wallet-topup", {
  body: {
    api_key: props.apiKey,
    identity_id: props.identityId,
    amount: amount,
    callback_url: callbackUrl
  }
});

// CHANGE TO THIS (add wallet_type):
const response = await supabase.functions.invoke("initialize-wallet-topup", {
  body: {
    api_key: props.apiKey,
    identity_id: props.identityId,
    amount: amount,
    callback_url: callbackUrl,
    wallet_type: props.walletType || "api"  // ← ADD THIS LINE
  }
});
```

---

## Summary of Changes

| Location | What | Lines |
|----------|------|-------|
| initialize-wallet-topup | Add wallet_type param | Line 29 |
| initialize-wallet-topup | Validate wallet_type | Line 48-54 |
| initialize-wallet-topup | Update metadata | Line 32-40 |
| webhook | Add user wallet handler | After line 365 |
| database | Create table | SQL query |
| frontend | Pass wallet_type | Function call |

---

## Order Display Issue - Also Fix This

**The reason orders don't show (showing 0 orders):**

Run this in Supabase SQL Editor:

```sql
-- Disable RLS on orders table to see if that fixes display
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Verify orders exist
SELECT id, customer_id, customer_number, status FROM orders LIMIT 10;
```

Then refresh your dashboard and check if orders appear.

---

## Deploy Commands

After making changes:

```bash
# Navigate to project
cd /vercel/share/v0-project

# Deploy webhook function
supabase functions deploy paystack-webhook-fixed

# Deploy initialize function  
supabase functions deploy initialize-wallet-topup

# Rebuild Next.js app
pnpm run build
```
