-- Allow public storefronts to read the parent agent's configured subagent base prices.
-- These prices are intentionally customer-visible because they determine storefront pricing.
ALTER TABLE public.subagent_package_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public storefronts can read parent subagent prices"
ON public.subagent_package_prices;

CREATE POLICY "Public storefronts can read parent subagent prices"
ON public.subagent_package_prices
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subagent_stores s
    WHERE s.id = subagent_package_prices.subagent_store_id
      AND s.approved = true
      AND s.suspended IS NOT TRUE
  )
);

NOTIFY pgrst, 'reload schema';
