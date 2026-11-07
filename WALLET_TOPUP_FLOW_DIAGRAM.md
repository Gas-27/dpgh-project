# Normal Wallet Topup - Flow Diagram & Summary

## How Normal Wallet Topup Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER CLICKS "TOP UP" BUTTON                  │
│                   (On Normal Wallet Card)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         WalletTopupDialog Component Opens                       │
│         - Wallet Type: "normal"                                 │
│         - User enters amount: GHC 50.00                        │
│         - User clicks "Proceed to Paystack"                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND CALLS: initialize-wallet-topup Function              │
│  Body: {                                                        │
│    identity_id: "user-uuid",                                   │
│    amount: 50.00,                                              │
│    wallet_type: "normal",  ← KEY PARAMETER                     │
│    callback_url: "..."                                         │
│  }                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE FUNCTION: initialize-wallet-topup                    │
│  1. Get user from api_users table (by identity_id)            │
│  2. Calculate total with fee: 50.00 + 1.98% = 50.99          │
│  3. Create metadata:                                           │
│     type: "user_wallet_topup" (if wallet_type="normal")      │
│  4. Call Paystack API to initialize payment                  │
│  5. Create record in user_wallet_topups table (PENDING)       │
│  6. Return authorization_url                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER REDIRECTED TO PAYSTACK PAYMENT PAGE                      │
│  - User enters card details                                    │
│  - Paystack processes payment                                  │
│  - Payment callback sent to webhook                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  WEBHOOK: paystack-webhook-fixed receives charge.success       │
│  1. Verify Paystack signature                                  │
│  2. Check metadata.type = "user_wallet_topup"                 │
│  3. Get customer from customers table                          │
│  4. Read current wallet_balance                                │
│  5. Calculate new balance:                                     │
│     - OLD: wallet_balance = 0.00                               │
│     - NEW: wallet_balance = 0.00 + 50.00 = 50.00             │
│  6. UPDATE customers SET wallet_balance = 50.00                │
│  7. Create/update record in user_wallet_topups (COMPLETED)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER REDIRECTED TO DASHBOARD                                  │
│  - Overview shows: Wallet Balance: GHC 50.00 ✅               │
│  - User can now "Buy Data" using normal wallet                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Tables Involved

### 1. api_users (For API wallet tracking)
```sql
┌─────────────────────────────────┐
│          api_users              │
├─────────────────────────────────┤
│ id (UUID)                       │
│ api_key (VARCHAR)               │
│ identity_id (UUID) ← user ID    │
│ wallet (DECIMAL) ← API balance  │
│ is_user (BOOLEAN)               │
│ is_agent (BOOLEAN)              │
└─────────────────────────────────┘
```

### 2. customers (For normal wallet tracking)
```sql
┌─────────────────────────────────┐
│        customers                │
├─────────────────────────────────┤
│ id (UUID)                       │
│ email (VARCHAR)                 │
│ wallet_balance (DECIMAL) ← UPDATED
│ api_wallet_balance (DECIMAL)    │
│ has_agent_account (BOOLEAN)     │
│ agent_id (UUID)                 │
└─────────────────────────────────┘
```

### 3. user_wallet_topups (Transaction record)
```sql
┌──────────────────────────────────┐
│     user_wallet_topups           │
├──────────────────────────────────┤
│ id (UUID)                        │
│ customer_id (UUID) ← links here  │
│ amount (DECIMAL)                 │
│ fee_amount (DECIMAL)             │
│ total_amount (DECIMAL)           │
│ paystack_reference (VARCHAR)     │
│ status (PENDING/COMPLETED)       │
│ created_at (TIMESTAMP)           │
│ completed_at (TIMESTAMP)         │
│ metadata (JSONB)                 │
└──────────────────────────────────┘
```

---

## Request/Response Examples

### Step 1: Frontend to Initialize Function

**REQUEST:**
```json
{
  "identity_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50.00,
  "wallet_type": "normal",
  "callback_url": "https://dataplug.store/user-dashboard"
}
```

**RESPONSE:**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "reference": "WALLET_1234567890_abcdef",
    "amount": 50.99,
    "base_amount": 50.00,
    "fee_amount": 0.99
  }
}
```

### Step 2: Paystack Webhook to Handler

**WEBHOOK PAYLOAD (charge.success):**
```json
{
  "event": "charge.success",
  "data": {
    "reference": "WALLET_1234567890_abcdef",
    "amount": 5099,
    "metadata": {
      "type": "user_wallet_topup",
      "identity_id": "550e8400-e29b-41d4-a716-446655440000",
      "base_amount": 50.00,
      "fee_amount": 0.99,
      "wallet_type": "normal"
    }
  }
}
```

**HANDLER RESPONSE:**
```json
{
  "message": "User wallet topup processed successfully",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount_credited": 50.00,
  "fee_charged": 0.99,
  "total_paid": 50.99,
  "previous_balance": 0.00,
  "new_balance": 50.00,
  "transaction_reference": "WALLET_1234567890_abcdef"
}
```

---

## Code Changes Summary

### Initialize Function (supabase/functions/initialize-wallet-topup/index.ts)

| Line | Change | Type |
|------|--------|------|
| 29 | Add `wallet_type` to destructuring | Parameter |
| 48-54 | Add wallet_type validation | Validation |
| 32-40 | Update metadata section | Logic |

**Key Logic:**
```typescript
let paymentType = "api_wallet_topup";
if (wallet_type === "normal") {
  paymentType = "user_wallet_topup"; // ← Different type for webhook
}
```

### Webhook Function (supabase/functions/paystack-webhook-fixed/index.ts)

| Line | Change | Type |
|------|--------|------|
| After 365 | Add new if block for "user_wallet_topup" | Handler |

**Key Logic:**
```typescript
if (paymentType === "user_wallet_topup") {
  // Get customer from customers table
  // Update wallet_balance (NOT wallet like api_users)
  // Create record in user_wallet_topups
}
```

### Database

| Action | What | Where |
|--------|------|-------|
| CREATE | user_wallet_topups table | Supabase |
| CREATE | Indexes for performance | Supabase |
| ENABLE | RLS policies | Supabase |

### Frontend

| Component | Change | Parameter |
|-----------|--------|-----------|
| WalletTopupDialog | Pass wallet_type to function | wallet_type: "normal" |

---

## Key Differences: Normal vs API Wallet

| Aspect | Normal Wallet | API Wallet |
|--------|---------------|-----------|
| **Table** | customers | api_users |
| **User ID Field** | id (same as auth.users) | identity_id |
| **Balance Field** | wallet_balance | wallet |
| **Topup Table** | user_wallet_topups | api_wallet_topups |
| **Payment Type** | user_wallet_topup | api_wallet_topup |
| **Purpose** | Regular user data purchases | API/Reseller purchases |
| **Accessed By** | Regular users | API users & resellers |

---

## Testing Checklist

- [ ] Database table created (user_wallet_topups)
- [ ] Initialize function updated with wallet_type handling
- [ ] Webhook function has user_wallet_topup handler
- [ ] WalletTopupDialog passes wallet_type parameter
- [ ] User clicks "Top Up" on Normal Wallet
- [ ] Redirected to Paystack payment page
- [ ] Completes payment with test card
- [ ] Wallet balance updates in dashboard
- [ ] Record appears in user_wallet_topups table
- [ ] Webhook logs show "[USER WALLET TOPUP] ✅"

---

## Debugging

### Check if webhook received payment:
```sql
SELECT * FROM user_wallet_topups 
WHERE customer_id = 'your-user-id' 
ORDER BY created_at DESC;
```

### Check customer wallet balance:
```sql
SELECT id, email, wallet_balance 
FROM customers 
WHERE id = 'your-user-id';
```

### Check webhook logs:
Go to Supabase → Functions → paystack-webhook-fixed → Logs

Look for: `[USER WALLET TOPUP] ✅ Credited GHS 50.00`

---

## Summary

**What Changed:**
- Initialize function now accepts `wallet_type` parameter
- Webhook now handles `user_wallet_topup` payment type
- New database table tracks user wallet topups
- Frontend passes `wallet_type` when calling initialize

**Result:**
- Users can top up normal wallet
- Balance updates after Paystack payment
- Separate tracking from API wallet
- Same email for both wallets
