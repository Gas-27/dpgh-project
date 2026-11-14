-- An order can be reported only once across the whole site (customer, store front, agent, subagent, API).

CREATE OR REPLACE FUNCTION public.get_reported_order_ids(p_order_ids uuid[])
RETURNS TABLE(order_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT c.order_id
  FROM public.complaints c
  WHERE c.order_id = ANY (p_order_ids);
$$;

REVOKE ALL ON FUNCTION public.get_reported_order_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reported_order_ids(uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_order_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialise concurrent submissions for the same order so two clicks cannot both pass the check.
  PERFORM pg_advisory_xact_lock(hashtext('complaint-order:' || NEW.order_id::text));

  IF EXISTS (SELECT 1 FROM public.complaints WHERE order_id = NEW.order_id) THEN
    RAISE EXCEPTION 'ORDER_ALREADY_REPORTED' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_order_complaint ON public.complaints;
CREATE TRIGGER trg_prevent_duplicate_order_complaint
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_order_complaint();
