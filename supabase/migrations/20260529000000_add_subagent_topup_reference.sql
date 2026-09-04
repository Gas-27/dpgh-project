-- Add topup_reference to subagent_stores
ALTER TABLE public.subagent_stores ADD COLUMN IF NOT EXISTS topup_reference text UNIQUE;

-- Function to generate next available reference code
-- Pattern: A01-Z99 (1 letter + 2 numbers), then AA01-ZZ99 (2 letters + 2 numbers), 
-- then AA001-ZZ999 (2 letters + 3 numbers), and so on
CREATE OR REPLACE FUNCTION public.generate_next_subagent_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Exclude I and O to avoid confusion
  letter_count int := 24;
  new_ref text;
  l1 int;
  l2 int;
  num int;
  max_num int;
  found boolean;
BEGIN
  -- Phase 1: Try 1 letter + 2 numbers (A01 to Z99) = 24 * 100 = 2,400 combinations
  FOR l1 IN 1..letter_count LOOP
    FOR num IN 1..99 LOOP
      new_ref := substr(letters, l1, 1) || lpad(num::text, 2, '0');
      SELECT NOT EXISTS (
        SELECT 1 FROM public.subagent_stores WHERE topup_reference = new_ref
        UNION ALL
        SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref
      ) INTO found;
      IF found THEN
        RETURN new_ref;
      END IF;
    END LOOP;
  END LOOP;

  -- Phase 2: Try 2 letters + 2 numbers (AA01 to ZZ99) = 24 * 24 * 100 = 57,600 combinations
  FOR l1 IN 1..letter_count LOOP
    FOR l2 IN 1..letter_count LOOP
      FOR num IN 1..99 LOOP
        new_ref := substr(letters, l1, 1) || substr(letters, l2, 1) || lpad(num::text, 2, '0');
        SELECT NOT EXISTS (
          SELECT 1 FROM public.subagent_stores WHERE topup_reference = new_ref
          UNION ALL
          SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref
        ) INTO found;
        IF found THEN
          RETURN new_ref;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Phase 3: Try 2 letters + 3 numbers (AA001 to ZZ999) = 24 * 24 * 1000 = 576,000 combinations
  FOR l1 IN 1..letter_count LOOP
    FOR l2 IN 1..letter_count LOOP
      FOR num IN 1..999 LOOP
        new_ref := substr(letters, l1, 1) || substr(letters, l2, 1) || lpad(num::text, 3, '0');
        SELECT NOT EXISTS (
          SELECT 1 FROM public.subagent_stores WHERE topup_reference = new_ref
          UNION ALL
          SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref
        ) INTO found;
        IF found THEN
          RETURN new_ref;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Phase 4: Try 3 letters + 3 numbers (AAA001 to ZZZ999) = 24^3 * 1000 = 13,824,000 combinations
  FOR l1 IN 1..letter_count LOOP
    FOR l2 IN 1..letter_count LOOP
      FOR num IN 1..999 LOOP
        new_ref := substr(letters, l1, 1) || substr(letters, l2, 1) || 'A' || lpad(num::text, 3, '0');
        SELECT NOT EXISTS (
          SELECT 1 FROM public.subagent_stores WHERE topup_reference = new_ref
          UNION ALL
          SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref
        ) INTO found;
        IF found THEN
          RETURN new_ref;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE EXCEPTION 'Could not generate unique topup_reference - all combinations exhausted';
END;
$$;

-- Generate topup_reference for existing subagents
DO $$
DECLARE
  subagent_record RECORD;
  new_ref text;
BEGIN
  FOR subagent_record IN SELECT id FROM public.subagent_stores WHERE topup_reference IS NULL ORDER BY created_at
  LOOP
    new_ref := public.generate_next_subagent_reference();
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
BEGIN
  IF NEW.topup_reference IS NULL THEN
    NEW.topup_reference := public.generate_next_subagent_reference();
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
