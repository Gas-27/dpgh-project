-- API wallet purchases for utilities (ECG, GOtv, DSTV, StarTimes, Ghana Water)
-- plus commission tracking for every API purchase.

ALTER TABLE public.partner_api_purchases
  DROP CONSTRAINT IF EXISTS partner_api_purchases_service_type_check;

ALTER TABLE public.partner_api_purchases
  ADD CONSTRAINT partner_api_purchases_service_type_check
  CHECK (service_type = ANY (ARRAY['data', 'airtime', 'ecg', 'gotv', 'dstv', 'startimes', 'water']));

ALTER TABLE public.partner_api_purchases
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_credited_at timestamptz;

-- Marks the purchase completed and credits the commission to the API wallet
-- exactly once, in the same transaction.
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

  v_rate := public.purchase_commission_rate(v_purchase.service_type);
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
