-- Closes public read access to orders and the anonymous insert paths on money tables.
-- Anonymous lookups (order tracking, payment confirmation, spin/free-data claims) move
-- to narrow SECURITY DEFINER functions. Nothing in this migration touches any row data.

-- 1. orders: remove the policies that exposed every order to every visitor
drop policy if exists "Users can view their own orders" on public.orders;
drop policy if exists "Public can read orders" on public.orders;
drop policy if exists "Users can view orders by paystack reference" on public.orders;

create policy "Customers can view own orders"
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or user_id = (select auth.uid()));

-- 2. orders: anonymous browsers no longer insert directly
drop policy if exists "Allow public insert for spin_wheel orders" on public.orders;
drop policy if exists "Public can insert orders for approved stores" on public.orders;

create policy "Authenticated can insert orders for approved stores"
  on public.orders for insert to authenticated
  with check (agent_store_id in (select id from public.agent_stores where approved = true));

drop policy if exists "Authenticated users can insert orders without agent" on public.orders;
create policy "Authenticated users can insert wallet orders without agent"
  on public.orders for insert to authenticated
  with check (agent_store_id is null and payment_method = 'wallet');

-- 3. Lookup functions for anonymous flows
create or replace function public.search_orders_public(
  p_term text,
  p_agent_store_id uuid default null,
  p_subagent_store_id uuid default null,
  p_direct_agent_only boolean default false
) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_term text := regexp_replace(coalesce(p_term, ''), '\s', '', 'g');
  v_digits text := regexp_replace(v_term, '\D', '', 'g');
  v_result json;
begin
  if v_term ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select coalesce(json_agg(t order by t.created_at desc), '[]'::json) into v_result from (
      select id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status,
             created_at, package_id, agent_store_id, subagent_store_id, sub_subagent_store_id, customer_id,
             provider_reference, provider_order_id, mtn_beneficiary_status, mtn_failure_reason,
             mtn_beneficiary_submitted_at, mtn_retry_eligible_at
      from orders
      where id = v_term::uuid
        and (p_agent_store_id is null or agent_store_id = p_agent_store_id)
        and (p_subagent_store_id is null or subagent_store_id = p_subagent_store_id)
        and (not p_direct_agent_only or subagent_store_id is null)
    ) t;
    return v_result;
  end if;

  if length(v_digits) < 9 then
    return '[]'::json;
  end if;

  select coalesce(json_agg(t order by t.created_at desc), '[]'::json) into v_result from (
    select id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status,
           created_at, package_id, agent_store_id, subagent_store_id, sub_subagent_store_id, customer_id,
           provider_reference, provider_order_id, mtn_beneficiary_status, mtn_failure_reason,
           mtn_beneficiary_submitted_at, mtn_retry_eligible_at
    from orders
    where right(regexp_replace(customer_number, '\D', '', 'g'), 9) = right(v_digits, 9)
      and (p_agent_store_id is null or agent_store_id = p_agent_store_id)
      and (p_subagent_store_id is null or subagent_store_id = p_subagent_store_id)
      and (not p_direct_agent_only or subagent_store_id is null)
    order by created_at desc
    limit 50
  ) t;
  return v_result;
end $$;

create or replace function public.orders_by_ids_public(p_ids uuid[])
returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(t), '[]'::json) from (
    select id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status,
           created_at, package_id, agent_store_id, subagent_store_id, sub_subagent_store_id, customer_id,
           provider_reference, provider_order_id, mtn_beneficiary_status, mtn_failure_reason,
           mtn_beneficiary_submitted_at, mtn_retry_eligible_at
    from orders
    where id = any(p_ids[1:100])
  ) t;
$$;

create or replace function public.order_exists_for_reference(p_ref text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders where paystack_reference = p_ref and length(coalesce(p_ref, '')) >= 8);
$$;

create or replace function public.order_link_info_for_reference(p_ref text)
returns json
language sql stable security definer set search_path = public as $$
  select row_to_json(t) from (
    select id, customer_id, user_id from orders
    where paystack_reference = p_ref and length(coalesce(p_ref, '')) >= 8 limit 1
  ) t;
$$;

create or replace function public.phone_order_count(p_phone text)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from orders where customer_number = p_phone;
$$;

create or replace function public.phone_recent_order_at(p_phone text, p_since timestamptz)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(created_at) from orders where customer_number = p_phone and created_at >= p_since;
$$;

create or replace function public.refunded_mtn_orders_for_phone(p_phone text)
returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(t order by t.created_at desc), '[]'::json) from (
    select customer_number, network, mtn_retry_eligible_at, created_at, refunded, refunded_at, refund_date,
           order_status, fulfillment_status, status
    from orders
    where lower(network) in ('mtn', 'mtn_express', 'mtn express')
      and (lower(status) = 'refunded' or lower(order_status) = 'refunded'
           or lower(fulfillment_status) = 'refunded' or refunded = true)
      and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
      and right(regexp_replace(customer_number, '\D', '', 'g'), 9) = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    order by created_at desc
    limit 50
  ) t;
$$;

create or replace function public.numbers_with_orders(p_numbers text[])
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct customer_number), '{}')
  from orders where customer_number = any(p_numbers[1:200]);
$$;

-- 4. Anonymous order creation for promo claims, behind the blocklist
create or replace function public.create_spin_order(
  p_phone text, p_network text, p_size_gb numeric, p_package_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.is_phone_blocked(p_phone) then
    raise exception 'This number is not allowed to make purchases';
  end if;
  insert into orders (customer_number, network, size_gb, amount, package_id, agent_store_id,
                      status, fulfillment_status, payment_method, paystack_reference)
  values (p_phone, p_network, p_size_gb, 0, p_package_id, null,
          'paid', 'pending', 'spin_wheel', null)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.create_free_claim_order(
  p_phone text, p_network text, p_size_gb numeric, p_package_id uuid,
  p_agent_store_id uuid default null, p_subagent_store_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.is_phone_blocked(p_phone) then
    raise exception 'This number is not allowed to make purchases';
  end if;
  insert into orders (customer_number, network, size_gb, amount, package_id, agent_store_id, subagent_store_id,
                      status, fulfillment_status, payment_method)
  values (p_phone, p_network, p_size_gb, 0, p_package_id, p_agent_store_id, p_subagent_store_id,
          'paid', 'pending', 'free_data_claim')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.discard_unfulfilled_claim_order(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from orders
  where id = p_id and payment_method = 'free_data_claim' and amount = 0
    and fulfillment_status = 'pending' and created_at > now() - interval '10 minutes';
$$;

revoke all on function
  public.discard_unfulfilled_claim_order(uuid),
  public.search_orders_public(text, uuid, uuid, boolean),
  public.orders_by_ids_public(uuid[]),
  public.order_exists_for_reference(text),
  public.order_link_info_for_reference(text),
  public.phone_order_count(text),
  public.phone_recent_order_at(text, timestamptz),
  public.refunded_mtn_orders_for_phone(text),
  public.numbers_with_orders(text[]),
  public.create_spin_order(text, text, numeric, uuid),
  public.create_free_claim_order(text, text, numeric, uuid, uuid, uuid)
from public;

grant execute on function
  public.discard_unfulfilled_claim_order(uuid),
  public.search_orders_public(text, uuid, uuid, boolean),
  public.orders_by_ids_public(uuid[]),
  public.order_exists_for_reference(text),
  public.order_link_info_for_reference(text),
  public.phone_order_count(text),
  public.phone_recent_order_at(text, timestamptz),
  public.refunded_mtn_orders_for_phone(text),
  public.numbers_with_orders(text[]),
  public.create_spin_order(text, text, numeric, uuid),
  public.create_free_claim_order(text, text, numeric, uuid, uuid, uuid)
to anon, authenticated;

-- 5. Tables no browser or server code reads: admin only
do $$
declare t text; p record;
begin
  foreach t in array array['spin_wheel_plays', 'spin_wheel_records', 'contact_spins'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy "Admins manage %1$s" on public.%1$I for all to authenticated
      using (public.has_role(auth.uid(), 'admin'::app_role))
      with check (public.has_role(auth.uid(), 'admin'::app_role))$f$, t);
  end loop;
end $$;

-- 6. Registration payments are written by edge functions (service role bypasses RLS)
drop policy if exists "Service can insert registration payments" on public.agent_registration_payments;
drop policy if exists "Service role can insert registration payments" on public.agent_registration_payments;
