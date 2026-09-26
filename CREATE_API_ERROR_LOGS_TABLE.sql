-- Create API Error Logs Table for tracking failed orders
-- Copy ONLY this SQL (not any TypeScript code) into Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.api_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  customer_number VARCHAR(20),
  network VARCHAR(50),
  size_gb INTEGER,
  amount NUMERIC(10,2),
  agent_store_id UUID,
  subagent_store_id UUID,
  error_type VARCHAR(255),
  error_message TEXT,
  error_details JSONB,
  api_endpoint VARCHAR(255),
  http_status_code INTEGER,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_api_error_logs_created_at ON public.api_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_error_logs_resolved ON public.api_error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_api_error_logs_order_id ON public.api_error_logs(order_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.api_error_logs ENABLE ROW LEVEL SECURITY;

-- Allow admin to view all error logs
CREATE POLICY "admin_view_api_errors" ON public.api_error_logs
  FOR SELECT USING (true);

-- Allow admin to update error logs
CREATE POLICY "admin_update_api_errors" ON public.api_error_logs
  FOR UPDATE USING (true);

-- Allow admin to delete error logs
CREATE POLICY "admin_delete_api_errors" ON public.api_error_logs
  FOR DELETE USING (true);

-- Verify the table was created
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'api_error_logs'
ORDER BY ordinal_position;
