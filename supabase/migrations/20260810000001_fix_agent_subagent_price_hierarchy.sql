-- Canonical storage for the price an agent sets as a subagent's base price.
ALTER TABLE public.subagent_package_prices
  ADD COLUMN IF NOT EXISTS agent_store_id UUID REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2);

-- The legacy child-store columns must not block agent price rows.
ALTER TABLE public.subagent_package_prices
  ALTER COLUMN subagent_store_id DROP NOT NULL,
  ALTER COLUMN agent_minimum_price DROP NOT NULL,
  ALTER COLUMN sell_price DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_subagent_base_price
ON public.subagent_package_prices (agent_store_id, package_id)
WHERE agent_store_id IS NOT NULL;

-- Populate canonical agent rows from any legacy rows that were saved against a subagent.
UPDATE public.subagent_package_prices p
SET agent_store_id = s.agent_store_id,
    base_price = COALESCE(p.base_price, p.agent_minimum_price, p.sell_price)
FROM public.subagent_stores s
WHERE p.subagent_store_id = s.id
  AND p.agent_store_id IS NULL;

ALTER TABLE public.subagent_package_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public storefronts can read parent subagent prices" ON public.subagent_package_prices;
CREATE POLICY "Public storefronts can read parent subagent prices"
ON public.subagent_package_prices
FOR SELECT TO anon, authenticated
USING (agent_store_id IS NOT NULL);

GRANT SELECT ON public.subagent_package_prices TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
