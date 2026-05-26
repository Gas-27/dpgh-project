-- Add free data offer settings columns to app_settings table
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS free_data_required_gb INTEGER DEFAULT 35,
ADD COLUMN IF NOT EXISTS free_data_reward_gb INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS free_data_telecel_enabled BOOLEAN DEFAULT false;

-- Update existing row with defaults if it exists
UPDATE app_settings 
SET 
  free_data_required_gb = COALESCE(free_data_required_gb, 35),
  free_data_reward_gb = COALESCE(free_data_reward_gb, 1),
  free_data_telecel_enabled = COALESCE(free_data_telecel_enabled, false)
WHERE id = 1;
