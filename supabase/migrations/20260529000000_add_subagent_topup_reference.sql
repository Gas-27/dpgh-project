-- Add topup_reference to subagent_stores
ALTER TABLE public.subagent_stores ADD COLUMN IF NOT EXISTS topup_reference text UNIQUE;

-- Generate topup_reference for existing subagents (2 letters + 2 numbers format)
DO $$
DECLARE
  subagent_record RECORD;
  new_ref text;
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Exclude I and O to avoid confusion
  letter_len int := 24;
BEGIN
  FOR subagent_record IN SELECT id FROM public.subagent_stores WHERE topup_reference IS NULL
  LOOP
    LOOP
      -- Generate 2 letters + 2 numbers (e.g., AB12)
      new_ref := substr(letters, floor(random() * letter_len + 1)::int, 1) ||
                 substr(letters, floor(random() * letter_len + 1)::int, 1) ||
                 lpad(floor(random() * 100)::text, 2, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.subagent_stores WHERE topup_reference = new_ref
        UNION
        SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref
      );
    END LOOP;
    UPDATE public.subagent_stores SET topup_reference = new_ref WHERE id = subagent_record.id;
  END LOOP;
END $$;

-- Create trigger function to auto-generate topup_reference for new subagents
CREATE OR REPLACE FUNCTION public.generate_subagent_topup_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ref text;
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  letter_len int := 24;
  attempt_count int := 0;
  max_attempts int := 1000;
  use_three_digits boolean := false;
BEGIN
  IF NEW.topup_reference IS NULL THEN
    LOOP
      attempt_count := attempt_count + 1;
      
      -- After many attempts, switch to 3 digits
      IF attempt_count > 500 THEN
        use_three_digits := true;
      END IF;
      
      IF use_three_digits THEN
        -- 2 letters + 3 numbers (e.g., AB123)
        new_ref := substr(letters, floor(random() * letter_len + 1)::int, 1) ||
                   substr(letters, floor(random() * letter_len + 1)::int, 1) ||
                   lpad(floor(random() * 1000)::text, 3, '0');
      ELSE
        -- 2 letters + 2 numbers (e.g., AB12)
        new_ref := substr(letters, floor(random() * letter_len + 1)::int, 1) ||
                   substr(letters, floor(random() * letter_len + 1)::int, 1) ||
                   lpad(floor(random() * 100)::text, 2, '0');
      END IF;
      
      -- Check both agent_stores and subagent_stores for uniqueness
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.subagent_stores WHERE topup_reference = new_ref
        UNION
        SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref
      );
      
      -- Prevent infinite loop
      IF attempt_count >= max_attempts THEN
        RAISE EXCEPTION 'Could not generate unique topup_reference after % attempts', max_attempts;
      END IF;
    END LOOP;
    NEW.topup_reference := new_ref;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating topup_reference on insert
DROP TRIGGER IF EXISTS trg_generate_subagent_topup_reference ON public.subagent_stores;
CREATE TRIGGER trg_generate_subagent_topup_reference
  BEFORE INSERT ON public.subagent_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_subagent_topup_reference();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subagent_stores_topup_reference ON public.subagent_stores(topup_reference);
