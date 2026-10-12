-- Custom domains were only resolvable for agent stores because resolve_store_domain
-- looked up the store name in agent_stores for every store kind. Resolve each kind
-- from its own table so sub-agent and sub-sub-agent domains behave like agent domains.

CREATE OR REPLACE FUNCTION public.resolve_store_domain(p_hostname text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_hostname text := lower(trim(p_hostname));
  v_store_id uuid;
  v_store_kind text;
  v_store_name text;
  v_parent_name text;
BEGIN
  SELECT da.store_id, da.store_kind INTO v_store_id, v_store_kind
  FROM public.store_domain_aliases da
  WHERE lower(coalesce(da.normalized_hostname, da.hostname)) = v_hostname
    AND lower(coalesce(da.status, 'active')) IN ('active', 'verified', 'pending')
  LIMIT 1;

  IF v_store_id IS NULL THEN
    SELECT coalesce(dp.store_id, dp.agent_store_id), dp.store_kind INTO v_store_id, v_store_kind
    FROM public.domain_purchases dp
    WHERE (lower(trim(dp.domain)) = v_hostname OR lower(trim(coalesce(dp.assigned_domain, ''))) = v_hostname)
      AND lower(coalesce(dp.status, '')) IN ('pending', 'active', 'verified')
    LIMIT 1;
  END IF;

  IF v_store_id IS NULL THEN
    SELECT s.id, 'agent' INTO v_store_id, v_store_kind FROM public.agent_stores s
    WHERE lower(s.custom_domain) = v_hostname AND coalesce(s.custom_domain_status, 'not_configured') NOT IN ('not_configured', 'disabled') LIMIT 1;
  END IF;
  IF v_store_id IS NULL THEN
    SELECT s.id, 'subagent' INTO v_store_id, v_store_kind FROM public.subagent_stores s
    WHERE lower(s.custom_domain) = v_hostname AND coalesce(s.custom_domain_status, 'not_configured') NOT IN ('not_configured', 'disabled') LIMIT 1;
  END IF;
  IF v_store_id IS NULL THEN
    SELECT s.id, 'subsubagent' INTO v_store_id, v_store_kind FROM public.sub_subagent_stores s
    WHERE lower(s.custom_domain) = v_hostname AND coalesce(s.custom_domain_status, 'not_configured') NOT IN ('not_configured', 'disabled') LIMIT 1;
  END IF;

  IF v_store_id IS NULL THEN RETURN NULL; END IF;

  IF coalesce(v_store_kind, 'agent') = 'subsubagent' THEN
    SELECT s.store_name, p.store_name INTO v_store_name, v_parent_name
    FROM public.sub_subagent_stores s
    LEFT JOIN public.subagent_stores p ON p.id = s.subagent_store_id
    WHERE s.id = v_store_id;
    IF v_store_name IS NOT NULL THEN
      RETURN jsonb_build_object('store_kind', 'subsubagent', 'store_name', v_store_name, 'parent_store_name', v_parent_name);
    END IF;
  ELSIF v_store_kind = 'subagent' THEN
    SELECT s.store_name INTO v_store_name FROM public.subagent_stores s WHERE s.id = v_store_id;
    IF v_store_name IS NOT NULL THEN
      RETURN jsonb_build_object('store_kind', 'subagent', 'store_name', v_store_name, 'parent_store_name', NULL);
    END IF;
  ELSE
    SELECT s.store_name INTO v_store_name FROM public.agent_stores s WHERE s.id = v_store_id;
    IF v_store_name IS NOT NULL THEN
      RETURN jsonb_build_object('store_kind', 'agent', 'store_name', v_store_name, 'parent_store_name', NULL);
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_store_domain(text) TO anon, authenticated, service_role;
