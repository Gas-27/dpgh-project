-- Initialize AFA Settings table with default record
-- Run this once to ensure afa_settings has the required record

-- First, ensure the table exists
CREATE TABLE IF NOT EXISTS public.afa_settings (
  id UUID PRIMARY KEY,
  registration_fee DECIMAL(10, 2) DEFAULT 50.00,
  bundle_price DECIMAL(10, 2) DEFAULT 50.00,
  registration_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delete any existing records
DELETE FROM public.afa_settings WHERE id != '550e8400-e29b-41d4-a716-446655440000';

-- Insert or update the default AFA settings record
INSERT INTO public.afa_settings (
  id,
  registration_fee,
  bundle_price,
  registration_enabled,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  50.00,
  50.00,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  registration_fee = COALESCE(EXCLUDED.registration_fee, 50.00),
  bundle_price = COALESCE(EXCLUDED.bundle_price, 50.00),
  registration_enabled = COALESCE(EXCLUDED.registration_enabled, true),
  updated_at = NOW();

-- Enable real-time for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.afa_settings;

-- Verify the record was created
SELECT id, registration_fee, bundle_price, registration_enabled FROM public.afa_settings;
