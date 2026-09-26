-- Add sms_screenshot_url column to complaints table
-- This stores the MTN SMS confirmation screenshot URL uploaded by the customer
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS sms_screenshot_url TEXT;
