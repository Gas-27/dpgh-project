-- Record wallet subscription purchases in the owner's history so they appear in Purchase History.
create or replace function public.create_wallet_service_purchase(p_service_id uuid, p_phone text, p_pin_hash text, p_owner_type text, p_owner_id uuid, p_amount numeric)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_price numeric;
  v_service_name text;
  v_wallet numeric;
  v_order_id uuid;
  v_credential_id uuid;
  v_customer_id uuid;
  v_table text;
  v_column text;
  v_sql text;
begin
  if p_amount is null or p_amount <= 0 or p_phone !~ '^[0-9]{10}$' or p_pin_hash is null or length(p_pin_hash) <> 64 then
    raise exception 'Invalid wallet purchase details' using errcode = '22023';
  end if;

  select coalesce(s.price, 0), s.name into v_price, v_service_name
  from public.digital_services s
  where s.id = p_service_id and s.active = true;
  if v_price is null then raise exception 'Service is unavailable' using errcode = 'P0002'; end if;

  if p_owner_type = 'customer' then
    v_table := 'public.customers'; v_column := 'id';
    select c.id into v_customer_id from public.customers c where c.user_id = auth.uid() and c.id = p_owner_id;
    if v_customer_id is null then raise exception 'Customer wallet is unavailable' using errcode = '42501'; end if;
  elsif p_owner_type = 'agent' then
    v_table := 'public.agent_stores'; v_column := 'id';
  elsif p_owner_type = 'subagent' then
    v_table := 'public.subagent_stores'; v_column := 'id';
  elsif p_owner_type = 'subsubagent' then
    v_table := 'public.sub_subagent_stores'; v_column := 'id';
  else raise exception 'Invalid wallet owner' using errcode = '22023'; end if;

  v_sql := format('select wallet_balance from %s where %I = $1 for update', v_table, v_column);
  execute v_sql into v_wallet using p_owner_id;
  if v_wallet is null or v_wallet < p_amount then raise exception 'Insufficient wallet balance' using errcode = '22003'; end if;
  v_sql := format('update %s set wallet_balance = wallet_balance - $1 where %I = $2', v_table, v_column);
  execute v_sql using p_amount, p_owner_id;

  select c.id into v_credential_id
  from public.digital_service_credentials c
  where c.service_id = p_service_id and c.active = true and c.assigned_order_id is null
  order by c.slot_number
  for update skip locked limit 1;
  if v_credential_id is null then
    raise exception 'No service access slot is available' using errcode = 'P0001';
  end if;

  insert into public.digital_service_orders (service_id, credential_id, customer_phone, access_pin_hash, payment_status, access_granted_at, customer_id)
  values (p_service_id, v_credential_id, p_phone, p_pin_hash, 'paid', now(), case when p_owner_type = 'customer' then auth.uid() else null end)
  returning id into v_order_id;

  update public.digital_service_credentials
  set assigned_order_id = v_order_id, assigned_phone = p_phone, assigned_pin_hash = p_pin_hash, assigned_at = now(), updated_at = now()
  where id = v_credential_id;

  insert into public.korba_transaction_history (wallet_owner_type, wallet_owner_id, product_type, network_code, package_code, customer_number, amount, transaction_id, provider_reference, status, source)
  values (lower(replace(p_owner_type, '_', '')), p_owner_id, 'subscription', v_service_name, v_service_name, p_phone, p_amount, v_order_id::text, v_order_id::text, 'completed', 'dashboard');

  return jsonb_build_object('order_id', v_order_id, 'credential_id', v_credential_id, 'amount', p_amount);
exception when others then
  raise;
end;
$function$;

-- Unified subscription history for one store/customer: wallet purchases plus storefront sales, with cost and profit.
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
  v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  if v_kind = 'agent' then
    select exists (select 1 from agent_stores s where s.id = p_owner_id and s.user_id = auth.uid()) into v_allowed;
  elsif v_kind = 'subagent' then
    select exists (select 1 from subagent_stores s where s.id = p_owner_id and s.user_id = auth.uid()) into v_allowed;
  elsif v_kind = 'subsubagent' then
    select exists (select 1 from sub_subagent_stores s where s.id = p_owner_id and s.user_id = auth.uid()) into v_allowed;
  elsif v_kind = 'customer' then
    select exists (select 1 from customers c where c.id = p_owner_id and c.user_id = auth.uid()) into v_allowed;
  end if;
  if not v_allowed then raise exception 'Not allowed' using errcode = '42501'; end if;

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
  left join agent_service_pricing asp on p.seller_store_kind = 'agent' and asp.agent_store_id = p.seller_store_id and asp.service_id::text = p.service_id
  where p.seller_store_kind = v_kind and p.seller_store_id = p_owner_id
  order by 2 desc
  limit 500;
end;
$function$;

revoke all on function public.get_subscription_history(text, uuid) from public, anon;
grant execute on function public.get_subscription_history(text, uuid) to authenticated;
