-- ============================================================================
-- FRICO Data Bundle API - Supabase Database Setup
-- Copy and paste this entire script into your Supabase SQL Editor
-- API Key Name: FRICO_API_KEY
-- ============================================================================

-- Create enum types for networks and transaction status
CREATE TYPE public.network_type AS ENUM ('MTN', 'TELECEL', 'AT');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'success', 'failed', 'completed');

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.frico_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  country VARCHAR(100) DEFAULT 'Ghana',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_frico_users_phone ON public.frico_users(phone);
CREATE INDEX idx_frico_users_email ON public.frico_users(email);

-- ============================================================================
-- 2. DATA BUNDLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.frico_data_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id VARCHAR(255) UNIQUE NOT NULL,
  network public.network_type NOT NULL,
  size_gb DECIMAL(10, 2),
  size_mb DECIMAL(10, 2),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  validity_days INT,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_frico_bundles_network ON public.frico_data_bundles(network);
CREATE INDEX idx_frico_bundles_active ON public.frico_data_bundles(is_active);
CREATE INDEX idx_frico_bundles_id ON public.frico_data_bundles(bundle_id);

-- ============================================================================
-- 3. DATA TRANSACTIONS TABLE (Main table for all purchases)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.frico_data_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(255) UNIQUE NOT NULL,
  user_reference VARCHAR(255),
  user_id UUID REFERENCES public.frico_users(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  network public.network_type NOT NULL,
  bundle_id VARCHAR(255) NOT NULL,
  bundle_name VARCHAR(255),
  size_gb DECIMAL(10, 2),
  amount DECIMAL(10, 2) NOT NULL,
  commission DECIMAL(10, 2),
  status public.transaction_status DEFAULT 'pending',
  payment_method VARCHAR(50),
  api_response JSONB,
  error_message TEXT,
  callback_received BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_frico_transactions_phone ON public.frico_data_transactions(phone);
CREATE INDEX idx_frico_transactions_network ON public.frico_data_transactions(network);
CREATE INDEX idx_frico_transactions_status ON public.frico_data_transactions(status);
CREATE INDEX idx_frico_transactions_reference ON public.frico_data_transactions(reference);
CREATE INDEX idx_frico_transactions_user_reference ON public.frico_data_transactions(user_reference);
CREATE INDEX idx_frico_transactions_created_at ON public.frico_data_transactions(created_at);

-- ============================================================================
-- 4. TRANSACTION LOGS TABLE (Audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.frico_transaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.frico_data_transactions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_frico_logs_transaction ON public.frico_transaction_logs(transaction_id);
CREATE INDEX idx_frico_logs_event ON public.frico_transaction_logs(event_type);

-- ============================================================================
-- 5. API KEYS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.frico_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name VARCHAR(255) NOT NULL UNIQUE,
  api_key VARCHAR(500) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  requests_count INT DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_frico_api_keys_name ON public.frico_api_keys(key_name);
CREATE INDEX idx_frico_api_keys_key ON public.frico_api_keys(api_key);

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.frico_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frico_data_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frico_data_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frico_transaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frico_api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- API Keys: Only admin can view
CREATE POLICY "API keys readable by service role only" ON public.frico_api_keys
  FOR SELECT USING (auth.role() = 'service_role');

-- Data Bundles: Everyone can view active bundles
CREATE POLICY "Everyone can view active bundles" ON public.frico_data_bundles
  FOR SELECT USING (is_active = true);

-- Transactions: Allow API inserts, authenticated users can view their own
CREATE POLICY "Anyone can insert transactions via API" ON public.frico_data_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own transactions" ON public.frico_data_transactions
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    (auth.uid() = user_id) OR 
    (user_reference IS NOT NULL)
  );

-- Transaction Logs: Service role only
CREATE POLICY "Transaction logs readable by service role" ON public.frico_transaction_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 8. SAMPLE DATA
-- ============================================================================

-- Insert API Key - REPLACE with your actual FRICO_API_KEY
INSERT INTO public.frico_api_keys (key_name, api_key, description, is_active)
VALUES ('FRICO_API_KEY', 'your_actual_frico_api_key_here', 'Main API Key for FRICO Data Bundle Service', true)
ON CONFLICT (key_name) DO NOTHING;

-- Sample data bundles for MTN
INSERT INTO public.frico_data_bundles (bundle_id, network, size_gb, size_mb, name, price, validity_days, is_active)
VALUES 
  ('mtn_1gb', 'MTN', 1.0, 1024, 'MTN 1GB', 3.99, 30, true),
  ('mtn_2gb', 'MTN', 2.0, 2048, 'MTN 2GB', 7.99, 30, true),
  ('mtn_5gb', 'MTN', 5.0, 5120, 'MTN 5GB', 19.99, 30, true),
  ('mtn_10gb', 'MTN', 10.0, 10240, 'MTN 10GB', 39.99, 30, true)
ON CONFLICT (bundle_id) DO NOTHING;

-- Sample data bundles for Telecel
INSERT INTO public.frico_data_bundles (bundle_id, network, size_gb, size_mb, name, price, validity_days, is_active)
VALUES 
  ('telecel_1gb', 'TELECEL', 1.0, 1024, 'Telecel 1GB', 3.99, 30, true),
  ('telecel_2gb', 'TELECEL', 2.0, 2048, 'Telecel 2GB', 7.99, 30, true),
  ('telecel_5gb', 'TELECEL', 5.0, 5120, 'Telecel 5GB', 19.99, 30, true)
ON CONFLICT (bundle_id) DO NOTHING;

-- Sample data bundles for AirtelTigo
INSERT INTO public.frico_data_bundles (bundle_id, network, size_gb, size_mb, name, price, validity_days, is_active)
VALUES 
  ('at_1gb', 'AT', 1.0, 1024, 'AirtelTigo 1GB', 3.99, 30, true),
  ('at_2gb', 'AT', 2.0, 2048, 'AirtelTigo 2GB', 7.99, 30, true),
  ('at_5gb', 'AT', 5.0, 5120, 'AirtelTigo 5GB', 19.99, 30, true),
  ('db_BigTime_Data_51MB_1GHC', 'AT', 0.051, 51, 'AirtelTigo BigTime 51MB', 1.0, 7, true)
ON CONFLICT (bundle_id) DO NOTHING;

-- ============================================================================
-- 9. UTILITY FUNCTIONS
-- ============================================================================

-- Function to log transaction events
CREATE OR REPLACE FUNCTION public.log_transaction_event(
  p_transaction_id UUID,
  p_event_type VARCHAR,
  p_message TEXT,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.frico_transaction_logs (transaction_id, event_type, message, payload)
  VALUES (p_transaction_id, p_event_type, p_message, p_payload)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update transaction status
CREATE OR REPLACE FUNCTION public.update_transaction_status(
  p_reference VARCHAR,
  p_status public.transaction_status,
  p_api_response JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.frico_data_transactions
  SET 
    status = p_status,
    api_response = COALESCE(p_api_response, api_response),
    updated_at = NOW(),
    completed_at = CASE WHEN p_status = 'success' THEN NOW() ELSE completed_at END
  WHERE reference = p_reference;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get available bundles for a network
CREATE OR REPLACE FUNCTION public.get_network_bundles(
  p_network public.network_type
)
RETURNS TABLE (
  bundle_id VARCHAR,
  name VARCHAR,
  size_gb DECIMAL,
  size_mb DECIMAL,
  price DECIMAL,
  validity_days INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fdb.bundle_id,
    fdb.name,
    fdb.size_gb,
    fdb.size_mb,
    fdb.price,
    fdb.validity_days
  FROM public.frico_data_bundles fdb
  WHERE fdb.network = p_network AND fdb.is_active = true
  ORDER BY fdb.size_gb ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_frico_users_timestamp
BEFORE UPDATE ON public.frico_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_frico_bundles_timestamp
BEFORE UPDATE ON public.frico_data_bundles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_frico_transactions_timestamp
BEFORE UPDATE ON public.frico_data_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_frico_api_keys_timestamp
BEFORE UPDATE ON public.frico_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 11. VIEWS FOR REPORTING
-- ============================================================================

-- Transaction Summary View
CREATE OR REPLACE VIEW public.v_frico_transaction_summary AS
SELECT 
  DATE(created_at) as transaction_date,
  network,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  SUM(amount) as total_amount,
  SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as successful_amount,
  SUM(commission) as total_commission
FROM public.frico_data_transactions
GROUP BY DATE(created_at), network
ORDER BY transaction_date DESC;

-- User Transaction History View
CREATE OR REPLACE VIEW public.v_frico_user_history AS
SELECT 
  u.phone,
  u.name,
  COUNT(dt.id) as total_purchases,
  COUNT(CASE WHEN dt.status = 'success' THEN 1 END) as successful_purchases,
  SUM(CASE WHEN dt.status = 'success' THEN dt.amount ELSE 0 END) as total_spent,
  MAX(dt.created_at) as last_purchase_date
FROM public.frico_users u
LEFT JOIN public.frico_data_transactions dt ON u.id = dt.user_id
GROUP BY u.id, u.phone, u.name;

-- Network Performance View
CREATE OR REPLACE VIEW public.v_frico_network_performance AS
SELECT 
  network,
  COUNT(*) as total_transactions,
  ROUND(100.0 * COUNT(CASE WHEN status = 'success' THEN 1 END) / COUNT(*), 2) as success_rate_percent,
  AVG(amount) as avg_transaction_amount,
  SUM(commission) as total_commission
FROM public.frico_data_transactions
GROUP BY network;

-- ============================================================================
-- 12. GRANT PERMISSIONS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE ON public.frico_data_transactions TO anon, authenticated;
GRANT SELECT ON public.v_frico_transaction_summary TO authenticated;
GRANT SELECT ON public.v_frico_user_history TO authenticated;
GRANT SELECT ON public.v_frico_network_performance TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these individually to verify setup:

-- Check if all tables exist
SELECT 
  'frico_users' as table_name, 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='frico_users' AND table_schema='public') as exists;
SELECT 
  'frico_data_bundles' as table_name, 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='frico_data_bundles' AND table_schema='public') as exists;
SELECT 
  'frico_data_transactions' as table_name, 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='frico_data_transactions' AND table_schema='public') as exists;

-- Check API key was inserted
SELECT key_name, is_active FROM public.frico_api_keys WHERE key_name = 'FRICO_API_KEY';

-- Check sample bundles
SELECT COUNT(*) as total_bundles, network FROM public.frico_data_bundles GROUP BY network;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Replace 'your_actual_frico_api_key_here' with your actual FRICO_API_KEY
-- 2. All transactions are logged in frico_transaction_logs for audit trail
-- 3. RLS is enabled - adjust policies based on your security requirements
-- 4. Use the v_frico_* views for reporting and analytics
-- 5. Network types: MTN, TELECEL, AT (for AirtelTigo)
-- 6. Transaction statuses: pending, success, failed, completed
