-- Add paystack_reference and status columns to wallet_topups for Paystack topup tracking
ALTER TABLE public.wallet_topups
ADD COLUMN IF NOT EXISTS paystack_reference text UNIQUE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

-- Create index on paystack_reference for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallet_topups_paystack_reference ON public.wallet_topups(paystack_reference);

-- Allow service role to insert topups (for edge functions)
CREATE POLICY IF NOT EXISTS "Service role can insert topups" ON public.wallet_topups
FOR INSERT TO authenticated
WITH CHECK (true);
