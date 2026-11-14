# Paystack Withdrawal Integration - Quick Reference

## Exact Files & Lines Modified

### **AgentDashboard.tsx**

```
State added (lines 343-346):
- selectedRecipient
- transferRecipients

handleWithdraw updated (lines 1121-1159):
- Now calls edge function instead of DB insert
- Validates selectedRecipient

Data fetch updated (lines 680-691):
- Added recipientsR query
- Added payoutR query

UI updated (lines 2122-2169):
- Recipient dropdown
- Transfer button instead of Withdraw
- Payout history table
```

### **SubagentDashboard.tsx**

```
State added (lines 165-167):
- selectedRecipient
- transferRecipients

handleRequestWithdrawal updated (lines 1122-1175):
- Validates selectedRecipient
- Calls edge function
- Better error handling

Data fetch updated (lines 488-510):
- Added recipientsResult
- Added payoutResult

UI updated (lines 2397-2475):
- "Request Paystack Transfer" title
- Recipient dropdown
- "Transfer" button
- Updated payout history
```

---

## Edge Function Request

**URL:** `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request`

**Method:** POST

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (Agent):**
```json
{
  "recipient_code": "RCP_xxx",
  "amount": 50.00,
  "agent_store_id": "store-uuid",
  "withdrawal_source": "wallet"
}
```

**Body (Subagent):**
```json
{
  "recipient_code": "RCP_xxx",
  "amount": 50.00,
  "subagent_store_id": "store-uuid"
}
```

---

## Database Queries

### Get Active Recipients (Agent)
```sql
SELECT * FROM transfer_recipients 
WHERE agent_store_id = ? AND is_active = true
ORDER BY created_at DESC
```

### Get Active Recipients (Subagent)
```sql
SELECT * FROM transfer_recipients 
WHERE subagent_store_id = ? AND is_active = true
ORDER BY created_at DESC
```

### Get Payout History (Agent)
```sql
SELECT * FROM payout_requests 
WHERE agent_store_id = ?
ORDER BY created_at DESC
```

### Get Payout History (Subagent)
```sql
SELECT * FROM payout_requests 
WHERE subagent_store_id = ?
ORDER BY created_at DESC
```

---

## User UI Changes

### **Agent Dashboard - Withdraw Tab**

**Before:**
- "Request Withdrawal from My Wallet"
- Direct amount input
- Withdrawal history table

**After:**
- "Request Paystack Transfer"
- Recipient dropdown (required)
- Amount input
- "Transfer" button
- Payout history with transfer codes

### **Subagent Dashboard - Withdraw Tab**

**Before:**
- "Request Withdrawal"
- MoMo info display
- Basic withdrawal history

**After:**
- "Request Paystack Transfer"
- **NEW** Recipient dropdown (required)
- Balance display
- Amount input
- "Transfer" button
- Enhanced payout history

---

## State Variables Added

### Both Dashboards

```typescript
const [selectedRecipient, setSelectedRecipient] = useState<string>("");
const [transferRecipients, setTransferRecipients] = useState<any[]>([]);
```

---

## Validation Logic

```typescript
// Before calling edge function:
1. Check selectedRecipient is not empty ✅
2. Check amount >= 10 ✅
3. Check no pending withdrawal exists ✅
4. Check sufficient balance ✅
5. Then call edge function
```

---

## Error Scenarios

| Scenario | Message | Resolution |
|----------|---------|-----------|
| No recipients | "No recipients configured yet" | Add recipient first |
| No recipient selected | "Select a recipient" | Choose from dropdown |
| Amount < 10 | "Minimum is GH₵ 10.00" | Enter higher amount |
| Insufficient balance | "Insufficient balance" | Top up wallet |
| Pending withdrawal | "Please wait until it completes" | Wait for approval |
| Transfer fails | Shows error from edge function | Retry or contact support |

---

## Build Output

✅ Build successful with no errors

```
AgentDashboard-*.js:        150.46 kB
SubagentDashboard-*.js:     102.31 kB
```

---

## Deployment Checklist

- [ ] Code built successfully ✅
- [ ] Git changes committed
- [ ] Deploy to staging/production
- [ ] Test Agent withdrawal
- [ ] Test Subagent withdrawal
- [ ] Verify payout_requests entries
- [ ] Check Paystack transfer codes appear

---

## Testing Data Example

### Sample Request (Agent)
```json
{
  "recipient_code": "RCP_1234567890",
  "amount": 50.00,
  "agent_store_id": "123e4567-e89b-12d3-a456-426614174000",
  "withdrawal_source": "wallet"
}
```

### Sample payout_requests Entry
```json
{
  "id": "uuid",
  "agent_store_id": "123e4567-e89b-12d3-a456-426614174000",
  "recipient_code": "RCP_1234567890",
  "amount": 50.00,
  "status": "pending",
  "transfer_code": "TRF_abc123def456",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Important Notes

1. **Recipients must exist** in `transfer_recipients` table for withdrawal to work
2. **Edge function** handles balance deduction and Paystack transfer
3. **Status updates** happen after Paystack processes transfer
4. **Automatic refund** if transfer fails (edge function handles this)
5. **Transfer codes** stored in `payout_requests` for Paystack reference

---

## Support Links

- Edge Function: `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request`
- Database Tables: `transfer_recipients`, `payout_requests`
- Documentation: `PAYSTACK_INTEGRATION_SUMMARY.md`
