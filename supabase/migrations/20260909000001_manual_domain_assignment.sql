alter table public.domain_purchases add column if not exists store_kind text not null default 'agent' check (store_kind in ('agent','subagent','subsubagent')), add column if not exists store_id uuid, add column if not exists assigned_domain text, add column if not exists assigned_at timestamptz, add column if not exists admin_notes text;
alter table public.agent_stores add column if not exists custom_domain text, add column if not exists custom_domain_status text not null default 'not_configured';
alter table public.subagent_stores add column if not exists custom_domain text, add column if not exists custom_domain_status text not null default 'not_configured';
alter table public.sub_subagent_stores add column if not exists custom_domain text, add column if not exists custom_domain_status text not null default 'not_configured';
create unique index if not exists domain_purchases_domain_unique on public.domain_purchases (lower(domain));
create unique index if not exists domain_purchases_assigned_domain_unique on public.domain_purchases (lower(assigned_domain)) where assigned_domain is not null;
create or replace function public.check_spin_eligibility(p_phone text, p_mode text, p_period text, p_minimum_count integer default 0, p_minimum_amount numeric default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_since timestamptz := case when p_period='week' then date_trunc('week',now()) else date_trunc('day',now()) end; v_count integer; v_amount numeric;
begin
 select count(*)::integer, coalesce(sum(coalesce(amount,selling_price,0)),0) into v_count,v_amount from public.orders where regexp_replace(customer_number,'\\D','','g')=regexp_replace(p_phone,'\\D','','g') and created_at>=v_since and coalesce(refunded,false)=false and (lower(coalesce(status,'')) in ('completed','delivered','success') or lower(coalesce(order_status,'')) in ('completed','delivered','success'));
 return jsonb_build_object('eligible', case when p_mode='order_count' then v_count>=greatest(p_minimum_count,0) when p_mode='order_amount' then v_amount>=greatest(p_minimum_amount,0) else true end,'order_count',v_count,'order_amount',v_amount,'period',p_period);
end; $$;
