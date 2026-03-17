
-- Public can view approved agent stores (for storefront pages)
CREATE POLICY "Public can view approved stores"
ON public.agent_stores
FOR SELECT
TO anon, authenticated
USING (approved = true);

-- Agent package prices - agents set their own sell prices
CREATE TABLE public.agent_package_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id uuid NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  sell_price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(agent_store_id, package_id)
);

ALTER TABLE public.agent_package_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own prices" ON public.agent_package_prices
FOR SELECT TO authenticated
USING (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

CREATE POLICY "Agents can insert own prices" ON public.agent_package_prices
FOR INSERT TO authenticated
WITH CHECK (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

CREATE POLICY "Agents can update own prices" ON public.agent_package_prices
FOR UPDATE TO authenticated
USING (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

CREATE POLICY "Agents can delete own prices" ON public.agent_package_prices
FOR DELETE TO authenticated
USING (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

CREATE POLICY "Public can view agent prices" ON public.agent_package_prices
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage all prices" ON public.agent_package_prices
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id uuid NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.data_packages(id),
  customer_number text NOT NULL,
  network text NOT NULL,
  size_gb numeric NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own orders" ON public.orders
FOR SELECT TO authenticated
USING (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

CREATE POLICY "Agents can insert own orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

CREATE POLICY "Agents can update own orders" ON public.orders
FOR UPDATE TO authenticated
USING (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all orders" ON public.orders
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can insert orders" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (true);
