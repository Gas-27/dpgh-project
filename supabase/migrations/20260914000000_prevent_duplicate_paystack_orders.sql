CREATE UNIQUE INDEX IF NOT EXISTS orders_paystack_reference_unique
  ON public.orders (paystack_reference)
  WHERE paystack_reference IS NOT NULL;
