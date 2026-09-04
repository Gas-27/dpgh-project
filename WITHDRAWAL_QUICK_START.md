# Withdrawal System - Quick Start

## Files Created

```
src/
├── lib/
│   └── withdrawal.ts              # Utility functions for withdrawal operations
├── pages/
│   └── Withdrawals.tsx            # Main withdrawal page with tabs
└── components/
    ├── WithdrawalBalance.tsx      # Display wallet/commission balance
    ├── RecipientManager.tsx       # List and manage transfer recipients
    ├── AddRecipientForm.tsx       # Form to add new recipient
    ├── WithdrawalForm.tsx         # Form to request withdrawal
    └── PayoutHistory.tsx          # Display payout history
```

---

## How to Use

### 1. Add Navigation Link

In your main navigation component, add:

```typescript
<Link href="/withdrawals">Withdrawals</Link>
```

### 2. Test User Flow

**User Opens Withdrawal Page**:
1. Page loads and fetches balance
2. Shows wallet_balance and subagent_commission_balance (for agents)

**User Adds Recipient**:
1. Click "Add Recipient"
2. Choose Bank or Mobile Money
3. Fill in details
4. System creates in Paystack and saves to database

**User Requests Withdrawal**:
1. Select recipient
2. Choose withdrawal source (wallet or commission)
3. Enter amount
4. Click "Request Withdrawal"
5. Edge function processes request
6. Shows success or error

---

## Edge Function Integration

The edge function is already created and expects requests at:
```
https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request
```

**The function handles**:
- Validating user and balance
- Creating recipients in Paystack
- Deducting balance
- Initiating transfer
- Refunding on failure

---

## Key Features

✓ **Two Wallet Types**: wallet_balance and subagent_commission_balance (agents only)
✓ **Recipient Limit**: Max 2 active recipients per user
✓ **Bank & Mobile Money**: Supports both payment methods
✓ **Auto-Refund**: If transfer fails, wallet is refunded automatically
✓ **Payout History**: View all past withdrawal requests
✓ **Status Tracking**: pending → processing → success/failed

---

## API Response Codes

| Response | Meaning |
|----------|---------|
| `200 - success: true` | Withdrawal successful |
| `400 - success: false` | Validation error (insufficient balance, invalid amount, etc.) |
| `401` | Unauthorized (invalid token) |
| `404` | Recipient/store not found |
| `500` | Server error |

---

## Common Issues & Solutions

### "No recipients added yet"
**Cause**: User hasn't added a transfer recipient
**Solution**: User must add recipient in Recipients tab first

### "Insufficient balance. Available: GHS X"
**Cause**: Withdrawal amount exceeds available balance
**Solution**: Reduce withdrawal amount or wait for more earnings

### "Transfer failed. Your wallet has been refunded"
**Cause**: Paystack transfer failed (usually insufficient balance in Paystack master account)
**Solution**: Contact support; wallet is already refunded

### Maximum 2 recipients error
**Cause**: User already has 2 active recipients
**Solution**: Delete one recipient first

---

## Testing Checklist

- [ ] Agent can view both wallet_balance and subagent_commission_balance
- [ ] Subagent can only view wallet_balance
- [ ] Can add bank recipient successfully
- [ ] Can add mobile money recipient successfully
- [ ] Can delete/deactivate recipient
- [ ] Cannot add 3rd recipient (max 2 limit)
- [ ] Can request withdrawal with existing recipient
- [ ] Insufficient balance error shows correctly
- [ ] Successful withdrawal updates balance
- [ ] Failed withdrawal refunds wallet
- [ ] Payout history shows all transactions
- [ ] Can view transfer code and status

---

## Component Props Reference

### WithdrawalBalance
```typescript
<WithdrawalBalance
  userRole="agent" | "subagent"
  storeId="uuid"
  refreshKey={number}
/>
```

### RecipientManager
```typescript
<RecipientManager
  token="auth-token"
  onRefresh={() => {}}
  refreshKey={number}
/>
```

### WithdrawalForm
```typescript
<WithdrawalForm
  userRole="agent" | "subagent"
  storeId="uuid"
  token="auth-token"
  onSuccess={() => {}}
  refreshKey={number}
/>
```

### PayoutHistory
```typescript
<PayoutHistory
  userRole="agent" | "subagent"
  storeId="uuid"
  refreshKey={number}
/>
```

---

## Environment Variables

The system uses:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (public)
- `PAYSTACK_SECRET_KEY` - Paystack secret (backend only)

---

## Next Steps

1. ✓ Components created
2. ✓ Utility functions ready
3. ✓ Edge function URL provided
4. **Now**: Test with real data
5. **Then**: Deploy to production

---

## Support

For issues, check:
1. Supabase logs: `transfer_recipients` and `payout_requests` tables
2. Edge function logs: Look for `[CREATE-PAYOUT]` messages
3. Paystack dashboard: Verify recipient was created correctly

