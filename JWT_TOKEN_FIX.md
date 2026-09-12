# JWT Token Authentication Fix

## Problem
The withdrawal requests were failing with this error:
```
[CREATE-PAYOUT] Auth error: invalid JWT: unable to parse or verify signature, token is malformed: token contains an invalid number of segments
```

This happened because we were retrieving the token from localStorage, which:
- Either didn't exist
- Contained an invalid/malformed token format
- Was not a valid Supabase JWT

## Solution
Updated both `AgentDashboard.tsx` and `SubagentDashboard.tsx` to retrieve the authentication token directly from the Supabase session instead of localStorage.

## Changes Made

### Before:
```typescript
const authToken = localStorage.getItem('sb-auth-token') || '';
const response = await fetch(url, {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authToken}`
  },
  body: JSON.stringify(payload),
});
```

### After:
```typescript
// Get valid Supabase session token
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session?.access_token) {
  throw new Error("Authentication failed. Please log in again.");
}

const response = await fetch(url, {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.access_token}`
  },
  body: JSON.stringify(payload),
});
```

## Files Updated
1. **AgentDashboard.tsx** - Updated handleWithdraw() function
2. **SubagentDashboard.tsx** - Updated handleRequestWithdrawal() function

## Why This Works
- `supabase.auth.getSession()` retrieves the currently authenticated user's valid Supabase JWT token
- The JWT is guaranteed to be in the correct format with valid segments
- The token is automatically refreshed by Supabase when needed
- Error handling catches authentication failures and prompts re-login

## Testing
Try making a withdrawal and confirm:
1. Form submission completes successfully
2. No JWT token errors in console
3. Payout request is created in the database
4. User receives success notification with transfer details

## Build Status
✓ Build successful - no compilation errors
