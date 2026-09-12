ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS purchase_provider text,
  ADD COLUMN IF NOT EXISTS purchase_provider_source text;

COMMENT ON COLUMN public.orders.purchase_provider IS 'Provider selected and used at purchase time; immutable attribution for reporting.';
COMMENT ON COLUMN public.orders.purchase_provider_source IS 'Purchase routing source: api, wallet, paystack, or storefront.';

CREATE INDEX IF NOT EXISTS orders_purchase_provider_idx ON public.orders (purchase_provider);
