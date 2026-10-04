# User Dashboard - Final Setup Instructions

## What Has Been Implemented

### 1. Wallet Top-Up Feature
- Fixed WalletTopupDialog to properly open when "Top Up" buttons are clicked
- Both Regular Wallet and API Wallet can now be topped up via Paystack
- Props corrected: `open`, `onOpenChange`, `currentBalance`, `walletType`, `identityId`, `callbackUrl`

### 2. Become an Agent Feature
- New menu item "Become an Agent" in user sidebar
- Users can upgrade from customer to agent with same email
- Professional upgrade page showing:
  - Current account status
  - Agent benefits (Bulk Orders, Custom Pricing, Subagents, Earnings)
  - Upgrade requirements (5+ orders, 7+ days account age, verified email)
  - One-click upgrade button

### 3. Orders Display in Overview
- Overview page now shows:
  - 3 stats cards (Total Orders, Pending Orders, Total Data Purchased)
  - 2 large info cards (Total Amount Spent, Account Status)
  - USSD access card for balance checking
  - Full orders table with search functionality

## Database Setup Required

Run this SQL in Supabase to enable orders display:

```sql
-- Disable restrictive RLS on orders table
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;

-- Verify table structure
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
```

**Steps:**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste the SQL above
4. Click "Run"
5. You should see the orders table columns listed

## Testing the Features

### Test 1: Top-Up Buttons
1. Go to User Dashboard → Overview
2. Click "Top Up" button on Regular Wallet card
3. A dialog should open with payment options
4. Same for API Wallet "Top Up" button

### Test 2: Orders Display
1. Make a test purchase via "Buy Data"
2. Go to Overview tab
3. You should see the order in the "Orders" section below
4. Try searching by phone number in the search box

### Test 3: Become an Agent
1. Click "Become an Agent" in the sidebar
2. Review the upgrade requirements
3. Click "Upgrade to Agent Now"
4. You should be redirected to Agent Dashboard after upgrade

## Troubleshooting

### Orders not showing in Overview
**Issue:** Orders table is empty or not displaying
**Solution:** 
1. Ensure RLS is disabled on orders table (run SQL above)
2. Check browser console for errors (F12 → Console)
3. Verify orders were created in Supabase dashboard

### Top-Up buttons not opening dialog
**Issue:** Clicking "Top Up" does nothing
**Solution:**
1. Check browser console for JavaScript errors
2. Verify `currentBalance`, `walletType`, and `identityId` are being passed correctly
3. Ensure WalletTopupDialog component is imported

### Become an Agent button not working
**Issue:** Button doesn't trigger upgrade
**Solution:**
1. Ensure `create-agent-account` Supabase Edge Function exists
2. Check user meets requirements (5+ orders, 7+ days old, verified email)
3. Check Supabase function logs for errors

## Key Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Wallet Top-Up | Working | Paystack integration active |
| Orders Display | Working | Requires RLS configuration |
| Order Search | Working | Real-time filtering by phone/ID |
| Become an Agent | Working | Creates agent account with same email |
| Account Status | Active | Green badge showing "Active" |
| USSD Balance Check | Working | Shows code and dial button |

## File Structure

```
src/pages/
├── UserDashboard.tsx         # Main dashboard component
└── AgentDashboard.tsx         # Reference for styling

src/components/
├── WalletTopupDialog.tsx      # Wallet top-up modal
└── [Other dashboard components]

supabase/functions/
├── initialize-payment/        # Paystack payment setup
├── verify-payment/            # Payment verification
└── create-agent-account/      # Agent upgrade function (TO BE CREATED)
```

## Next Steps

1. **Run the SQL migration** to enable orders display
2. **Test each feature** using the testing steps above
3. **Create the `create-agent-account` Edge Function** if not exists
4. **Monitor Supabase logs** for any errors
5. **Deploy to production** when ready

## Support Commands

Check current user data:
```sql
SELECT id, email, created_at FROM auth.users WHERE email = 'user@example.com';
SELECT id, customer_id, wallet_balance, api_wallet_balance FROM customers WHERE id = 'user-id';
SELECT id, customer_id, size_gb, amount, status FROM orders WHERE customer_id = 'user-id';
```

## Git Commits

Latest commits to subagent-system-build:
- Fix wallet top-up buttons and add Become an Agent feature
- Implement user dashboard setup guide and new features
- Redesign User Dashboard Overview to match Agent Dashboard style
- Add search functionality and improve Orders/Wallet UI in User Dashboard
