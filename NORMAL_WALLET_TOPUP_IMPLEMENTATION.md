# Normal Wallet Topup Implementation Guide

## Problem
Currently, only API wallet topup works. Regular users cannot top up their normal wallet for purchasing data directly. The Top Up button always routes to API wallet regardless of which wallet is selected.

## Solution Overview
We need to:
1. Create a `user_wallet_topups` table in Supabase
2. Add normal wallet topup handler to `initialize-wallet-topup` function
3. Add normal wallet topup handler to `paystack-webhook-fixed` function
4. Fix the WalletTopupDialog to pass correct wallet type

---

## STEP 1: Database Migration

**Location:** Supabase Dashboard → SQL Editor

**Create New Query and paste this SQL:**

```sql
-- Create user_wallet_topups table (for regular customer wallet topups)
CREATE TABLE IF NOT EXISTS user_wallet_topups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  paystack_reference VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX idx_user_wallet_topups_customer_id ON user_wallet_topups(customer_id);
CREATE INDEX idx_user_wallet_topups_paystack_reference ON user_wallet_topups(paystack_reference);
CREATE INDEX idx_user_wallet_topups_status ON user_wallet_topups(status);

-- Enable RLS
ALTER TABLE user_wallet_topups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own topups" ON user_wallet_topups
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Service role can manage topups" ON user_wallet_topups
  FOR ALL USING (auth.role() = 'service_role');
```

**Then click Run**

---

## STEP 2: Add Code to Initialize Wallet Topup Function

**Location:** `/vercel/share/v0-project/supabase/functions/initialize-wallet-topup/index.ts`

**Line 44-48 (after validating amount):**

Currently has:
```typescript
    if (!callback_url) {
      return new Response(
        JSON.stringify({ error: "Missing callback_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
```

**ADD AFTER LINE 48:**
```typescript
    if (!wallet_type) {
      return new Response(
        JSON.stringify({ error: "Missing wallet_type (should be 'normal' or 'api')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
```

**Line 50 (Parse Request section):**

Change from:
```typescript
    const { api_key, identity_id, amount, callback_url } = await req.json();
```

To:
```typescript
    const { api_key, identity_id, amount, callback_url, wallet_type } = await req.json();
```

**Line 70 (console.log for Request):**

Add to the logging object:
```typescript
      wallet_type: wallet_type || "api",
```

So it becomes:
```typescript
    console.log(`[INITIALIZE-WALLET-TOPUP] Request:`, { 
      api_key: api_key ? "present" : "missing", 
      identity_id: identity_id ? "present" : "missing",
      amount, 
      callback_url: callback_url ? "present" : "missing",
      wallet_type: wallet_type || "api"
    });
```

**Line 132 (metadata section for API wallet):**

Currently:
```typescript
    const metadata = {
      type: "api_wallet_topup",
      api_user_id: apiUser.id,
      identity_id: apiUser.identity_id,
      is_user: apiUser.is_user,
      is_agent: apiUser.is_agent,
      base_amount: baseAmount,
      fee_amount: feeAmount,
    };
```

**REPLACE WITH:**
```typescript
    // Determine payment type based on wallet_type
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

---

## STEP 3: Add Code to Webhook Function

**Location:** `/vercel/share/v0-project/supabase/functions/paystack-webhook-fixed/index.ts`

**Line 365 (after API_WALLET_TOPUP handler ends, before AFA_REGISTRATION section):**

**ADD THIS NEW HANDLER:**

```typescript
    // =====================================
    // USER NORMAL WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "user_wallet_topup") {
      const customerId = metadata.identity_id; // This is the user ID
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

      // Check if topup already processed
      const { data: existingTopup, error: checkError } = await supabaseClient
        .from("user_wallet_topups")
        .select("id, status")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingTopup) {
        if (existingTopup.status === "completed") {
          console.log(`[USER WALLET TOPUP] Already processed for reference ${reference}`);
          return new Response(JSON.stringify({ message: "Topup already processed" }), {
            status: 200,
            headers: corsHeaders
          });
        }
        console.log(`[USER WALLET TOPUP] Found pending topup, continuing...`);
      }

      // Get current wallet balance from customers table
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

      // Update wallet balance in customers table
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

      // Create or update topup record to completed
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

      if (upsertError) {
        console.error(`[USER WALLET TOPUP] Failed to update topup record:`, upsertError);
        // Don't fail the request, wallet is already credited
      }

      console.log(`[USER WALLET TOPUP] ✅ Wallet topped up: GHS ${baseAmount} for customer ${customerId}`);
      console.log(`[USER WALLET TOPUP] Balance: ${currentBalance} → ${newBalance}`);

      return new Response(
        JSON.stringify({
          message: "User wallet topup processed successfully",
          customer_id: customerId,
          amount_credited: baseAmount,
          fee_charged: feeAmount,
          total_paid: totalAmount,
          previous_balance: currentBalance,
          new_balance: newBalance,
          transaction_reference: reference,
        }),
        { status: 200, headers: corsHeaders }
      );
    }
```

---

## STEP 4: Fix WalletTopupDialog Props

The problem is that `WalletTopupDialog` needs to receive the correct `walletType` parameter.

**Location:** Check `src/components/WalletTopupDialog.tsx`

Make sure the dialog accepts `walletType` parameter and passes it to the API call as part of the request body.

---

## STEP 5: Update Initialize Payment Call

When calling the `initialize-wallet-topup` function, pass `wallet_type`:

**Location:** `src/components/WalletTopupDialog.tsx` or wherever you call initialize-wallet-topup

**Current code likely looks like:**
```typescript
const response = await supabase.functions.invoke("initialize-wallet-topup", {
  body: {
    api_key: props.apiKey,
    identity_id: props.identityId,
    amount: amount,
    callback_url: callbackUrl
  }
});
```

**CHANGE TO:**
```typescript
const response = await supabase.functions.invoke("initialize-wallet-topup", {
  body: {
    api_key: props.apiKey,
    identity_id: props.identityId,
    amount: amount,
    callback_url: callbackUrl,
    wallet_type: props.walletType  // ADD THIS LINE - "normal" or "api"
  }
});
```

---

## STEP 6: Deploy Changes

1. Run database migration in Supabase SQL Editor
2. Deploy webhook function:
   ```bash
   supabase functions deploy paystack-webhook-fixed
   ```
3. Deploy initialize function:
   ```bash
   supabase functions deploy initialize-wallet-topup
   ```
4. Update WalletTopupDialog component in Next.js
5. Rebuild your app

---

## Testing

1. Log in as a user
2. Click "Top Up" on Normal Wallet (not API Wallet)
3. Enter amount (e.g., GHC 10.00)
4. Complete Paystack payment
5. Check dashboard - wallet_balance in customers table should increase
6. Check user_wallet_topups table - should show completed record

---

## Troubleshooting

**Orders not showing:**
- Check that orders table has correct RLS policies
- Verify customer_id matches user ID in orders table
- Run: `ALTER TABLE orders DISABLE ROW LEVEL SECURITY;`

**Wallet not updating:**
- Check Paystack webhook logs in Supabase
- Verify paystack_reference is being passed correctly
- Check that PAYSTACK_SECRET_KEY is set in Supabase

**Topup button not working:**
- Verify walletType prop is being passed to WalletTopupDialog
- Check browser console for errors
- Verify Supabase function is deployed
