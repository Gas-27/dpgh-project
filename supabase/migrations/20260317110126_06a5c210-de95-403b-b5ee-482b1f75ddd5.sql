
-- Fix permissive INSERT policy - restrict to approved stores only
DROP POLICY "Public can insert orders" ON public.orders;
CREATE POLICY "Public can insert orders for approved stores" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (agent_store_id IN (SELECT id FROM public.agent_stores WHERE approved = true));
