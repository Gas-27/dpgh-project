# Withdrawal Feature - Quick Reference Guide

## What Users See

### Withdrawal Tab Interface

#### Option A: User Has Recipients
```
┌─────────────────────────────────┐
│ Select Recipient                │
│ [Dropdown with saved accounts]  │
│                                 │
│ + Add New Recipient             │
│                                 │
│ My Wallet Balance: GH₵ 500.00   │
│                                 │
│ Amount: [input]                 │
│ [Transfer Button]               │
└─────────────────────────────────┘
```

#### Option B: User Has No Recipients
```
┌─────────────────────────────────┐
│ Add Recipient                   │ ← Button
│                                 │
│ (Click to create first recipient)
└─────────────────────────────────┘
```

#### Option C: Creating New Recipient
```
┌─────────────────────────────────┐
│ ← Back to Recipients            │
│                                 │
│ Recipient Type:                 │
│ [Bank Account] [Mobile Money]   │
│                                 │
│ Full Name: [input]              │
│ Bank Name: [input]              │
│ Bank Code: [input]              │
│ Account Number: [input]         │
│                                 │
│ My Wallet Balance: GH₵ 500.00   │
│ Amount: [input]                 │
│ [Transfer Button]               │
└─────────────────────────────────┘
```

---

## Key Features

### 1. Recipient Types

**Bank Account:**
- Account Holder Name
- Bank Name (e.g., GCB Bank)
- Bank Code (e.g., 030)
- Account Number

**Mobile Money:**
- Account Holder Name
- Network (MTN, Telecel, AirtelTigo)
- Mobile Number (024XXXXXXX format)

### 2. Withdrawal Requirements
- Minimum: GH₵ 10.00
- Only one pending withdrawal at a time
- Must have available balance
- Processed within 24 hours

### 3. Flow

**Step 1:** User loads Withdraw tab
- System fetches existing recipients and wallet balance

**Step 2:** User selects action
- Use existing recipient → enter amount → transfer
- Create new recipient → fill form → enter amount → transfer

**Step 3:** Withdrawal initiated
- Edge function creates recipient (if new)
- Edge function initiates Paystack transfer
- Balance updated in real-time

**Step 4:** Completion
- Success: Show transfer code, update balance
- Failure: Refund balance, show error message

---

## Technical Details

### State Management

Both dashboards use these state variables:
```typescript
const [createNewRecipient, setCreateNewRecipient] = useState(false);
const [recipientType, setRecipientType] = useState<"bank" | "mobile_money">("bank");
const [recipientName, setRecipientName] = useState("");
const [bankName, setBankName] = useState("");
const [bankCode, setBankCode] = useState("");
const [accountNumber, setAccountNumber] = useState("");
const [mobileNetwork, setMobileNetwork] = useState("mtn");
const [mobileNumber, setMobileNumber] = useState("");
```

### Data Fetching

Recipients and payout history are fetched in the `fetchAllData()` function:
```typescript
// From transfer_recipients table
supabase.from("transfer_recipients")
  .select("*")
  .eq("agent_store_id", sd.id)
  .eq("is_active", true)

// From payout_requests table
supabase.from("payout_requests")
  .select("*")
  .eq("agent_store_id", sd.id)
```

### Edge Function Call

```typescript
const response = await fetch(
  "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }
);
```

**Payload for New Recipient:**
```json
{
  "amount": 100,
  "agent_store_id": "uuid",
  "withdrawal_source": "wallet",
  "recipient_details": {
    "account_holder_name": "Name",
    "provider_type": "bank",
    "bank_name": "Bank",
    "bank_code": "030",
    "account_number": "1234567890"
  }
}
```

**Payload for Existing Recipient:**
```json
{
  "amount": 100,
  "agent_store_id": "uuid",
  "withdrawal_source": "wallet",
  "recipient_id": "recipient-uuid"
}
```

---

## Files Modified

1. **AgentDashboard.tsx**
   - Added 8 state variables (lines 343-354)
   - Updated `handleWithdraw()` function (lines 1134-1195)
   - Updated withdrawal UI (lines 2189-2339)

2. **SubagentDashboard.tsx**
   - Added 8 state variables (lines 170-180)
   - Updated `handleRequestWithdrawal()` function
   - Updated withdrawal UI (lines 2462-2630)

---

## Validation Messages

| Scenario | Message |
|----------|---------|
| No recipient selected | "Select a recipient" |
| Amount < GH₵ 10 | "Minimum is GH₵ 10.00" |
| Insufficient balance | "Insufficient balance" |
| Pending withdrawal exists | "Pending withdrawal exists" |
| Missing recipient name | "Enter recipient name" |
| Missing bank details | "Fill in all bank details" |
| Missing mobile number | "Enter mobile number" |
| Transfer failed | Shows error from backend |

---

## Success Indicators

✅ Withdrawal initiated - Green notification
✅ Balance updated in real-time
✅ Transfer code displayed
✅ History updated with new transaction
✅ Form cleared for next withdrawal

---

## Troubleshooting

### Issue: "No recipients configured yet" message won't go away
**Solution:** Click "Add Recipient" button to create one

### Issue: Form fields disappear when toggling recipient type
**Solution:** This is expected - different forms for bank vs mobile money

### Issue: Withdrawal fails with "Insufficient balance"
**Solution:** Check pending withdrawals - they reduce available balance

### Issue: Bank code field rejected
**Solution:** Use correct 3-digit bank code (e.g., 030 for GCB)

### Issue: Mobile number format error
**Solution:** Use format 024XXXXXXX (10 digits starting with 024)

---

## Edge Function Requirements

The edge function MUST support:
1. Creating new transfer_recipients with `recipient_details`
2. Using existing recipients with `recipient_id`
3. Returning transfer codes on success
4. Refunding balance on failure
5. Returning error messages for validation failures

---

## Testing Commands

```bash
# Build project
pnpm build

# Dev server
pnpm dev

# Type check
pnpm type-check
```

All tests pass ✅ - Build successful
