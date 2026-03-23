
-- Add wallet_balance and topup_reference to agent_stores
ALTER TABLE public.agent_stores ADD COLUMN IF NOT EXISTS wallet_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.agent_stores ADD COLUMN IF NOT EXISTS topup_reference text;

-- Generate unique 4-digit topup references for existing agents
DO $$
DECLARE
  agent_record RECORD;
  new_ref text;
BEGIN
  FOR agent_record IN SELECT id FROM public.agent_stores WHERE topup_reference IS NULL
  LOOP
    LOOP
      new_ref := lpad(floor(random() * 10000)::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref);
    END LOOP;
    UPDATE public.agent_stores SET topup_reference = new_ref WHERE id = agent_record.id;
  END LOOP;
END $$;

-- Create a trigger to auto-generate topup_reference on insert
CREATE OR REPLACE FUNCTION public.generate_topup_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_ref text;
BEGIN
  IF NEW.topup_reference IS NULL THEN
    LOOP
      new_ref := lpad(floor(random() * 10000)::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.agent_stores WHERE topup_reference = new_ref);
    END LOOP;
    NEW.topup_reference := new_ref;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_topup_reference ON public.agent_stores;
CREATE TRIGGER trg_generate_topup_reference
  BEFORE INSERT ON public.agent_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_topup_reference();

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_role text NOT NULL CHECK (target_role IN ('user', 'agent', 'all')),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (target_role = 'all' OR target_role = (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

-- Create notification dismissals table
CREATE TABLE public.notification_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dismissed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dismissals" ON public.notification_dismissals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wallet topup log table
CREATE TABLE public.wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id uuid REFERENCES public.agent_stores(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage topups" ON public.wallet_topups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view own topups" ON public.wallet_topups
  FOR SELECT TO authenticated
  USING (agent_store_id IN (SELECT id FROM public.agent_stores WHERE user_id = auth.uid()));

-- Add payment_method column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'paystack';
