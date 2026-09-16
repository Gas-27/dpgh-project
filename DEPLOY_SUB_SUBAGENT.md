# Sub-Subagent Complete System - Deployment Guide

## System Overview

The sub-subagent system is a complete three-tier hierarchy:
1. **Admin** → manages everything
2. **Subagent (Agent)** → creates and manages sub-subagents
3. **Sub-Subagent** → the end-user resellers

## Database Schema

The `sub_subagent_stores` table includes:
- Core fields: `id`, `subagent_store_id`, `user_id`, `store_name`, `created_at`
- Contact info: `whatsapp_number`, `support_number`, `whatsapp_group`
- Payment methods: `momo_name`, `momo_number`, `momo_network`
- Wallet: `wallet_balance`, `buy_difference`
- Status: `approved`, `other_application`

## Complete Registration Flow

### Step 1: Sign Up (`/sub-subagent-register`)
1. User enters email, password, store name, contact info
2. Form validates all inputs
3. Creates Supabase auth user with role 'sub_subagent'
4. Inserts record in `sub_subagent_stores` with:
   - All contact information provided
   - `wallet_balance` = 0
   - `buy_difference` = 0
   - `approved` = true
5. System auto-signs user in
6. Redirects to dashboard with `store_id` in URL

### Step 2: Dashboard Load on Registration
1. Dashboard reads `store_id` from URL parameter
2. Queries `sub_subagent_stores` with that ID
3. Displays complete store information
4. User immediately sees their dashboard

### Step 3: Login (`/sub-subagent-login`)
1. User enters email + password
2. System verifies user has 'sub_subagent' role
3. Redirects to `/sub-subagent-dashboard`
4. Dashboard queries store by `user_id` (not from URL)
5. Shows same store data as after registration

## RLS Policy Requirements

The system requires these RLS policies on `sub_subagent_stores`:

```sql
-- Users can read their own stores
CREATE POLICY "Users can read their own sub-subagent stores"
  ON sub_subagent_stores FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own stores
CREATE POLICY "Users can update their own sub-subagent stores"
  ON sub_subagent_stores FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage all stores (for admin)
CREATE POLICY "Service role can manage all sub-subagent stores"
  ON sub_subagent_stores FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

## Code Components

### Registration Form (`SubSubagentRegistrationForm.tsx`)
- Collects: email, password, store name, WhatsApp, support number, MoMo details
- Creates user + store in one flow
- Auto-redirects to dashboard on success

### Login Page (`SubSubagentLogin.tsx`)
- Verifies email + password
- Checks for 'sub_subagent' role
- Redirects to dashboard

### Dashboard (`SubSubagentDashboard.tsx`)
- Loads via URL `store_id` parameter (post-registration)
- Or loads via `user_id` from auth (post-login)
- Displays: store info, contact details, payment methods, wallet
- Shows recent orders and transactions

## Testing Checklist

- [ ] Complete signup flow from `/sub-subagent-register`
  - [ ] Enters all required fields
  - [ ] Receives no validation errors
  - [ ] Sees dashboard immediately after signup
  - [ ] All store data displays correctly

- [ ] Logout and login from `/sub-subagent-login`
  - [ ] Login succeeds with correct credentials
  - [ ] Redirects to dashboard
  - [ ] Shows same store data as after signup
  - [ ] No 404 or database errors

- [ ] Admin can view sub-subagent dashboard
  - [ ] Admin can use impersonation URL with `store_id`
  - [ ] Sees correct sub-subagent's data
  - [ ] Cannot see data from other sub-subagents

- [ ] No errors in browser console
  - [ ] No 404 errors
  - [ ] No RLS policy violations
  - [ ] No "cannot read property" errors

## Build Status

✅ **Build successful** - All TypeScript types correct, all imports valid, zero compilation errors

## Go-Live Instructions

1. Verify RLS policies are in place on Supabase
2. Run smoke tests above
3. Sub-subagents can now register and use the system
4. No additional configuration needed
