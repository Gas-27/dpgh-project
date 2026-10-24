-- Add sub_admin value to app_role enum (IF NOT EXISTS guard prevents errors on re-run)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sub_admin' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'sub_admin';
  END IF;
END $$;

-- complaint_notes: Admin notes/questions on complaints, with optional customer response
CREATE TABLE IF NOT EXISTS public.complaint_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  requires_response BOOLEAN DEFAULT FALSE,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS complaint_notes_complaint_id_idx ON public.complaint_notes(complaint_id);

ALTER TABLE public.complaint_notes DISABLE ROW LEVEL SECURITY;
