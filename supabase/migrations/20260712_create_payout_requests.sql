-- Create payout_requests table for tracking payouts/withdrawals
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_type text NOT NULL CHECK (requester_type IN ('agent', 'subagent')),
  requester_id uuid NOT NULL,
  recipient_id uuid REFERENCES public.transfer_recipients(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  withdrawal_source text NOT NULL DEFAULT 'wallet_balance' CHECK (withdrawal_source IN ('wallet_balance', 'subagent_commission_balance')),
  source_balance_before numeric NOT NULL,
  source_balance_after numeric,
  transfer_code text,
  paystack_reference text,
  paystack_response jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

-- Add RLS policies for payout_requests
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Agents can view their own payouts
CREATE POLICY "Agents can view own payouts" ON public.payout_requests
  FOR SELECT TO authenticated
  USING (
    requester_type = 'agent' AND 
    requester_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid())
  );

-- Subagents can view their own payouts
CREATE POLICY "Subagents can view own payouts" ON public.payout_requests
  FOR SELECT TO authenticated
  USING (
    requester_type = 'subagent' AND 
    requester_id IN (SELECT id FROM public.subagent_stores WHERE user_id = auth.uid())
  );

-- Admins can view all payouts
CREATE POLICY "Admins can view all payouts" ON public.payout_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_payout_requests_requester ON public.payout_requests(requester_type, requester_id);
CREATE INDEX idx_payout_requests_status ON public.payout_requests(status);
CREATE INDEX idx_payout_requests_created_at ON public.payout_requests(created_at DESC);
