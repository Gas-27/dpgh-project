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

-- sub_admin role: add to user_roles using the existing role enum
-- sub_admins are regular auth users with role='sub_admin' in the user_roles table.
-- No separate table needed — use user_roles + auth.users.
-- To create a sub-admin: INSERT INTO user_roles (user_id, role) VALUES ('<auth_user_id>', 'sub_admin');
