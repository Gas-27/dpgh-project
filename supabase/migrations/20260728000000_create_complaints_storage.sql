-- =============================================================================
-- COMPLAINTS STORAGE BUCKET
-- Run this SQL in your Supabase project:
--   Dashboard → SQL Editor → paste and click "Run"
-- =============================================================================

-- 1. Create the storage bucket for complaint screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaints',
  'complaints',
  true,                          -- public so thumbnail URLs work without auth tokens
  5242880,                       -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public            = EXCLUDED.public,
      file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. Storage policies
--    Any authenticated user can upload to their own path
--    Anyone can read (bucket is public, but explicit policy is best practice)

-- Allow authenticated users to upload complaint screenshots
CREATE POLICY "Authenticated users can upload complaint screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'complaints');

-- Allow authenticated users to update/replace their own uploads
CREATE POLICY "Authenticated users can update complaint screenshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'complaints');

-- Allow public read access (required for thumbnail display in admin/agent dashboards)
CREATE POLICY "Public read access for complaint screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'complaints');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete complaint screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'complaints');


-- 3. Add screenshot_url column to complaints table (if not already added)
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS owing_airtime  BOOLEAN,
  ADD COLUMN IF NOT EXISTS owing_bundle   BOOLEAN,
  ADD COLUMN IF NOT EXISTS owing_momo     BOOLEAN;
