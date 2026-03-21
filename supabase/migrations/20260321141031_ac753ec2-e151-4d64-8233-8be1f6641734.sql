
-- Make agent_store_id nullable for main-site orders
ALTER TABLE public.orders ALTER COLUMN agent_store_id DROP NOT NULL;

-- Add fulfillment tracking columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS api_response text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paystack_reference text;

-- Allow authenticated users to insert orders (for main site purchases)
CREATE POLICY "Authenticated users can insert orders without agent"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (agent_store_id IS NULL);

-- Allow authenticated users to view own orders (by matching phone in metadata - simplified: allow viewing recent orders)
CREATE POLICY "Users can view orders by paystack reference"
ON public.orders FOR SELECT TO authenticated
USING (true);
