# Wallet Top-up Implementation

## Overview

Wallet top-up functionality has been implemented to allow users and agents to add funds to their wallets using Paystack for payment processing. The implementation is clean, reusable, and integrated into both User and Agent dashboards.

## Architecture

### New Files Created

1. **`/src/lib/walletTopup.ts`**
   - Utility functions for wallet top-up operations
   - `initializeWalletTopup()` - Calls Supabase Edge Function to initialize Paystack payment
   - `redirectToPaystack()` - Redirects user to Paystack authorization URL
   - Handles request/response types for payment initialization

2. **`/src/components/WalletTopupDialog.tsx`**
   - Reusable dialog component for wallet top-up flows
   - Displays current wallet balance
   - Input field for custom amounts
   - Quick-action buttons for preset amounts (₵50, ₵100, ₵200, ₵500)
   - Fee breakdown display before redirect to Paystack
   - Handles loading states and error cases

### Modified Files

1. **`/src/pages/UserDashboard.tsx`**
   - Added `WalletTopupDialog` import
   - Added state: `showApiWalletTopup`, `showNormalWalletTopup`
   - Replaced old `handleTopUp()` function with simpler dialog openers
   - Simplified API wallet top-up UI to single button
   - Simplified normal wallet top-up UI to single button
   - Added two WalletTopupDialog instances at end of component:
     - One for API wallet (passes `apiKey`)
     - One for normal wallet (passes `identityId`)

2. **`/src/pages/AgentDashboard.tsx`**
   - Added `WalletTopupDialog` import
   - Replaced old topup dialog (with TODO comment) with new `WalletTopupDialog` component
   - Passes `apiKey` and `identityId` (storeId) to dialog
   - Set callback URL to agent dashboard

3. **`/src/utils/storeUtils.ts`**
   - Removed debug `console.log` statements from `findStoreByName()`
   - Cleaned up for production use

## User Flow

### User Dashboard

1. **API Wallet Tab**
   - User clicks "Add Funds" button
   - `WalletTopupDialog` opens with current API wallet balance
   - User enters amount or clicks quick-action button (₵50, ₵100, ₵200, ₵500)
   - Component calls `initializeWalletTopup()` with:
     - `apiKey` (user's API key)
     - `amount` (top-up amount)
     - `callback_url` pointing back to dashboard API tab
   - Paystack processing fee is shown
   - User is redirected to Paystack payment page
   - After payment, webhook updates `api_users.wallet`
   - User returns to dashboard

2. **Top Up Tab (Normal Wallet)**
   - User clicks "Add Funds" button
   - `WalletTopupDialog` opens with current normal wallet balance
   - User enters amount or clicks quick-action button
   - Component calls `initializeWalletTopup()` with:
     - `identity_id` (user's ID)
     - `amount` (top-up amount)
     - `callback_url` pointing back to dashboard top-up tab
   - Same payment flow as above
   - After payment, webhook updates `user_wallets.balance`

### Agent Dashboard

1. **API Key Tab**
   - Agent clicks "Top Up" button (which sets `showTopupDialog = true`)
   - `WalletTopupDialog` opens with current API wallet balance
   - Agent enters amount or clicks quick-action button
   - Component calls `initializeWalletTopup()` with:
     - `api_key` (agent's API key)
     - `amount` (top-up amount)
     - `callback_url` pointing back to dashboard API Key tab
   - Same payment flow as users
   - After payment, webhook updates `api_users.wallet`

## Technical Details

### API Endpoint

- **URL**: `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/initialize-wallet-topup`
- **Method**: POST
- **Headers**: `Content-Type: application/json`

### Request Payload

```json
{
  "api_key": "pk_live_...",      // Either api_key OR
  "identity_id": "uuid",          // identity_id is required
  "amount": 100.00,
  "callback_url": "https://app.com/dashboard"
}
```

### Response Payload

```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "authorization_url": "https://paystack.com/pay/xxx",
    "reference": "WALLET_1234567890_abc123",
    "amount": 101.98,
    "base_amount": 100.00,
    "fee_amount": 1.98
  }
}
```

### Error Handling

- Network errors display user-friendly toasts
- Missing required fields (api_key or identity_id) prevent submission
- Invalid amounts (≤ 0) prevent submission
- Loading state prevents duplicate submissions

## Key Features

1. **Reusable Component** - `WalletTopupDialog` can be used in any dashboard or page
2. **Flexible Identification** - Works with either `api_key` or `identity_id`
3. **Quick Actions** - Pre-set amounts (₵50, ₵100, ₵200, ₵500) for faster checkout
4. **Fee Transparency** - Shows processing fee breakdown before redirecting to Paystack
5. **Loading States** - Prevents user interactions during payment initialization
6. **Error Handling** - Validates input and shows errors gracefully
7. **Webhook Integration** - No need to handle webhook in frontend (backend handles it)

## Testing

To test locally:

1. Open User Dashboard → API Tab → Click "Add Funds"
2. Or Open Agent Dashboard → API Key Tab → Click "Top Up"
3. Enter an amount (₵100 or use quick-action buttons)
4. Should be redirected to Paystack test environment
5. After payment confirmation, callback URL will be visited

## Future Enhancements

- Add transaction history display
- Add wallet balance polling/refresh after callback
- Add success/failure page redirects
- Add retry logic for failed payments
