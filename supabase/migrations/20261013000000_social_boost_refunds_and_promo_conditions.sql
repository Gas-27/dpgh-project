-- =====================================================================
-- 1. Social Boost: refund cancelled orders
-- =====================================================================
ALTER TABLE public.social_boost_orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS refund_destination text;

CREATE OR REPLACE FUNCTION public.refund_cancelled_social_boost_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.social_boost_orders;
  v_paid numeric;
  v_refund numeric;
  v_kind text;
  v_destination text;
  v_rows integer := 0;
BEGIN
  SELECT * INTO o FROM public.social_boost_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.refunded_at IS NOT NULL THEN RETURN false; END IF;
  IF lower(coalesce(o.provider_status, '')) NOT IN ('canceled', 'cancelled') THEN RETURN false; END IF;

  v_paid := coalesce(o.selling_amount, o.amount, 0);

  IF o.payment_reference IS NOT NULL AND o.seller_store_id IS NOT NULL THEN
    -- Storefront (Paystack) purchase: the money goes to the store owner's wallet.
    -- The store owner already received the profit when the order was placed,
    -- so only the remaining part (the base cost) is returned.
    v_destination := 'store_owner_wallet';
    v_refund := greatest(v_paid - CASE WHEN o.profit_credited_at IS NOT NULL THEN coalesce(o.profit_amount, 0) ELSE 0 END, 0);
    v_kind := lower(replace(coalesce(o.seller_store_kind, ''), '_', ''));
    IF v_refund > 0 THEN
      IF v_kind = 'agent' THEN
        UPDATE public.agent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_refund WHERE id = o.seller_store_id;
      ELSIF v_kind = 'subagent' THEN
        UPDATE public.subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_refund WHERE id = o.seller_store_id;
      ELSIF v_kind = 'subsubagent' THEN
        UPDATE public.sub_subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_refund WHERE id = o.seller_store_id;
      END IF;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    END IF;
  ELSIF lower(coalesce(o.owner_type, '')) = 'api' THEN
    v_destination := 'api_wallet';
    v_refund := v_paid;
    IF v_refund > 0 THEN
      UPDATE public.api_users SET api_wallet = coalesce(api_wallet, 0) + v_refund, api_wallet_updated_at = now()
      WHERE identity_id = o.user_id OR id = o.user_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    END IF;
  ELSE
    -- Dashboard wallet purchase: refund straight back to the buyer's wallet.
    v_destination := 'wallet';
    v_refund := v_paid;
    v_kind := lower(replace(coalesce(o.owner_type, ''), '_', ''));
    IF v_refund > 0 THEN
      IF v_kind = 'agent' AND o.owner_store_id IS NOT NULL THEN
        UPDATE public.agent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_refund WHERE id = o.owner_store_id;
      ELSIF v_kind = 'subagent' AND o.owner_store_id IS NOT NULL THEN
        UPDATE public.subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_refund WHERE id = o.owner_store_id;
      ELSIF v_kind = 'subsubagent' AND o.owner_store_id IS NOT NULL THEN
        UPDATE public.sub_subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_refund WHERE id = o.owner_store_id;
      ELSE
        UPDATE public.customers SET wallet_balance = coalesce(wallet_balance, 0) + v_refund WHERE user_id = o.user_id;
      END IF;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    END IF;
  END IF;

  IF v_refund > 0 AND v_rows = 0 THEN
    RAISE EXCEPTION 'Wallet for Social Boost order % not found', o.order_number;
  END IF;

  UPDATE public.social_boost_orders
  SET refunded_at = now(), refund_amount = v_refund, refund_destination = v_destination
  WHERE id = o.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_cancelled_social_boost_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_cancelled_social_boost_order(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_refund_cancelled_social_boost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.refund_cancelled_social_boost_order(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Social Boost refund failed for order %: %', NEW.order_number, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_boost_refund_cancelled ON public.social_boost_orders;
CREATE TRIGGER social_boost_refund_cancelled
  AFTER INSERT OR UPDATE OF provider_status ON public.social_boost_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_refund_cancelled_social_boost();

-- Tracking now also returns refund details and the storefront owner's contact.
DROP FUNCTION IF EXISTS public.get_public_social_boost_order(text);
CREATE FUNCTION public.get_public_social_boost_order(p_order_number text)
RETURNS TABLE(
  order_number bigint,
  created_at timestamptz,
  target_link text,
  quantity integer,
  service text,
  provider_order_id text,
  provider_status text,
  start_count integer,
  remains integer,
  refunded_at timestamptz,
  refund_amount numeric,
  refund_destination text,
  is_storefront_order boolean,
  store_name text,
  store_contact text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.order_number, o.created_at, o.target_link, o.quantity, o.service,
         o.provider_order_id, o.provider_status, o.start_count::integer, o.remains::integer,
         o.refunded_at, o.refund_amount, o.refund_destination,
         (o.payment_reference IS NOT NULL AND o.seller_store_id IS NOT NULL),
         c.store_name, c.contact
  FROM public.social_boost_orders o
  LEFT JOIN LATERAL (
    SELECT s.store_name, coalesce(nullif(trim(s.support_number), ''), nullif(trim(s.whatsapp_number), ''), nullif(trim(s.phone_number), '')) AS contact
    FROM public.agent_stores s
    WHERE s.id = o.seller_store_id AND lower(coalesce(o.seller_store_kind, '')) = 'agent'
    UNION ALL
    SELECT s.store_name, coalesce(nullif(trim(s.support_number), ''), nullif(trim(s.whatsapp_number), ''))
    FROM public.subagent_stores s
    WHERE s.id = o.seller_store_id AND lower(coalesce(o.seller_store_kind, '')) = 'subagent'
    UNION ALL
    SELECT s.store_name, coalesce(nullif(trim(s.support_number), ''), nullif(trim(s.whatsapp_number), ''))
    FROM public.sub_subagent_stores s
    WHERE s.id = o.seller_store_id AND replace(lower(coalesce(o.seller_store_kind, '')), '_', '') = 'subsubagent'
  ) c ON true
  WHERE o.order_number::text = trim(p_order_number)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_social_boost_order(text) TO anon, authenticated, service_role;

-- Refund orders that were already cancelled before this migration (each is refunded once only).
SELECT public.refund_cancelled_social_boost_order(id)
FROM public.social_boost_orders
WHERE lower(coalesce(provider_status, '')) IN ('canceled', 'cancelled') AND refunded_at IS NULL;

-- =====================================================================
-- 2. Promo codes: claim conditions (minimum orders / minimum GB that day)
-- =====================================================================
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS min_orders_required integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_gb_required numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.promo_claim_progress(p_code_id uuid, p_phone text)
RETURNS TABLE(orders_today integer, gb_today numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pc AS (SELECT * FROM public.promo_codes WHERE id = p_code_id),
  owner_stores AS (
    SELECT s.id FROM public.agent_stores s, pc WHERE s.user_id = pc.owner_id OR s.id = pc.owner_id
    UNION SELECT s.id FROM public.subagent_stores s, pc WHERE s.user_id = pc.owner_id OR s.id = pc.owner_id
    UNION SELECT s.id FROM public.sub_subagent_stores s, pc WHERE s.user_id = pc.owner_id OR s.id = pc.owner_id
  )
  SELECT count(*)::integer, coalesce(sum(od.size_gb), 0)
  FROM public.orders od, pc
  WHERE right(regexp_replace(coalesce(od.customer_number, ''), '\D', '', 'g'), 9) = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
    AND (od.created_at AT TIME ZONE 'Africa/Accra')::date = (now() AT TIME ZONE 'Africa/Accra')::date
    AND lower(coalesce(od.status, '')) IN ('paid', 'completed', 'delivered', 'processing', 'in-queue')
    AND lower(coalesce(od.fulfillment_status, '')) NOT IN ('failed', 'refunded')
    AND coalesce(od.payment_method, '') <> 'free_data_claim'
    AND coalesce(od.refunded, false) = false
    AND (
      pc.store_type = 'admin'
      OR od.agent_store_id IN (SELECT id FROM owner_stores)
      OR od.subagent_store_id IN (SELECT id FROM owner_stores)
      OR od.sub_subagent_store_id IN (SELECT id FROM owner_stores)
      OR od.root_agent_store_id IN (SELECT id FROM owner_stores)
    );
$$;

REVOKE ALL ON FUNCTION public.promo_claim_progress(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promo_claim_progress(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.check_promo_claim_eligibility(p_code_id uuid, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pc public.promo_codes;
  v_orders integer;
  v_gb numeric;
BEGIN
  SELECT * INTO pc FROM public.promo_codes WHERE id = p_code_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'message', 'This promo code does not exist.'); END IF;
  IF pc.min_orders_required <= 0 AND pc.min_gb_required <= 0 THEN
    RETURN jsonb_build_object('eligible', true, 'min_orders', 0, 'min_gb', 0, 'orders_today', 0, 'gb_today', 0);
  END IF;

  SELECT orders_today, gb_today INTO v_orders, v_gb FROM public.promo_claim_progress(p_code_id, p_phone);

  IF v_orders < pc.min_orders_required THEN
    RETURN jsonb_build_object('eligible', false, 'min_orders', pc.min_orders_required, 'min_gb', pc.min_gb_required, 'orders_today', v_orders, 'gb_today', v_gb,
      'message', format('To claim this code, this number must make at least %s order%s today. It has made %s so far.', pc.min_orders_required, CASE WHEN pc.min_orders_required = 1 THEN '' ELSE 's' END, v_orders));
  END IF;
  IF v_gb < pc.min_gb_required THEN
    RETURN jsonb_build_object('eligible', false, 'min_orders', pc.min_orders_required, 'min_gb', pc.min_gb_required, 'orders_today', v_orders, 'gb_today', v_gb,
      'message', format('To claim this code, this number must buy at least %sGB today. It has bought %sGB so far.', trim(trailing '.' from trim(trailing '0' from pc.min_gb_required::text)), trim(trailing '.' from trim(trailing '0' from v_gb::text))));
  END IF;
  RETURN jsonb_build_object('eligible', true, 'min_orders', pc.min_orders_required, 'min_gb', pc.min_gb_required, 'orders_today', v_orders, 'gb_today', v_gb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_promo_claim_eligibility(uuid, text) TO anon, authenticated, service_role;

-- The claim itself enforces the condition too, so it cannot be bypassed from the browser.
DROP FUNCTION IF EXISTS public.claim_promo_code(uuid);
CREATE FUNCTION public.claim_promo_code(p_code_id uuid, p_phone text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pc public.promo_codes;
  v_claimed boolean;
BEGIN
  SELECT * INTO pc FROM public.promo_codes WHERE id = p_code_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF pc.min_orders_required > 0 OR pc.min_gb_required > 0 THEN
    IF p_phone IS NULL OR NOT coalesce((public.check_promo_claim_eligibility(p_code_id, p_phone) ->> 'eligible')::boolean, false) THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.promo_codes
  SET claimed_at = now(), claimed_by = auth.uid()
  WHERE id = p_code_id
    AND claimed_at IS NULL
    AND refunded_at IS NULL
    AND is_fake = false
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING true INTO v_claimed;

  RETURN coalesce(v_claimed, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_promo_code(uuid, text) TO anon, authenticated, service_role;

-- Claim conditions are returned with the code so the claim dialog can show them.
DROP FUNCTION IF EXISTS public.lookup_promo_code(text);
CREATE FUNCTION public.lookup_promo_code(p_code text)
RETURNS TABLE(id uuid, code text, package_id uuid, size_gb numeric, network text, claimed_at timestamptz, expires_at timestamptz, refunded_at timestamptz, is_fake boolean, min_orders_required integer, min_gb_required numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.code, p.package_id, p.size_gb, p.network, p.claimed_at, p.expires_at, p.refunded_at, p.is_fake, p.min_orders_required, p.min_gb_required
  FROM public.promo_codes p
  WHERE upper(p.code) = upper(trim(p_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_promo_code(text) TO anon, authenticated, service_role;
