-- Create transfer_recipients table for storing recipient bank/mobile money accounts
CREATE TABLE public.transfer_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_code text NOT NULL UNIQUE,
  account_holder_name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('bank', 'mobile_money')),
  bank_name text,
  bank_code text,
  account_number text,
  mobile_money_network text CHECK (mobile_money_network IN ('mtn', 'telecel', 'vodafone', 'airteltigo')),
  mobile_money_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add RLS policies for transfer_recipients
ALTER TABLE public.transfer_recipients ENABLE ROW LEVEL SECURITY;

-- Users can view their own recipients
CREATE POLICY "Users can view own recipients" ON public.transfer_recipients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own recipients
CREATE POLICY "Users can insert own recipients" ON public.transfer_recipients
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own recipients
CREATE POLICY "Users can update own recipients" ON public.transfer_recipients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own recipients
CREATE POLICY "Users can delete own recipients" ON public.transfer_recipients
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all recipients
CREATE POLICY "Admins can view all recipients" ON public.transfer_recipients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for faster queries
CREATE INDEX idx_transfer_recipients_user_id ON public.transfer_recipients(user_id);
CREATE INDEX idx_transfer_recipients_recipient_code ON public.transfer_recipients(recipient_code);
CREATE INDEX idx_transfer_recipients_status ON public.transfer_recipients(status);
