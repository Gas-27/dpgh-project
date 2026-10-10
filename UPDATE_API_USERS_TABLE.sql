-- Add columns to api_users table for API key holders
-- This tracks email, topup_reference, and username for people who generate API keys

-- Add email column if it doesn't exist
ALTER TABLE api_users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add topup_reference column if it doesn't exist
ALTER TABLE api_users 
ADD COLUMN IF NOT EXISTS topup_reference VARCHAR(50);

-- Add username column if it doesn't exist
ALTER TABLE api_users 
ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_api_users_email ON api_users(email);
CREATE INDEX IF NOT EXISTS idx_api_users_topup_reference ON api_users(topup_reference);
CREATE INDEX IF NOT EXISTS idx_api_users_username ON api_users(username);

-- Optional: Add comment to the table
COMMENT ON TABLE api_users IS 'Stores API key user information including email, topup reference, and username';
COMMENT ON COLUMN api_users.email IS 'Email address of the API key holder';
COMMENT ON COLUMN api_users.topup_reference IS 'Unique topup reference for wallet management (format: 1us, 2us, etc.)';
COMMENT ON COLUMN api_users.username IS 'Username of the API key holder for identification';
