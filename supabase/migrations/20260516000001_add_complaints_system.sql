-- Create complaints table for tracking customer complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_type text NOT NULL, -- 'storefront' (from main site) or 'agent' (from agent store)
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_store_id uuid REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  subagent_store_id uuid REFERENCES public.subagent_stores(id) ON DELETE CASCADE,
  customer_number text NOT NULL,
  complaint_title text NOT NULL,
  complaint_details text NOT NULL,
  status text DEFAULT 'pending', -- pending, resolved, in-progress
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_complaints_agent_store ON public.complaints(agent_store_id);
CREATE INDEX idx_complaints_subagent_store ON public.complaints(subagent_store_id);
CREATE INDEX idx_complaints_order ON public.complaints(order_id);
CREATE INDEX idx_complaints_type ON public.complaints(complaint_type);
