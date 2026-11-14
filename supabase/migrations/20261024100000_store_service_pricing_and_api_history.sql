-- Let sub-agent and sub-sub-agent stores save their own subscription selling prices.
alter table public.agent_service_pricing drop constraint if exists agent_service_pricing_agent_store_id_fkey;

drop policy if exists "Subagents manage own service pricing" on public.agent_service_pricing;
create policy "Subagents manage own service pricing" on public.agent_service_pricing
  for all to authenticated
  using (agent_store_id in (select s.id from public.subagent_stores s where s.user_id = (select auth.uid())))
  with check (agent_store_id in (select s.id from public.subagent_stores s where s.user_id = (select auth.uid())));

drop policy if exists "Sub-subagents manage own service pricing" on public.agent_service_pricing;
create policy "Sub-subagents manage own service pricing" on public.agent_service_pricing
  for all to authenticated
  using (agent_store_id in (select s.id from public.sub_subagent_stores s where s.user_id = (select auth.uid())))
  with check (agent_store_id in (select s.id from public.sub_subagent_stores s where s.user_id = (select auth.uid())));

-- Shared ownership check: the store/customer owner or an admin (admin "view as" mode).
create or replace function public.can_view_owner_history(p_owner_type text, p_owner_id uuid)
 returns boolean
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind text := lower(replace(p_owner_type, '_', ''));
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role::text = 'admin') then return true; end if;
  if v_kind = 'agent' then
    return exists (select 1 from agent_stores s where s.id = p_owner_id and s.user_id = auth.uid());
  elsif v_kind = 'subagent' then
    return exists (select 1 from subagent_stores s where s.id = p_owner_id and s.user_id = auth.uid());
  elsif v_kind = 'subsubagent' then
    return exists (select 1 from sub_subagent_stores s where s.id = p_owner_id and s.user_id = auth.uid());
  elsif v_kind = 'customer' then
    return p_owner_id = auth.uid()
      or exists (select 1 from customers c where c.id = p_owner_id and c.user_id = auth.uid());
  end if;
  return false;
end;
$function$;

revoke all on function public.can_view_owner_history(text, uuid) from public, anon;
grant execute on function public.can_view_owner_history(text, uuid) to authenticated;

-- Subscription history: wallet purchases plus storefront sales, now for every store kind and admin view.
create or replace function public.get_subscription_history(p_owner_type text, p_owner_id uuid)
 returns table (
   id uuid,
   created_at timestamptz,
   source text,
   service_name text,
   customer_number text,
   amount numeric,
   cost numeric,
   profit numeric,
   status text
 )
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind text := lower(replace(p_owner_type, '_', ''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.can_view_owner_history(p_owner_type, p_owner_id) then raise exception 'Not allowed' using errcode = '42501'; end if;

  return query
  select h.id, h.created_at, 'dashboard'::text, coalesce(h.package_code, h.network_code, 'Subscription'), h.customer_number, h.amount, h.amount, 0::numeric, h.status
  from korba_transaction_history h
  where lower(h.product_type) = 'subscription'
    and lower(replace(h.wallet_owner_type, '_', '')) = v_kind
    and h.wallet_owner_id = p_owner_id
  union all
  select p.id, coalesce(p.paid_at, p.created_at), 'storefront'::text, p.service_name, p.customer_phone, p.selling_price,
         coalesce(asp.base_price, ds.price, 0)::numeric,
         case when p.payment_status = 'paid' then greatest(p.selling_price - coalesce(asp.base_price, ds.price, 0), 0) else 0 end::numeric,
         case when p.payment_status = 'paid' then 'completed' else p.payment_status end
  from private_share_subscriptions p
  left join digital_services ds on ds.id::text = p.service_id
  left join agent_service_pricing asp on asp.agent_store_id = p.seller_store_id and asp.service_id::text = p.service_id
  where p.seller_store_kind = v_kind and p.seller_store_id = p_owner_id
  order by 2 desc
  limit 500;
end;
$function$;

revoke all on function public.get_subscription_history(text, uuid) from public, anon;
grant execute on function public.get_subscription_history(text, uuid) to authenticated;

-- API-wallet purchases (airtime, ECG/utilities via partner API and data bundles via API orders) for the owner.
create or replace function public.get_api_purchase_history(p_owner_type text, p_owner_id uuid)
 returns table (
   id uuid,
   created_at timestamptz,
   product_type text,
   network_code text,
   package_code text,
   customer_number text,
   amount numeric,
   status text,
   source text
 )
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind text := lower(replace(p_owner_type, '_', ''));
  v_identity uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.can_view_owner_history(p_owner_type, p_owner_id) then raise exception 'Not allowed' using errcode = '42501'; end if;

  if v_kind = 'agent' then select s.user_id into v_identity from agent_stores s where s.id = p_owner_id;
  elsif v_kind = 'subagent' then select s.user_id into v_identity from subagent_stores s where s.id = p_owner_id;
  elsif v_kind = 'subsubagent' then select s.user_id into v_identity from sub_subagent_stores s where s.id = p_owner_id;
  else
    select coalesce((select c.user_id from customers c where c.id = p_owner_id), p_owner_id) into v_identity;
  end if;
  if v_identity is null then return; end if;

  return query
  select p.id, p.created_at, p.service_type, p.network, p.product_name, p.recipient, p.amount, p.status, 'partner API'::text
  from partner_api_purchases p
  join api_users a on a.id = p.api_user_id
  where a.identity_id = v_identity
  union all
  select o.id, o.created_at, 'data'::text, o.network, coalesce(o.size_gb_text, o.size_gb::text || 'GB'), o.customer_number, o.amount,
         coalesce(o.fulfillment_status, o.status), 'API wallet'::text
  from orders o
  join api_users a on a.id::text = o.api_user
  where a.identity_id = v_identity
  order by 2 desc
  limit 500;
end;
$function$;

revoke all on function public.get_api_purchase_history(text, uuid) from public, anon;
grant execute on function public.get_api_purchase_history(text, uuid) to authenticated;
