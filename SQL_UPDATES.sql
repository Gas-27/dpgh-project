-- ============================================================================
-- SQL Code for Data Plug Database Updates
-- Run these commands in Supabase SQL Editor
-- ============================================================================

-- 1. ADD VIDEO COLUMN TO STORE OVERVIEW VIDEO
-- This column will store the video URL/link to be displayed in the overview
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS overview_video_url TEXT DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.stores.overview_video_url IS 'Video URL to display in store overview section';

-- ============================================================================

-- 2. GENERATE TOP-UP REFERENCE FOR EXISTING CUSTOMERS
-- Run this to generate user_<id> format top-up references for all existing users
-- who don't have one yet

UPDATE public.customers
SET topup_reference = 'user' || id
WHERE topup_reference IS NULL 
   OR topup_reference = '' 
   OR topup_reference LIKE 'TOPUP%';

-- Verify the update worked
SELECT id, phone_number, topup_reference, created_at 
FROM public.customers 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================================================

-- 3. CREATE TRIGGER FOR NEW CUSTOMER SIGN-UPS
-- This automatically generates user_<id> reference for new customers
-- Copy and paste this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.generate_customer_topup_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.topup_reference IS NULL OR NEW.topup_reference = '' THEN
    NEW.topup_reference := 'user' || NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF NOT EXISTS generate_topup_ref_trigger ON public.customers;

-- Create the trigger
CREATE TRIGGER generate_topup_ref_trigger
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.generate_customer_topup_reference();

-- ============================================================================

-- 4. ADD USSD CODE AND ACCESS CODE COLUMNS (if they don't exist)
-- These columns will store USSD codes and access codes to display in dashboard

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS ussd_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS access_code_zero TEXT DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN public.customers.ussd_code IS 'USSD code displayed in customer dashboard';
COMMENT ON COLUMN public.customers.access_code_zero IS 'Access code zero displayed in customer dashboard';

-- Update existing records with sample USSD codes if needed
-- Modify these values as per your actual USSD codes
UPDATE public.customers
SET ussd_code = '*123#',
    access_code_zero = '0'
WHERE ussd_code IS NULL;

-- ============================================================================

-- 5. VERIFY ALL COLUMNS EXIST
-- Run this to check all the columns are created correctly

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
AND column_name IN ('topup_reference', 'overview_video_url', 'ussd_code', 'access_code_zero')
ORDER BY column_name;

-- Also check stores table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stores'
AND column_name IN ('overview_video_url')
ORDER BY column_name;

-- ============================================================================

-- 6. VIEW CURRENT DATA
-- Check the updated data

SELECT 
  id,
  phone_number,
  first_name,
  last_name,
  topup_reference,
  ussd_code,
  access_code_zero,
  created_at
FROM public.customers
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- NOTES:
-- 1. The topup_reference format will be: user1, user2, user3, etc.
-- 2. The USSD code and access code columns can be updated per customer if needed
-- 3. The overview_video_url should store full URLs like: https://example.com/video.mp4
-- 4. The trigger ensures all new signups get automatic topup_reference
-- ============================================================================
