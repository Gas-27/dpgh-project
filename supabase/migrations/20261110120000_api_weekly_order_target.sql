-- Admin-controlled weekly target that only counts API orders (default 14,000).
ALTER TABLE public.weekly_order_target_settings
  ADD COLUMN IF NOT EXISTS api_weekly_order_target integer NOT NULL DEFAULT 14000;

ALTER TABLE public.weekly_order_target_settings
  DROP CONSTRAINT IF EXISTS weekly_order_target_settings_api_target_positive;
ALTER TABLE public.weekly_order_target_settings
  ADD CONSTRAINT weekly_order_target_settings_api_target_positive CHECK (api_weekly_order_target >= 1);

-- Speeds up the per-user weekly API order count.
CREATE INDEX IF NOT EXISTS orders_api_user_created_at_idx
  ON public.orders (api_user, created_at DESC)
  WHERE api_user IS NOT NULL;
