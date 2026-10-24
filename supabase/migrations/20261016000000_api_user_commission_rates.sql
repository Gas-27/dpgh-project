-- API-user commission rates. These are separate from the dashboard rates in
-- public.purchase_commission_rate, which agents/customers earn on dashboard purchases.
--   data, airtime 1.5% | gotv, dstv 0.25% | startimes 0.18% | ecg 0.6% | water (GWCL) 0.25%
CREATE OR REPLACE FUNCTION public.api_purchase_commission_rate(p_product text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE regexp_replace(lower(coalesce(p_product, '')), '[\s_-]+', '', 'g')
    WHEN 'data' THEN 0.015
    WHEN 'airtime' THEN 0.015
    WHEN 'gotv' THEN 0.0025
    WHEN 'dstv' THEN 0.0025
    WHEN 'startimes' THEN 0.0018
    WHEN 'startime' THEN 0.0018
    WHEN 'ecg' THEN 0.006
    WHEN 'electricity' THEN 0.006
    WHEN 'water' THEN 0.0025
    WHEN 'ghanawater' THEN 0.0025
    WHEN 'gwcl' THEN 0.0025
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.api_purchase_commission_rate(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_partner_api_purchase_with_commission(
  p_purchase_id uuid,
  p_provider_reference text,
  p_provider_response jsonb
)
RETURNS public.partner_api_purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_purchase public.partner_api_purchases;
  v_rate numeric;
  v_commission numeric;
BEGIN
  SELECT * INTO v_purchase FROM public.partner_api_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partner purchase not found'; END IF;
  IF v_purchase.status = 'refunded' OR v_purchase.commission_credited_at IS NOT NULL THEN
    RETURN v_purchase;
  END IF;

  v_rate := public.api_purchase_commission_rate(v_purchase.service_type);
  v_commission := round(v_purchase.amount * v_rate, 4);

  IF v_commission > 0 THEN
    UPDATE public.api_users
    SET api_wallet = coalesce(api_wallet, 0) + v_commission, api_wallet_updated_at = now()
    WHERE id = v_purchase.api_user_id;
  END IF;

  UPDATE public.partner_api_purchases
  SET status = 'completed',
      provider_reference = p_provider_reference,
      provider_response = p_provider_response,
      commission_rate = v_rate,
      commission_amount = v_commission,
      commission_credited_at = now(),
      updated_at = now()
  WHERE id = p_purchase_id
  RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_partner_api_purchase_with_commission(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_partner_api_purchase_with_commission(uuid, text, jsonb) TO service_role;
