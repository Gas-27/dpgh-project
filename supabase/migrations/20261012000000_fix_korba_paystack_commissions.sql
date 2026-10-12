-- Allow Korba purchases paid through Paystack storefront checkout
-- to receive the same commission as dashboard purchases.

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
  SELECT * INTO h
  FROM public.korba_transaction_history
  WHERE id = p_history_id;

  IF NOT FOUND THEN RETURN false; END IF;
  IF lower(replace(coalesce(h.status, ''), '_', '')) NOT IN ('completed', 'success', 'successful', 'delivered', 'paid') THEN
    RETURN false;
  END IF;
  IF coalesce(h.source, 'dashboard') NOT IN ('dashboard', 'storefront', 'paystack') THEN
    RETURN false;
  END IF;

  v_rate := public.purchase_commission_rate(h.product_type);
  v_commission := round(coalesce(h.amount, 0) * v_rate, 4);
  IF v_rate <= 0 OR v_commission <= 0 THEN RETURN false; END IF;

  INSERT INTO public.purchase_commission_credits (
    history_id,
    wallet_owner_type,
    wallet_owner_id,
    product_type,
    purchase_amount,
    commission_rate,
    commission_amount
  )
  VALUES (
    h.id,
    h.wallet_owner_type,
    h.wallet_owner_id,
    h.product_type,
    h.amount,
    v_rate,
    v_commission
  )
  ON CONFLICT (history_id) DO NOTHING;

  IF NOT FOUND THEN RETURN false; END IF;

  v_kind := lower(replace(coalesce(h.wallet_owner_type, ''), '_', ''));
  IF v_kind = 'agent' THEN
    UPDATE public.agent_stores
    SET wallet_balance = coalesce(wallet_balance, 0) + v_commission
    WHERE id = h.wallet_owner_id;
  ELSIF v_kind = 'subagent' THEN
    UPDATE public.subagent_stores
    SET wallet_balance = coalesce(wallet_balance, 0) + v_commission
    WHERE id = h.wallet_owner_id;
  ELSIF v_kind = 'subsubagent' THEN
    UPDATE public.sub_subagent_stores
    SET wallet_balance = coalesce(wallet_balance, 0) + v_commission
    WHERE id = h.wallet_owner_id;
  ELSIF v_kind = 'customer' THEN
    UPDATE public.customers
    SET wallet_balance = coalesce(wallet_balance, 0) + v_commission
    WHERE id = h.wallet_owner_id OR user_id = h.wallet_owner_id;
  END IF;

  IF NOT FOUND THEN
    DELETE FROM public.purchase_commission_credits WHERE history_id = h.id;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Re-run the credit trigger for completed purchases already in history.
SELECT public.credit_purchase_commission(id)
FROM public.korba_transaction_history
WHERE lower(replace(coalesce(status, ''), '_', '')) IN ('completed', 'success', 'successful', 'delivered', 'paid')
  AND coalesce(source, 'dashboard') IN ('dashboard', 'storefront', 'paystack');
