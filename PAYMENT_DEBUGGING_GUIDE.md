# Spin Wheel Payment (Paystack Integration) - Debugging Guide

## Error: 400 Bad Request

The 400 error means the Supabase Edge Function is rejecting the request. This can happen for several reasons:

### Root Causes & Solutions

#### 1. Missing Environment Variable
The function needs `PAYSTACK_SECRET_KEY` to work.

**Check if it's set:**
Go to Supabase Dashboard → Project Settings → Edge Functions → Environment Variables
Make sure `PAYSTACK_SECRET_KEY` is added with your Paystack secret key.

#### 2. Invalid Phone Number Format
The function expects a valid 10-digit phone number.

**Fix:**
- Phone must be exactly 10 digits (024XXXXXXXX format for Ghana)
- Make sure `isValidPhone()` function is working correctly
- The payment code now has validation: `if (!isValidPhone(phone))`

#### 3. Missing Payment Amount
Config might not have `payment_amount` set.

**Fix:**
- The spin wheel config must have `payment_amount` field
- This is set in Admin Dashboard → Settings → Spin Wheel Configuration
- Make sure amount is a valid number (e.g., 50 for GH₵ 50)

#### 4. Function Not Deployed
The Edge Function might not be deployed to Supabase.

**Deploy:**
```bash
supabase functions deploy initialize-payment
```

#### 5. Paystack API Key Invalid
Secret key might be wrong or expired.

**Fix:**
- Go to https://dashboard.paystack.com → Settings → API Keys
- Copy your Secret Key (not Public Key)
- Add to Supabase Environment Variables as `PAYSTACK_SECRET_KEY`

### Debugging Steps

#### Step 1: Check Browser Console
1. Open browser (F12) → Console tab
2. Click "Pay to Spin" button
3. Look for console logs:
   ```
   [v0] Payment payload: {...}
   [v0] Payment response: {...}
   ```

#### Step 2: Check Supabase Function Logs
1. Go to Supabase Dashboard
2. Click "Edge Functions" (left sidebar)
3. Click "initialize-payment"
4. View recent invocations and logs
5. Look for error messages

#### Step 3: Verify Request Parameters
The payment request should include:
```javascript
{
  amount: 50,                          // Must be a number
  email: "player_024XXXXXXXX@spin.dataplug.store",
  phone: "024XXXXXXXX",               // Must be 10 digits
  callback_url: "https://..../packages",
  metadata: { 
    type: "spin_wheel",
    phone: "024XXXXXXXX",
    network: "mtn"
  }
}
```

### Testing Payment Flow

#### Manual Test
1. Go to your site and login
2. Navigate to Spin Wheel
3. Enter valid phone: 0245123456
4. Click "Pay to Spin"
5. Check console for logs
6. Should redirect to Paystack payment page

#### If Stuck on Loading
- Open Developer Tools (F12)
- Check Network tab
- Look for POST request to `/functions/v1/initialize-payment`
- Check Status code and Response body

### Complete Checklist

- [ ] PAYSTACK_SECRET_KEY is set in Supabase
- [ ] Phone number format is correct (10 digits, starts with 0)
- [ ] Config has `payment_amount` set
- [ ] initialize-payment function is deployed
- [ ] No syntax errors in payment code
- [ ] Browser console shows debug logs
- [ ] Supabase function logs show no errors

### If Still Getting 400 Error

Run this test in Supabase Function console to debug:

```typescript
// Test the function parameters
const testParams = {
  amount: 50,
  email: "test@example.com",
  phone: "0245123456",
  callback_url: "https://example.com",
  metadata: { type: "spin_wheel", phone: "0245123456", network: "mtn" }
};

console.log("Test parameters:", testParams);
```

The issue is likely one of:
1. Phone validation failing
2. Missing amount
3. Invalid environment variable
4. Function not deployed

Contact Paystack Support if error persists after checking all above.
