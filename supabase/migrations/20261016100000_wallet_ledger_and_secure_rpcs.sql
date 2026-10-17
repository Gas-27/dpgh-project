-- Wallet ledger and server-side wallet functions.
-- Every wallet movement made from a browser must go through these functions.

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('customer','agent','agent_commission','subagent','subsubagent')),
  owner_id uuid not null,
  delta numeric(14,2) not null check (delta <> 0),
  balance_before numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  kind text not null,
  reference text,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_ledger_reference_uniq
  on public.wallet_ledger (owner_type, owner_id, kind, reference) where reference is not null;
create index if not exists wallet_ledger_owner_idx on public.wallet_ledger (owner_type, owner_id, created_at desc);
create index if not exists wallet_ledger_reference_idx on public.wallet_ledger (reference) where reference is not null;

alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_ledger from anon, authenticated;

create or replace function public.wallet_owner_user(p_owner_type text, p_owner_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case p_owner_type
    when 'customer' then (select user_id from public.customers where id = p_owner_id)
    when 'agent' then (select user_id from public.agent_stores where id = p_owner_id)
    when 'agent_commission' then (select user_id from public.agent_stores where id = p_owner_id)
    when 'subagent' then (select user_id from public.subagent_stores where id = p_owner_id)
    when 'subsubagent' then (select user_id from public.sub_subagent_stores where id = p_owner_id)
  end
$$;
revoke all on function public.wallet_owner_user(text, uuid) from public, anon, authenticated;

create or replace function public.is_wallet_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role::text = 'admin')
$$;
revoke all on function public.is_wallet_admin() from public, anon;
grant execute on function public.is_wallet_admin() to authenticated;

drop policy if exists wallet_ledger_select_own on public.wallet_ledger;
create policy wallet_ledger_select_own on public.wallet_ledger for select to authenticated
  using (public.wallet_owner_user(owner_type, owner_id) = auth.uid() or public.is_wallet_admin());
grant select on public.wallet_ledger to authenticated;

-- Core mover. Not callable from a browser.
create or replace function public.wallet_apply_internal(
  p_owner_type text, p_owner_id uuid, p_delta numeric, p_kind text,
  p_reference text, p_note text, p_actor uuid, p_allow_negative boolean default false
) returns public.wallet_ledger
language plpgsql security definer set search_path = '' as $$
declare
  v_delta numeric := round(p_delta, 2);
  v_before numeric;
  v_after numeric;
  v_row public.wallet_ledger;
begin
  if v_delta is null or v_delta = 0 or abs(v_delta) > 1000000 then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;

  if p_owner_type = 'customer' then
    select coalesce(wallet_balance, 0) into v_before from public.customers where id = p_owner_id for update;
  elsif p_owner_type = 'agent' then
    select coalesce(wallet_balance, 0) into v_before from public.agent_stores where id = p_owner_id for update;
  elsif p_owner_type = 'agent_commission' then
    select coalesce(subagent_commission_balance, 0) into v_before from public.agent_stores where id = p_owner_id for update;
  elsif p_owner_type = 'subagent' then
    select coalesce(wallet_balance, 0) into v_before from public.subagent_stores where id = p_owner_id for update;
  elsif p_owner_type = 'subsubagent' then
    select coalesce(wallet_balance, 0) into v_before from public.sub_subagent_stores where id = p_owner_id for update;
  else
    raise exception 'Invalid wallet owner' using errcode = '22023';
  end if;
  if not found then raise exception 'Wallet not found' using errcode = 'P0002'; end if;

  if p_reference is not null then
    select * into v_row from public.wallet_ledger
      where owner_type = p_owner_type and owner_id = p_owner_id and kind = p_kind and reference = p_reference;
    if found then return v_row; end if;
  end if;

  v_after := v_before + v_delta;
  if v_after < 0 and not p_allow_negative then
    raise exception 'Insufficient wallet balance' using errcode = '22003';
  end if;

  if p_owner_type = 'customer' then
    update public.customers set wallet_balance = v_after where id = p_owner_id;
  elsif p_owner_type = 'agent' then
    update public.agent_stores set wallet_balance = v_after where id = p_owner_id;
  elsif p_owner_type = 'agent_commission' then
    update public.agent_stores set subagent_commission_balance = v_after where id = p_owner_id;
  elsif p_owner_type = 'subagent' then
    update public.subagent_stores set wallet_balance = v_after where id = p_owner_id;
  else
    update public.sub_subagent_stores set wallet_balance = v_after where id = p_owner_id;
  end if;

  insert into public.wallet_ledger (owner_type, owner_id, delta, balance_before, balance_after, kind, reference, note, actor_id)
  values (p_owner_type, p_owner_id, v_delta, v_before, v_after, p_kind, p_reference, left(p_note, 500), p_actor)
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.wallet_apply_internal(text, uuid, numeric, text, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.wallet_apply_internal(text, uuid, numeric, text, text, text, uuid, boolean) to service_role;

-- Resolve the caller's own wallet. Customers may pass either customers.id or their auth user id.
create or replace function public.wallet_resolve_own(p_owner_type text, p_owner_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_owner_type = 'customer' then
    select id into v_id from public.customers where (id = p_owner_id or user_id = p_owner_id) and user_id = auth.uid() limit 1;
  elsif p_owner_type = 'agent' then
    select id into v_id from public.agent_stores where id = p_owner_id and user_id = auth.uid();
  elsif p_owner_type = 'subagent' then
    select id into v_id from public.subagent_stores where id = p_owner_id and user_id = auth.uid();
  elsif p_owner_type = 'subsubagent' then
    select id into v_id from public.sub_subagent_stores where id = p_owner_id and user_id = auth.uid();
  else
    raise exception 'Invalid wallet owner' using errcode = '22023';
  end if;
  if v_id is null then raise exception 'Wallet is unavailable' using errcode = '42501'; end if;
  return v_id;
end;
$$;
revoke all on function public.wallet_resolve_own(text, uuid) from public, anon, authenticated;

-- Spend from the caller's own wallet. Can only reduce a balance, never raise it.
create or replace function public.wallet_debit_own(
  p_owner_type text, p_owner_id uuid, p_amount numeric, p_kind text,
  p_reference text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_amount numeric := round(p_amount, 2); v_row public.wallet_ledger;
begin
  if v_amount is null or v_amount <= 0 or v_amount > 50000 then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;
  if p_kind not in ('data_purchase','bulk_data_purchase','airtime_purchase','product_post','product_plan','product_boost','wallet_purchase') then
    raise exception 'Invalid purchase type' using errcode = '22023';
  end if;
  v_id := public.wallet_resolve_own(p_owner_type, p_owner_id);
  v_row := public.wallet_apply_internal(p_owner_type, v_id, -v_amount, p_kind, p_reference, p_note, auth.uid());
  return jsonb_build_object('ledger_id', v_row.id, 'balance_after', v_row.balance_after);
end;
$$;
revoke all on function public.wallet_debit_own(text, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.wallet_debit_own(text, uuid, numeric, text, text, text) to authenticated;

-- Move money from the caller's wallet to a wallet that is genuinely below them in the hierarchy.
create or replace function public.wallet_transfer_to_child(
  p_from_type text, p_from_id uuid, p_to_type text, p_to_id uuid, p_amount numeric,
  p_reference text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_from uuid; v_amount numeric := round(p_amount, 2); v_ok boolean := false; v_out public.wallet_ledger;
begin
  if v_amount is null or v_amount <= 0 or v_amount > 50000 then raise exception 'Invalid amount' using errcode = '22023'; end if;
  v_from := public.wallet_resolve_own(p_from_type, p_from_id);
  if p_from_type = 'agent' and p_to_type = 'subagent' then
    v_ok := exists (select 1 from public.subagent_stores where id = p_to_id and agent_store_id = v_from);
  elsif p_from_type = 'agent' and p_to_type = 'subsubagent' then
    v_ok := exists (select 1 from public.sub_subagent_stores s join public.subagent_stores p on p.id = s.subagent_store_id where s.id = p_to_id and p.agent_store_id = v_from);
  elsif p_from_type = 'subagent' and p_to_type = 'subsubagent' then
    v_ok := exists (select 1 from public.sub_subagent_stores where id = p_to_id and subagent_store_id = v_from);
  end if;
  if not v_ok then raise exception 'You can only transfer to your own downline' using errcode = '42501'; end if;
  v_out := public.wallet_apply_internal(p_from_type, v_from, -v_amount, 'transfer_out', p_reference, p_note, auth.uid());
  perform public.wallet_apply_internal(p_to_type, p_to_id, v_amount, 'transfer_in', p_reference, p_note, auth.uid());
  return jsonb_build_object('ledger_id', v_out.id, 'balance_after', v_out.balance_after);
end;
$$;
revoke all on function public.wallet_transfer_to_child(text, uuid, text, uuid, numeric, text, text) from public, anon;
grant execute on function public.wallet_transfer_to_child(text, uuid, text, uuid, numeric, text, text) to authenticated;

-- Pay upline commission out of a purchase the caller actually made.
-- Total commission paid for one debit can never exceed what the debit was.
create or replace function public.wallet_credit_upline(
  p_debit_ledger_id uuid, p_target_type text, p_target_id uuid, p_amount numeric
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_debit public.wallet_ledger;
  v_amount numeric := round(p_amount, 2);
  v_ok boolean := false;
  v_already numeric;
  v_row public.wallet_ledger;
begin
  if v_amount is null or v_amount <= 0 then raise exception 'Invalid amount' using errcode = '22023'; end if;
  select * into v_debit from public.wallet_ledger where id = p_debit_ledger_id;
  if not found or v_debit.delta >= 0 or v_debit.actor_id is distinct from auth.uid()
     or v_debit.kind not in ('data_purchase','bulk_data_purchase','airtime_purchase')
     or v_debit.created_at < now() - interval '15 minutes' then
    raise exception 'Commission is not allowed for this purchase' using errcode = '42501';
  end if;

  if v_debit.owner_type = 'subsubagent' then
    v_ok := exists (
      select 1 from public.sub_subagent_stores s
      left join public.subagent_stores p on p.id = s.subagent_store_id
      where s.id = v_debit.owner_id and (
        (p_target_type = 'subagent' and s.subagent_store_id = p_target_id) or
        (p_target_type = 'agent_commission' and p.agent_store_id = p_target_id) or
        (p_target_type = 'agent' and p.agent_store_id = p_target_id)));
  elsif v_debit.owner_type = 'subagent' then
    v_ok := p_target_type in ('agent','agent_commission') and exists (
      select 1 from public.subagent_stores where id = v_debit.owner_id and agent_store_id = p_target_id);
  end if;
  if not v_ok then raise exception 'Target is not in your upline' using errcode = '42501'; end if;

  select coalesce(sum(delta), 0) into v_already from public.wallet_ledger
    where kind = 'commission' and reference like p_debit_ledger_id::text || ':%';
  if v_already + v_amount > abs(v_debit.delta) then
    raise exception 'Commission exceeds the purchase amount' using errcode = '22003';
  end if;

  v_row := public.wallet_apply_internal(p_target_type, p_target_id, v_amount, 'commission',
    p_debit_ledger_id::text || ':' || p_target_type || ':' || p_target_id::text, 'Upline commission', auth.uid());
  return jsonb_build_object('ledger_id', v_row.id, 'balance_after', v_row.balance_after);
end;
$$;
revoke all on function public.wallet_credit_upline(uuid, text, uuid, numeric) from public, anon;
grant execute on function public.wallet_credit_upline(uuid, text, uuid, numeric) to authenticated;

-- Admin only. Positive delta credits, negative debits. Always recorded in the ledger.
create or replace function public.admin_wallet_adjust(
  p_owner_type text, p_owner_id uuid, p_delta numeric, p_kind text,
  p_reference text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_row public.wallet_ledger;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  if p_kind !~ '^[a-z_]{3,40}$' then raise exception 'Invalid type' using errcode = '22023'; end if;
  v_row := public.wallet_apply_internal(p_owner_type, p_owner_id, p_delta, p_kind, p_reference, p_note, auth.uid(), p_delta < 0 and p_kind in ('refund_reversal'));
  return jsonb_build_object('ledger_id', v_row.id, 'balance_before', v_row.balance_before, 'balance_after', v_row.balance_after);
end;
$$;
revoke all on function public.admin_wallet_adjust(text, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.admin_wallet_adjust(text, uuid, numeric, text, text, text) to authenticated;

-- A wallet-paid order must be backed by a real ledger debit.
create or replace function public.order_has_wallet_debit(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    join public.wallet_ledger l on l.reference = o.id::text and l.delta < 0
      and l.kind in ('data_purchase','bulk_data_purchase')
    where o.id = p_order_id and -l.delta >= coalesce(o.amount, 0) - 0.01
  )
$$;
revoke all on function public.order_has_wallet_debit(uuid) from public, anon, authenticated;
grant execute on function public.order_has_wallet_debit(uuid) to service_role;

-- create_wallet_service_purchase never checked who owned an agent/subagent/sub-subagent wallet.
create or replace function public.create_wallet_service_purchase(
  p_service_id uuid, p_phone text, p_pin_hash text, p_owner_type text, p_owner_id uuid, p_amount numeric
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_price numeric;
  v_service_name text;
  v_order_id uuid;
  v_credential_id uuid;
  v_owner uuid;
  v_ledger public.wallet_ledger;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_phone !~ '^[0-9]{10}$' or p_pin_hash is null or length(p_pin_hash) <> 64 then
    raise exception 'Invalid wallet purchase details' using errcode = '22023';
  end if;

  select coalesce(s.price, 0), s.name into v_price, v_service_name
  from public.digital_services s where s.id = p_service_id and s.active = true;
  if v_price is null then raise exception 'Service is unavailable' using errcode = 'P0002'; end if;
  -- The price comes from the service record, never from the caller.
  if v_price <= 0 then raise exception 'Service is unavailable' using errcode = 'P0002'; end if;

  v_owner := public.wallet_resolve_own(p_owner_type, p_owner_id);

  select c.id into v_credential_id
  from public.digital_service_credentials c
  where c.service_id = p_service_id and c.active = true and c.assigned_order_id is null
  order by c.slot_number for update skip locked limit 1;
  if v_credential_id is null then raise exception 'No service access slot is available' using errcode = 'P0001'; end if;

  v_order_id := gen_random_uuid();
  v_ledger := public.wallet_apply_internal(p_owner_type, v_owner, -v_price, 'service_purchase', v_order_id::text, v_service_name, auth.uid());

  insert into public.digital_service_orders (id, service_id, credential_id, customer_phone, access_pin_hash, payment_status, access_granted_at, customer_id)
  values (v_order_id, p_service_id, v_credential_id, p_phone, p_pin_hash, 'paid', now(), case when p_owner_type = 'customer' then auth.uid() else null end);

  update public.digital_service_credentials
  set assigned_order_id = v_order_id, assigned_phone = p_phone, assigned_pin_hash = p_pin_hash, assigned_at = now(), updated_at = now()
  where id = v_credential_id;

  insert into public.korba_transaction_history (wallet_owner_type, wallet_owner_id, product_type, network_code, package_code, customer_number, amount, transaction_id, provider_reference, status, source)
  values (lower(replace(p_owner_type, '_', '')), v_owner, 'subscription', v_service_name, v_service_name, p_phone, v_price, v_order_id::text, v_order_id::text, 'completed', 'dashboard');

  return jsonb_build_object('order_id', v_order_id, 'credential_id', v_credential_id, 'amount', v_price);
end;
$$;
revoke all on function public.create_wallet_service_purchase(uuid, text, text, text, uuid, numeric) from public, anon;
grant execute on function public.create_wallet_service_purchase(uuid, text, text, text, uuid, numeric) to authenticated;
