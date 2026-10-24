-- 1. Social Boost order numbers: always the short sequential site-wide number.
-- Older deployed webhook versions derive a long number from the Paystack reference; override it.
CREATE OR REPLACE FUNCTION public.enforce_short_social_boost_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number > 999999 THEN
    NEW.order_number := nextval('public.social_boost_order_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_boost_short_order_number ON public.social_boost_orders;
CREATE TRIGGER social_boost_short_order_number
  BEFORE INSERT ON public.social_boost_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_short_social_boost_order_number();

-- Re-number existing long order numbers into the nearest unused short number.
DO $$
DECLARE
  r record;
  v_prev bigint;
  v_new bigint;
BEGIN
  FOR r IN SELECT id, created_at FROM public.social_boost_orders WHERE order_number > 999999 ORDER BY created_at LOOP
    SELECT coalesce(max(order_number), 0) INTO v_prev
      FROM public.social_boost_orders
      WHERE order_number <= 999999 AND created_at < r.created_at;

    SELECT g INTO v_new
      FROM generate_series(v_prev + 1, v_prev + 50) g
      WHERE NOT EXISTS (SELECT 1 FROM public.social_boost_orders o WHERE o.order_number = g)
      ORDER BY g LIMIT 1;

    IF v_new IS NULL THEN
      v_new := nextval('public.social_boost_order_number_seq');
    END IF;

    UPDATE public.social_boost_orders SET order_number = v_new WHERE id = r.id;
  END LOOP;
END;
$$;

-- 2. Store owners can read the Social Boost orders placed through their storefronts.
CREATE OR REPLACE FUNCTION public.user_owns_social_boost_store(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_store_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.agent_stores s WHERE s.id = p_store_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.subagent_stores s WHERE s.id = p_store_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.sub_subagent_stores s WHERE s.id = p_store_id AND s.user_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_social_boost_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_social_boost_store(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS social_boost_orders_store_owner_read ON public.social_boost_orders;
CREATE POLICY social_boost_orders_store_owner_read ON public.social_boost_orders
  FOR SELECT TO authenticated
  USING (
    public.user_owns_social_boost_store(seller_store_id)
    OR public.user_owns_social_boost_store(owner_store_id)
  );

-- 3. Persist live provider data (status, start count, remains) for orders the caller may see.
CREATE OR REPLACE FUNCTION public.update_social_boost_order_status(
  p_provider_order_id text,
  p_status text,
  p_start_count bigint,
  p_remains bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.social_boost_orders;
BEGIN
  IF auth.uid() IS NULL OR nullif(trim(coalesce(p_status, '')), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_order FROM public.social_boost_orders WHERE provider_order_id = p_provider_order_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT (
    v_order.user_id = auth.uid()
    OR public.user_owns_social_boost_store(v_order.seller_store_id)
    OR public.user_owns_social_boost_store(v_order.owner_store_id)
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.social_boost_orders
  SET provider_status = p_status,
      start_count = p_start_count,
      remains = p_remains
  WHERE id = v_order.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_social_boost_order_status(text, text, bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_social_boost_order_status(text, text, bigint, bigint) TO authenticated, service_role;

-- 4. Commission on completed dashboard wallet purchases, credited straight to the buyer's wallet.
CREATE TABLE IF NOT EXISTS public.purchase_commission_credits (
  history_id uuid PRIMARY KEY REFERENCES public.korba_transaction_history(id) ON DELETE CASCADE,
  wallet_owner_type text NOT NULL,
  wallet_owner_id uuid NOT NULL,
  product_type text NOT NULL,
  purchase_amount numeric NOT NULL,
  commission_rate numeric NOT NULL,
  commission_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_commission_credits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.purchase_commission_rate(p_product text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE regexp_replace(lower(coalesce(p_product, '')), '[\s_-]+', '', 'g')
    WHEN 'data' THEN 0.013
    WHEN 'airtime' THEN 0.013
    WHEN 'gotv' THEN 0.0023
    WHEN 'dstv' THEN 0.0023
    WHEN 'startimes' THEN 0.0015
    WHEN 'startime' THEN 0.0015
    WHEN 'ecg' THEN 0.005
    WHEN 'electricity' THEN 0.005
    WHEN 'water' THEN 0.0024
    WHEN 'ghanawater' THEN 0.0024
    WHEN 'gwcl' THEN 0.0024
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.credit_purchase_commission(p_history_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h public.korba_transaction_history;
  v_rate numeric;
  v_commission numeric;
  v_kind text;
BEGIN
  SELECT * INTO h FROM public.korba_transaction_history WHERE id = p_history_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF lower(replace(coalesce(h.status, ''), '_', '')) <> 'completed' THEN RETURN false; END IF;
  IF coalesce(h.source, 'dashboard') <> 'dashboard' THEN RETURN false; END IF;

  v_rate := public.purchase_commission_rate(h.product_type);
  v_commission := round(coalesce(h.amount, 0) * v_rate, 4);
  IF v_rate <= 0 OR v_commission <= 0 THEN RETURN false; END IF;

  INSERT INTO public.purchase_commission_credits (history_id, wallet_owner_type, wallet_owner_id, product_type, purchase_amount, commission_rate, commission_amount)
  VALUES (h.id, h.wallet_owner_type, h.wallet_owner_id, h.product_type, h.amount, v_rate, v_commission)
  ON CONFLICT (history_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  v_kind := lower(replace(h.wallet_owner_type, '_', ''));
  IF v_kind = 'agent' THEN
    UPDATE public.agent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_commission WHERE id = h.wallet_owner_id;
  ELSIF v_kind = 'subagent' THEN
    UPDATE public.subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_commission WHERE id = h.wallet_owner_id;
  ELSIF v_kind = 'subsubagent' THEN
    UPDATE public.sub_subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_commission WHERE id = h.wallet_owner_id;
  ELSIF v_kind = 'customer' THEN
    UPDATE public.customers SET wallet_balance = coalesce(wallet_balance, 0) + v_commission WHERE id = h.wallet_owner_id OR user_id = h.wallet_owner_id;
  END IF;

  IF NOT FOUND THEN
    DELETE FROM public.purchase_commission_credits WHERE history_id = h.id;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_purchase_commission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_purchase_commission(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_credit_purchase_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.credit_purchase_commission(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Commission credit failed for purchase %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS korba_credit_purchase_commission ON public.korba_transaction_history;
CREATE TRIGGER korba_credit_purchase_commission
  AFTER INSERT OR UPDATE OF status ON public.korba_transaction_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_purchase_commission();

-- Credit purchases that were already completed (each is credited once only).
SELECT public.credit_purchase_commission(id)
FROM public.korba_transaction_history
WHERE lower(replace(coalesce(status, ''), '_', '')) = 'completed';
