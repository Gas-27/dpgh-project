-- Add 'subagent' role to app_role enum
ALTER TYPE public.app_role ADD VALUE 'subagent';

-- Add allow_subagent_registration column to agent_stores
ALTER TABLE public.agent_stores ADD COLUMN allow_subagent_registration boolean DEFAULT false;

-- Subagent stores table
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
  approved boolean DEFAULT true,
  allow_registration boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.subagent_stores ENABLE ROW LEVEL SECURITY;

-- Subagent package prices table (for pricing hierarchy)
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

-- Modify orders table to support subagents
ALTER TABLE public.orders ADD COLUMN subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE SET NULL;

-- Modify wallet_topups table to support subagents
ALTER TABLE public.wallet_topups ADD COLUMN subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE CASCADE;

-- Modify withdrawal_requests table to support subagents
ALTER TABLE public.withdrawal_requests ADD COLUMN subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE CASCADE;

-- RLS Policies for subagent_stores

-- Subagents can view their own store
CREATE POLICY "Subagents can view own store" ON public.subagent_stores
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Subagents can create their own store (if agent allows registration)
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

-- Subagents can update their own store
CREATE POLICY "Subagents can update own store" ON public.subagent_stores
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Agents can view their subagents' stores
CREATE POLICY "Agents can view subagents" ON public.subagent_stores
  FOR SELECT TO authenticated
  USING (
    agent_store_id IN (
      SELECT id FROM public.agent_stores WHERE user_id = auth.uid()
    )
  );

-- Agents can update their subagents' stores
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

-- Admins can update all subagent stores
CREATE POLICY "Admins can manage all subagent stores" ON public.subagent_stores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subagent_package_prices

-- Subagents can view their own pricing
CREATE POLICY "Subagents can view own prices" ON public.subagent_package_prices
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Subagents can create pricing for their packages
CREATE POLICY "Subagents can create prices" ON public.subagent_package_prices
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Subagents can update their pricing
CREATE POLICY "Subagents can update prices" ON public.subagent_package_prices
  FOR UPDATE TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Agents can view their subagents' pricing
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

-- Admins can view and manage all pricing
CREATE POLICY "Admins can view all subagent prices" ON public.subagent_package_prices
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all subagent prices" ON public.subagent_package_prices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated RLS Policies for orders (add subagent support)
CREATE POLICY "Subagents can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Subagents can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Updated RLS Policies for wallet_topups (add subagent support)
CREATE POLICY "Subagents can view own topups" ON public.wallet_topups
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Subagents can receive topups" ON public.wallet_topups
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Updated RLS Policies for withdrawal_requests (add subagent support)
CREATE POLICY "Subagents can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Subagents can request withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    subagent_store_id IN (
      SELECT id FROM public.subagent_stores WHERE user_id = auth.uid()
    )
  );

-- Trigger to add subagent role on signup if specified
CREATE OR REPLACE FUNCTION public.assign_subagent_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'role' = 'subagent') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'subagent'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subagent_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'role' = 'subagent')
  EXECUTE FUNCTION public.assign_subagent_role();

-- Index for performance optimization
CREATE INDEX idx_subagent_stores_agent_store_id ON public.subagent_stores(agent_store_id);
CREATE INDEX idx_subagent_stores_user_id ON public.subagent_stores(user_id);
CREATE INDEX idx_subagent_package_prices_subagent_store_id ON public.subagent_package_prices(subagent_store_id);
CREATE INDEX idx_orders_subagent_store_id ON public.orders(subagent_store_id);
CREATE INDEX idx_wallet_topups_subagent_store_id ON public.wallet_topups(subagent_store_id);
CREATE INDEX idx_withdrawal_requests_subagent_store_id ON public.withdrawal_requests(subagent_store_id);
