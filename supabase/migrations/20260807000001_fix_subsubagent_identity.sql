-- Keep sub-subagents out of the customer identity path and make their store
-- creation atomic. This is safe to run after the existing auth triggers.

CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A sub-subagent is not a customer, even though every auth user previously
  -- passed through this trigger.
  IF NEW.raw_user_meta_data->>'role' IN ('subagent', 'sub_subagent')
     OR EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = NEW.id
         AND role::text IN ('subagent', 'sub_subagent')
     ) THEN
    UPDATE public.profiles
    SET role = NEW.raw_user_meta_data->>'role'
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.customers (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
  SET role = 'customer'
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Correct older sub-subagent profiles and create missing store rows. Existing
-- customer rows are retained for history, but the app excludes these users
-- from the customer directory by role.
UPDATE public.profiles p
SET role = 'sub_subagent'
FROM public.user_roles r
WHERE r.user_id = p.id
  AND r.role::text = 'sub_subagent';

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
DECLARE
  v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Only the signed-in user can create this store';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role::text = 'sub_subagent'
  ) THEN
    RAISE EXCEPTION 'User is not a sub-subagent';
  END IF;

  INSERT INTO public.sub_subagent_stores (
    user_id, subagent_store_id, store_name, whatsapp_number,
    support_number, momo_number, momo_name, momo_network,
    wallet_balance, approved, topup_reference
  )
  VALUES (
    p_user_id, p_subagent_store_id, p_store_name, p_whatsapp_number,
    p_support_number, p_momo_number, p_momo_name, p_momo_network,
    0, true, p_topup_reference
  )
  ON CONFLICT (user_id) DO UPDATE SET
    subagent_store_id = EXCLUDED.subagent_store_id,
    store_name = EXCLUDED.store_name,
    whatsapp_number = EXCLUDED.whatsapp_number,
    support_number = EXCLUDED.support_number,
    momo_number = EXCLUDED.momo_number,
    momo_name = EXCLUDED.momo_name,
    momo_network = EXCLUDED.momo_network,
    topup_reference = COALESCE(EXCLUDED.topup_reference, public.sub_subagent_stores.topup_reference)
  RETURNING id INTO v_store_id;

  UPDATE public.profiles
  SET role = 'sub_subagent'
  WHERE id = p_user_id;

  RETURN v_store_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_sub_subagent(uuid, uuid, text, text, text, text, text, text, text) TO authenticated;

-- Create a store row immediately when a sub-subagent is created. This makes
-- the account discoverable even if the registration page closes mid-submit.
CREATE OR REPLACE FUNCTION public.ensure_sub_subagent_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'sub_subagent' THEN
    INSERT INTO public.sub_subagent_stores (
      user_id, store_name, wallet_balance, approved
    )
    VALUES (
      NEW.id, COALESCE(NULLIF(NEW.email, ''), 'Sub-subagent store'), 0, true
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_sub_subagent_store_created ON auth.users;
CREATE TRIGGER on_sub_subagent_store_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'role' = 'sub_subagent')
  EXECUTE FUNCTION public.ensure_sub_subagent_store();

-- Repair users that already have the sub-subagent role but no store row.
INSERT INTO public.sub_subagent_stores (user_id, store_name, wallet_balance, approved)
SELECT u.id, COALESCE(NULLIF(u.email, ''), 'Sub-subagent store'), 0, true
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id AND r.role::text = 'sub_subagent'
LEFT JOIN public.sub_subagent_stores s ON s.user_id = u.id
WHERE s.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- The existing store reference trigger used NEW.top_reference, which does not
-- exist in this table. Use the actual topup_reference column.
CREATE OR REPLACE FUNCTION public.assign_sub_subagent_top_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.topup_reference IS NULL OR NEW.topup_reference = '' THEN
    NEW.topup_reference := 'Agt' || (SELECT COUNT(*) + 1 FROM public.sub_subagent_stores)::text;
  END IF;
  RETURN NEW;
END;
$$;
