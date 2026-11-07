-- Keep sub-subagent signups from being classified as normal users.
-- The enum value already exists in the deployed schema.
CREATE OR REPLACE FUNCTION public.assign_subagent_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'role' IN ('subagent', 'sub_subagent')) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subagent_signup ON auth.users;
CREATE TRIGGER on_subagent_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'role' IN ('subagent', 'sub_subagent'))
  EXECUTE FUNCTION public.assign_subagent_role();

-- Repair accounts created before this migration when their store membership is present.
INSERT INTO public.user_roles (user_id, role)
SELECT s.user_id, 'sub_subagent'::public.app_role
FROM public.sub_subagent_stores s
WHERE s.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
