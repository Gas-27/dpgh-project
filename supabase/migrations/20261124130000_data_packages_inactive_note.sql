-- Admin-written explanation shown behind the info icon when a package is turned off.
ALTER TABLE public.data_packages
  ADD COLUMN IF NOT EXISTS inactive_note text;
