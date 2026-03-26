
-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id uuid NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Agents can view their own withdrawal requests
CREATE POLICY "Agents can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

-- Agents can insert their own withdrawal requests
CREATE POLICY "Agents can insert own withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

-- Admins can manage all withdrawal requests
CREATE POLICY "Admins can manage all withdrawals" ON public.withdrawal_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
