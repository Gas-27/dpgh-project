-- Sub-subagent signup fix: auth signup must never fail because a child store
-- cannot be created before the user has a session. The auth trigger only sets
-- identity; the authenticated RPC creates the store after signup/login.

DROP TRIGGER IF EXISTS on_sub_subagent_store_created ON auth.users;
DROP TRIGGER IF EXISTS on_sub_subagent_signup ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' IN ('subagent', 'sub_subagent')
     OR EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = NEW.id AND role::text IN ('subagent', 'sub_subagent')
     ) THEN
    UPDATE public.profiles SET role = NEW.raw_user_meta_data->>'role' WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.customers (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.profiles SET role = 'customer' WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_sub_subagent_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'sub_subagent' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'sub_subagent'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET role = 'sub_subagent' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sub_subagent_signup
AFTER INSERT ON auth.users
FOR EACH ROW
WHEN (NEW.raw_user_meta_data->>'role' = 'sub_subagent')
EXECUTE FUNCTION public.assign_sub_subagent_role();

CREATE OR REPLACE FUNCTION public.register_sub_subagent(
  p_user_id uuid,
  p_subagent_store_id uuid,
  p_store_name text,
  p_whatsapp_number text DEFAULT NULL,
  p_support_number text DEFAULT NULL,
  p_momo_number text DEFAULT NULL,
  p_momo_name text DEFAULT NULL,
  p_momo_network text DEFAULT NULL,
  p_topup_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Only the signed-in user can complete this registration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subagent_stores WHERE id = p_subagent_store_id) THEN
    RAISE EXCEPTION 'The selected parent subagent store does not exist';
  END IF;

  INSERT INTO public.sub_subagent_stores (
    user_id, subagent_store_id, store_name, whatsapp_number, support_number,
    momo_number, momo_name, momo_network, wallet_balance, approved, topup_reference
  ) VALUES (
    p_user_id, p_subagent_store_id, p_store_name, p_whatsapp_number, p_support_number,
    p_momo_number, p_momo_name, p_momo_network, 0, true,
    COALESCE(p_topup_reference, 'Agt' || LEFT(REPLACE(p_user_id::text, '-', ''), 8))
  )
  ON CONFLICT (user_id) DO UPDATE SET
    subagent_store_id = EXCLUDED.subagent_store_id,
    store_name = EXCLUDED.store_name,
    whatsapp_number = EXCLUDED.whatsapp_number,
    support_number = EXCLUDED.support_number,
    momo_number = EXCLUDED.momo_number,
    momo_name = EXCLUDED.momo_name,
    momo_network = EXCLUDED.momo_network,
    approved = true
  RETURNING id INTO v_store_id;

  UPDATE public.profiles SET role = 'sub_subagent' WHERE id = p_user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'sub_subagent'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN v_store_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_sub_subagent(uuid, uuid, text, text, text, text, text, text, text) TO authenticated;

UPDATE public.profiles p SET role = 'sub_subagent'
FROM public.user_roles r
WHERE r.user_id = p.id AND r.role::text = 'sub_subagent';

INSERT INTO public.sub_subagent_stores (user_id, subagent_store_id, store_name, wallet_balance, approved, topup_reference)
SELECT u.id, ps.id, COALESCE(NULLIF(u.raw_user_meta_data->>'store_name', ''), u.email, 'Sub-subagent store'), 0, true,
       'Agt' || LEFT(REPLACE(u.id::text, '-', ''), 8)
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id AND r.role::text = 'sub_subagent'
JOIN public.subagent_stores ps ON ps.id::text = NULLIF(u.raw_user_meta_data->>'subagent_store_id', '')
LEFT JOIN public.sub_subagent_stores s ON s.user_id = u.id
WHERE s.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.customers c
WHERE c.user_id IN (SELECT user_id FROM public.user_roles WHERE role::text = 'sub_subagent')
AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id);
