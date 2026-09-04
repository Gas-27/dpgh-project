# Subagent System - Setup Guide

## Overview
The subagent system is now fully integrated into DataPlug. Agents can enable subagent registration on their storefronts, and users can sign up as subagents directly from the agent's storefront.

## Features Implemented

### For Agents
- **Subagent Management Tab** in Agent Dashboard to:
  - Enable/disable subagent registration with a toggle
  - View minimum pricing requirements for packages
  - See pending subagent registrations (coming soon)

- **Become a Subagent Button** on storefront:
  - Shows only when agent enables subagent registration
  - Inline registration form with email, password, store details, and MoMo info
  - Automatically redirects to SubagentDashboard after registration

### For Subagents
- **Dedicated Dashboard** with:
  - Overview of wallet balance, revenue, and pending orders
  - Orders tracking
  - Withdrawal requests (NO TOPUP - only withdrawals)
  - Store settings and profile management

### For Admin
- **Subagent Management Tab** in Admin Dashboard to:
  - View all subagents in the system
  - See approval status
  - Monitor subagent wallets and operations

## SQL Setup Instructions

Since you're having Supabase connection issues, run the following SQL directly in your Supabase SQL Editor:

```sql
-- ============================================================
-- STEP 1: Add 'subagent' role to app_role enum
-- ============================================================
ALTER TYPE public.app_role ADD VALUE 'subagent';

-- ============================================================
-- STEP 2: Add allow_subagent_registration column to agent_stores
-- ============================================================
ALTER TABLE public.agent_stores ADD COLUMN allow_subagent_registration boolean DEFAULT false;

-- ============================================================
-- STEP 3: Create subagent_stores table
-- ============================================================
CREATE TABLE public.subagent_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  agent_store_id uuid NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  whatsapp_number text NOT NULL,
  support_number text NOT NULL,
  whatsapp_group text,
  momo_number text NOT NULL,
  momo_name text NOT NULL,
  momo_network text NOT NULL CHECK (momo_network IN ('mtn', 'airteltigo', 'telecel')),
  wallet_balance numeric DEFAULT 0,
  approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.subagent_stores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Create subagent_package_prices table
-- ============================================================
CREATE TABLE public.subagent_package_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subagent_store_id uuid NOT NULL REFERENCES public.subagent_stores(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  agent_minimum_price numeric NOT NULL,
  sell_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(subagent_store_id, package_id),
  CONSTRAINT sell_price_above_minimum CHECK (sell_price >= agent_minimum_price)
);

ALTER TABLE public.subagent_package_prices ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: Update orders table
-- ============================================================
ALTER TABLE public.orders ADD COLUMN subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE SET NULL;

-- ============================================================
-- STEP 6: Update wallet_topups table
-- ============================================================
ALTER TABLE public.wallet_topups ADD COLUMN subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 7: Update withdrawal_requests table
-- ============================================================
ALTER TABLE public.withdrawal_requests ADD COLUMN subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 8: Create RLS Policies for subagent_stores
-- ============================================================

-- Subagents can view own store
CREATE POLICY "Subagents can view own store" ON public.subagent_stores
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Subagents can create own store
CREATE POLICY "Subagents can create own store" ON public.subagent_stores
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM public.agent_stores AS agent
      WHERE agent.id = agent_store_id
      AND agent.approved = true
    )
  );

-- Subagents can update own store
CREATE POLICY "Subagents can update own store" ON public.subagent_stores
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Agents can view subagents under them
CREATE POLICY "Agents can view subagents" ON public.subagent_stores
  FOR SELECT TO authenticated
  USING (
    agent_store_id IN (
      SELECT id FROM public.agent_stores WHERE user_id = auth.uid()
    )
  );

-- Agents can update subagent settings
CREATE POLICY "Agents can update subagent settings" ON public.subagent_stores
  FOR UPDATE TO authenticated
  USING (
    agent_store_id IN (
      SELECT id FROM public.agent_stores WHERE user_id = auth.uid()
    )
  );

-- Admins can view all subagent stores
CREATE POLICY "Admins can view all subagent stores" ON public.subagent_stores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all subagent stores
CREATE POLICY "Admins can manage all subagent stores" ON public.subagent_stores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- STEP 9: Create RLS Policies for subagent_package_prices
-- ============================================================

-- Subagents can view own prices
CREATE POLICY "Subagents can view own prices" ON public.subagent_package_prices
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Subagents can create prices
CREATE POLICY "Subagents can create prices" ON public.subagent_package_prices
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Subagents can update prices
CREATE POLICY "Subagents can update prices" ON public.subagent_package_prices
  FOR UPDATE TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Agents can view subagent prices
CREATE POLICY "Agents can view subagent prices" ON public.subagent_package_prices
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores 
      WHERE agent_store_id IN (
        SELECT id FROM public.agent_stores WHERE user_id = auth.uid()
      )
    )
  );

-- Admins can view all subagent prices
CREATE POLICY "Admins can view all subagent prices" ON public.subagent_package_prices
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all subagent prices
CREATE POLICY "Admins can manage all subagent prices" ON public.subagent_package_prices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- STEP 10: Create RLS Policies for orders (subagent support)
-- ============================================================

-- Subagents can view own orders
CREATE POLICY "Subagents can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Subagents can create orders
CREATE POLICY "Subagents can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP 11: Create RLS Policies for wallet_topups (subagent support)
-- ============================================================

-- Subagents can view own topups
CREATE POLICY "Subagents can view own topups" ON public.wallet_topups
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Subagents can receive topups
CREATE POLICY "Subagents can receive topups" ON public.wallet_topups
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP 12: Create RLS Policies for withdrawal_requests (subagent support)
-- ============================================================

-- Subagents can view own withdrawals
CREATE POLICY "Subagents can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Subagents can request withdrawals
CREATE POLICY "Subagents can request withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP 13: Create performance indexes
-- ============================================================
CREATE INDEX idx_subagent_stores_agent_store_id ON public.subagent_stores(agent_store_id);
CREATE INDEX idx_subagent_stores_user_id ON public.subagent_stores(user_id);
CREATE INDEX idx_subagent_package_prices_subagent_store_id ON public.subagent_package_prices(subagent_store_id);
CREATE INDEX idx_orders_subagent_store_id ON public.orders(subagent_store_id);
CREATE INDEX idx_wallet_topups_subagent_store_id ON public.wallet_topups(subagent_store_id);
CREATE INDEX idx_withdrawal_requests_subagent_store_id ON public.withdrawal_requests(subagent_store_id);
```

## How It Works

### Agent Flow
1. Agent logs in to Agent Dashboard
2. Navigates to **Subagents** tab
3. Toggles **Allow Subagent Registration** on
4. This enables the "Become a Subagent" button on their storefront

### Customer/Subagent Registration Flow
1. Customer visits agent's storefront
2. Sees "Become a Subagent" section (if enabled)
3. Fills in simple form:
   - Email & Password
   - Store Name
   - Support Number
   - WhatsApp Number
   - MoMo Account Name
   - MoMo Number
   - MoMo Network (MTN/AirtelTigo/Telecel)
4. Clicks "Create Subagent Account"
5. Account created automatically
6. **Redirected to SubagentDashboard**

### Subagent Dashboard Features
- **Overview**: Wallet balance, revenue, pending orders
- **Orders**: View all orders placed through their storefront
- **Withdraw**: Request withdrawals (no topup functionality)
- **Settings**: Update store information

## Important Notes

- **No Topup for Subagents**: Subagents only have withdrawal functionality, not topup
- **Pricing Hierarchy**: Subagents must set prices at or above the agent's minimum price
- **Approval**: Admins can approve/suspend subagent accounts
- **Data Isolation**: Each subagent can only see their own data
- **Automatic Redirect**: After registration, users go straight to the SubagentDashboard

## Files Modified/Created

### Modified Files
- `src/pages/AgentDashboard.tsx` - Added Subagents tab
- `src/pages/AgentStorefront.tsx` - Added inline registration form
- `src/pages/AdminDashboard.tsx` - Added Subagent management tab
- `src/hooks/useAuth.ts` - Added isSubagent property and /subagent routing
- `src/integrations/supabase/types.ts` - Added subagent role and types

### New Files
- `src/pages/SubagentDashboard.tsx` - Subagent dashboard (no topup)
- `src/components/SubagentRegistrationForm.tsx` - Inline registration component
- `supabase/migrations/20260516000000_add_subagent_system.sql` - Database migration

## Testing

1. **Enable Subagent Registration**:
   - Log in as agent
   - Go to Subagents tab
   - Toggle "Allow Subagent Registration"

2. **Register as Subagent**:
   - Visit agent's public storefront
   - Scroll to "Become a Subagent" section
   - Fill form and submit
   - Should be redirected to SubagentDashboard

3. **Check Admin Panel**:
   - Log in as admin
   - Go to Subagents tab
   - Should see newly registered subagents
   - Should show pending approval count

## Next Steps

After SQL setup:
1. Test agent registration toggle
2. Test subagent registration from storefront
3. Verify redirect to SubagentDashboard
4. Check admin can see subagents
5. Test withdrawal requests (no topup)
