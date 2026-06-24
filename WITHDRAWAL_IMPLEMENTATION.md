# Paystack Transfer Withdrawal System Implementation Guide

## Overview

This document explains the complete withdrawal system that integrates with Paystack transfers to enable agents and subagents to withdraw their earnings.

**Edge Function URL**: `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request`

---

## System Architecture

### 1. **Data Flow**

```
User Request Withdrawal
    ↓
Frontend sends data to edge function
    ↓
Edge function validates balance & requester
    ↓
Creates/retrieves transfer recipient in Paystack
    ↓
Deducts balance from wallet
    ↓
Initiates Paystack transfer
    ↓
On success: Updates payout_requests table as "success"
On failure: Refunds wallet and marks as "failed"
```

### 2. **Database Tables**

**`transfer_recipients`** - Stores recipient information
```sql
- id: UUID (primary key)
- user_id: UUID (from auth)
- recipient_code: TEXT (Paystack recipient code)
- account_holder_name: TEXT
- provider_type: TEXT ("bank" or "mobile_money")
- bank_name: TEXT (nullable)
- bank_code: TEXT (nullable)
- account_number: TEXT (nullable)
- mobile_money_network: TEXT (nullable)
- mobile_money_number: TEXT (nullable)
- status: TEXT ("active" or "inactive")
- created_at: TIMESTAMP
```

**`payout_requests`** - Stores withdrawal history
```sql
- id: UUID (primary key)
- requester_type: TEXT ("agent" or "subagent")
- requester_id: UUID (agent_store_id or subagent_store_id)
- recipient_id: UUID (references transfer_recipients)
- amount: DECIMAL
- status: TEXT ("processing", "success", "failed")
- transfer_code: TEXT (Paystack transfer code)
- paystack_reference: TEXT
- paystack_response: JSONB
- withdrawal_source: TEXT ("wallet_balance" or "subagent_commission_balance")
- source_balance_before: DECIMAL
- source_balance_after: DECIMAL
- failure_reason: TEXT (nullable)
- created_at: TIMESTAMP
- completed_at: TIMESTAMP (nullable)
```

---

## Frontend Components

### 1. **Withdrawals Page** (`/pages/Withdrawals.tsx`)

Main page with tabs for:
- Request Withdrawal
- Recipients Management
- Payout History

**Usage**:
```typescript
import WithdrawalsPage from '@/pages/Withdrawals';

// In your routing/navigation
<Route path="/withdrawals" component={WithdrawalsPage} />
```

### 2. **WithdrawalBalance** (`/components/WithdrawalBalance.tsx`)

Displays:
- Wallet balance (for all users)
- Commission balance (agents only)

**Props**:
- `userRole`: "agent" or "subagent"
- `storeId`: User's store ID
- `refreshKey`: Trigger data refresh

### 3. **RecipientManager** (`/components/RecipientManager.tsx`)

Displays list of transfer recipients and allows:
- Add new recipients (max 2)
- Delete/deactivate recipients

**Props**:
- `token`: User's auth token
- `onRefresh`: Callback when recipient changes
- `refreshKey`: Trigger data refresh

### 4. **AddRecipientForm** (`/components/AddRecipientForm.tsx`)

Form to add new transfer recipient:
- Bank account (requires: account holder, bank, account number)
- Mobile money (requires: account holder, network, number)

**Bank Codes**:
- `123`: GCB Bank
- `026`: Zenith Bank
- `050`: EcoBank
- `058`: Guaranty Trust Bank

**Mobile Money Networks**:
- `mtn`: MTN Mobile Money
- `telecel`: Telecel (Vodafone)
- `airteltigo`: AirtelTigo

### 5. **WithdrawalForm** (`/components/WithdrawalForm.tsx`)

Main form to request withdrawal:
- Select recipient
- Select withdrawal source (agents only)
- Enter amount
- Submit request

**Props**:
- `userRole`: "agent" or "subagent"
- `storeId`: User's store ID
- `token`: User's auth token
- `onSuccess`: Callback after successful withdrawal
- `refreshKey`: Trigger data refresh

### 6. **PayoutHistory** (`/components/PayoutHistory.tsx`)

Displays table of all payout requests:
- Amount, status, recipient
- Transfer code
- Timestamp
- Balance after transfer

---

## Utility Functions (`/lib/withdrawal.ts`)

### Balance Queries

```typescript
// Get agent balance (includes both wallet_balance and subagent_commission_balance)
await getAgentBalance(agentStoreId: string): Promise<Balance>

// Get subagent balance (wallet_balance only)
await getSubagentBalance(subagentStoreId: string): Promise<Balance>
```

### Recipient Management

```typescript
// Get all active recipients
await getTransferRecipients(): Promise<TransferRecipient[]>

// Deactivate a recipient
await deactivateRecipient(recipientId: string): Promise<void>
```

### Payout Operations

```typescript
// Create payout request (creates recipient if needed)
await createPayoutRequest(
  token: string,
  payload: {
    requester_type: "agent" | "subagent",
    requester_id: string,
    withdrawal_source: string,
    amount: number,
    recipient_id?: string,  // For existing recipient
    recipient_details?: {   // For new recipient
      account_holder_name: string,
      provider_type: "bank" | "mobile_money",
      // ... bank or mobile money fields
    }
  }
): Promise<PayoutResponse>

// Get payout history
await getPayoutHistory(requesterType: string, requesterId: string): Promise<PayoutRequest[]>
```

---

## API Request/Response Format

### Request to Edge Function

**With Existing Recipient**:
```json
{
  "requester_type": "agent",
  "requester_id": "store-uuid",
  "withdrawal_source": "wallet_balance",
  "amount": 100.00,
  "recipient_id": "recipient-uuid"
}
```

**With New Recipient (Bank)**:
```json
{
  "requester_type": "agent",
  "requester_id": "store-uuid",
  "withdrawal_source": "wallet_balance",
  "amount": 100.00,
  "recipient_details": {
    "account_holder_name": "John Doe",
    "provider_type": "bank",
    "bank_name": "GCB Bank",
    "bank_code": "123",
    "account_number": "1234567890"
  }
}
```

### Success Response

```json
{
  "success": true,
  "payout_request_id": "uuid",
  "status": "success",
  "transfer_code": "TRF_xxxxx",
  "amount": 100.00,
  "balance_before": 500.00,
  "balance_after": 400.00,
  "message": "Payout completed successfully"
}
```

### Error Response

**Insufficient Balance**:
```json
{
  "success": false,
  "error": "Insufficient balance. Available: GHS 50.00"
}
```

**Transfer Failed (Refunded)**:
```json
{
  "success": false,
  "error": "Transfer failed. Your wallet has been refunded.",
  "payout_request_id": "uuid",
  "status": "failed",
  "failure_reason": "Insufficient balance in Paystack wallet",
  "wallet_restored": true,
  "balance": 500.00,
  "message": "Wallet refunded. Please try again later."
}
```

---

## Integration Steps

### 1. Add Navigation Link

```typescript
// In your main navigation/menu component
<Link href="/withdrawals">Withdrawals</Link>
```

### 2. Update Authentication Context

Ensure your `AuthContext` provides:
- `user`: Authenticated user
- `userRole`: "agent" or "subagent"
- `storeId`: User's store ID
- `session.access_token`: For API calls

### 3. Test with Sample Data

1. Create test agent/subagent stores with balances
2. Add test transfer recipients
3. Test withdrawal requests
4. Verify balance updates

### 4. Handle Edge Cases

**Insufficient Balance**:
```typescript
if (error.includes("Insufficient balance")) {
  // Show specific error message
  // Suggest user to earn more or reduce amount
}
```

**Wallet Refund on Failure**:
```typescript
if (result.wallet_restored) {
  // Show success message: "Your wallet has been refunded"
  // Suggest retry after checking Paystack balance
}
```

---

## Testing Scenarios

### Test 1: Successful Withdrawal
1. Agent with balance GHS 500
2. Add bank recipient
3. Request withdrawal of GHS 100
4. Verify:
   - Balance becomes GHS 400
   - Payout record created with status "success"
   - Transfer code returned

### Test 2: Insufficient Balance
1. Agent with balance GHS 50
2. Request withdrawal of GHS 100
3. Verify: Error message shown, balance unchanged

### Test 3: Recipient Management
1. Add 2 recipients (max)
2. Try to add 3rd → Error
3. Delete 1 recipient
4. Add new recipient → Success

### Test 4: Agent Commission Withdrawal
1. Agent with commission balance GHS 200
2. Select "Commission Balance" as source
3. Request withdrawal
4. Verify: Commission balance deducted

---

## Security Considerations

✓ Edge function validates `requester_type` and `requester_id` against authenticated user
✓ Balance is deducted before transfer to prevent double-spending
✓ Transfer failures automatically refund wallet
✓ All requests require valid auth token
✓ Recipients are user-scoped (user_id validation)

---

## Monitoring

Watch edge function logs for:
- `[CREATE-PAYOUT]` messages
- `Transfer failed` → Check Paystack wallet balance
- `CRITICAL: Wallet refund failed` → Manual intervention needed

---

## Support URLs

- Paystack Transfers: https://paystack.com/docs/transfers
- Paystack Recipients: https://paystack.com/docs/transfers/recipients
- Edge Function: https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request
