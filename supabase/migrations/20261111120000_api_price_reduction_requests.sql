-- Price-reduction requests from API users who reached the admin-set weekly API order target.
CREATE TABLE IF NOT EXISTS public.api_price_reduction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL,
  api_user_id uuid NOT NULL,
  requester_email text,
  week_start date NOT NULL,
  weekly_orders integer NOT NULL,
  target integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'handled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identity_id, week_start)
);

ALTER TABLE public.api_price_reduction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own price reduction requests" ON public.api_price_reduction_requests;
CREATE POLICY "Users read own price reduction requests" ON public.api_price_reduction_requests
  FOR SELECT TO authenticated USING (identity_id = auth.uid());

DROP POLICY IF EXISTS "Admins read price reduction requests" ON public.api_price_reduction_requests;
CREATE POLICY "Admins read price reduction requests" ON public.api_price_reduction_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update price reduction requests" ON public.api_price_reduction_requests;
CREATE POLICY "Admins update price reduction requests" ON public.api_price_reduction_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserts only happen through this function, which re-checks the weekly count on the server.
CREATE OR REPLACE FUNCTION public.request_api_price_reduction()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_api_user uuid;
  v_week_start date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
  v_count integer;
  v_target integer;
  v_email text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id INTO v_api_user FROM public.api_users WHERE identity_id = v_uid LIMIT 1;
  IF v_api_user IS NULL THEN RAISE EXCEPTION 'No API account found'; END IF;

  SELECT COALESCE(
    (SELECT api_weekly_order_target FROM public.weekly_order_target_settings WHERE id = true), 14000
  ) INTO v_target;

  SELECT count(*) INTO v_count
  FROM public.orders
  WHERE api_user = v_api_user
    AND order_status NOT IN ('failed', 'refunded')
    AND created_at >= v_week_start::timestamptz;

  IF v_count < v_target THEN
    RAISE EXCEPTION 'You have not reached this week''s API order target yet';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.api_price_reduction_requests (identity_id, api_user_id, requester_email, week_start, weekly_orders, target)
  VALUES (v_uid, v_api_user, v_email, v_week_start, v_count, v_target)
  ON CONFLICT (identity_id, week_start) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_api_price_reduction() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_api_price_reduction() TO authenticated;
