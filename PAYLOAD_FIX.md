# Paystack Withdrawal - Payload Fix

## Issue
The edge function was returning error: **"Missing required fields: requester_type, requester_id, amount"**

## Root Cause
The frontend was sending an incorrect payload structure:
```javascript
// WRONG - What we were sending
{
  agent_store_id: "...",      // ❌ Function expects requester_id
  withdrawal_source: "wallet",
  amount: 10,
  recipient_details: {...}    // ❌ Missing requester_type
}
```

The edge function expects:
```javascript
// CORRECT - What function needs
{
  requester_type: "agent",              // ✅ Required
  requester_id: "...",                  // ✅ Required
  amount: 10,                           // ✅ Required
  withdrawal_source: "wallet_balance",  // Optional but specific format
  recipient_id: "...",                  // Either this
  recipient_details: {...}              // Or this
}
```

## Changes Made

### AgentDashboard.tsx (Lines ~1168-1204)
```javascript
const payload: any = {
  requester_type: "agent",                    // ✅ Added
  requester_id: store.id,                     // ✅ Changed from agent_store_id
  amount: amt,                                // ✅ Kept
  withdrawal_source: withdrawSource === "subagent_commission" 
    ? "subagent_commission_balance"           // ✅ Fixed format
    : "wallet_balance",
};

// Added Authorization header with auth token
const authToken = localStorage.getItem('sb-auth-token') || '';
const response = await fetch(url, {
  headers: { 
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authToken}`    // ✅ Added auth
  },
  body: JSON.stringify(payload),
});
```

### SubagentDashboard.tsx (Lines ~1181-1214)
```javascript
const payload: any = {
  requester_type: "subagent",                 // ✅ Added
  requester_id: subagentStore.id,             // ✅ Changed from subagent_store_id
  amount,                                     // ✅ Kept
  withdrawal_source: "wallet_balance",        // ✅ Fixed format
};

// Added Authorization header
const authToken = localStorage.getItem('sb-auth-token') || '';
```

## Key Fixes

| Issue | Before | After |
|-------|--------|-------|
| Requester Type | Missing | `"agent"` or `"subagent"` |
| Requester ID | `agent_store_id` | `requester_id` |
| Withdrawal Source | `"wallet"` | `"wallet_balance"` or `"subagent_commission_balance"` |
| Authorization | None | Bearer token from localStorage |

## Testing
1. Go to Agent/Subagent Dashboard
2. Click "Request Paystack Transfer"
3. Create new recipient (bank or mobile money)
4. Enter amount and click Transfer
5. Should no longer see the "Missing required fields" error
6. Check Supabase `payout_requests` table for the request

## Files Modified
- `/src/pages/AgentDashboard.tsx`
- `/src/pages/SubagentDashboard.tsx`
