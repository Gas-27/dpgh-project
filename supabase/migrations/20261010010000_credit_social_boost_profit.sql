ALTER TABLE public.social_boost_orders
  ADD COLUMN IF NOT EXISTS profit_credited_at timestamptz;

CREATE OR REPLACE FUNCTION public.credit_social_boost_profit(
  p_reference text,
  p_store_kind text,
  p_store_id uuid,
  p_profit_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credited timestamptz;
  v_profit numeric := round(coalesce(p_profit_amount, 0), 2);
BEGIN
  IF p_reference IS NULL OR p_store_id IS NULL OR v_profit <= 0 THEN
    RETURN false;
  END IF;

  SELECT profit_credited_at INTO v_credited
  FROM public.social_boost_orders
  WHERE payment_reference = p_reference
  FOR UPDATE;

  IF NOT FOUND OR v_credited IS NOT NULL THEN
    RETURN false;
  END IF;

  IF p_store_kind = 'agent' THEN
    UPDATE public.agent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_profit WHERE id = p_store_id;
  ELSIF p_store_kind = 'subagent' THEN
    UPDATE public.subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_profit WHERE id = p_store_id;
  ELSIF p_store_kind IN ('subsubagent', 'sub_subagent') THEN
    UPDATE public.sub_subagent_stores SET wallet_balance = coalesce(wallet_balance, 0) + v_profit WHERE id = p_store_id;
  ELSE
    RAISE EXCEPTION 'Unknown store kind %', p_store_kind;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store % not found for kind %', p_store_id, p_store_kind;
  END IF;

  UPDATE public.social_boost_orders
  SET profit_credited_at = now(), profit_amount = v_profit
  WHERE payment_reference = p_reference;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_social_boost_profit(text, text, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_social_boost_profit(text, text, uuid, numeric) TO service_role;
