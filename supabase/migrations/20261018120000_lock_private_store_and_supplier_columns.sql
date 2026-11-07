-- Private store data (wallet, MoMo, email, commission) is readable only by the store owner and admins.
-- Supplier cost (provider_rate) is readable only by admins.

create or replace function public.get_agent_stores_private(
  p_ids uuid[] default null,
  p_user_ids uuid[] default null,
  p_topup_reference text default null
)
returns setof public.agent_stores
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.agent_stores s
  where (p_ids is null or s.id = any(p_ids))
    and (p_user_ids is null or s.user_id = any(p_user_ids))
    and (p_topup_reference is null or s.topup_reference::text = p_topup_reference)
    and (
      s.user_id = (select auth.uid())
      or public.has_role((select auth.uid()), 'admin'::public.app_role)
    );
$$;

revoke all on function public.get_agent_stores_private(uuid[], uuid[], text) from public, anon;
grant execute on function public.get_agent_stores_private(uuid[], uuid[], text) to authenticated, service_role;

create or replace function public.get_social_boost_provider_rates()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('service_id', service_id, 'provider_rate', provider_rate)),
    '[]'::jsonb
  )
  from public.social_boost_service_pricing
  where public.is_social_boost_admin();
$$;

revoke all on function public.get_social_boost_provider_rates() from public, anon;
grant execute on function public.get_social_boost_provider_rates() to authenticated, service_role;

-- Admin-only reports that read private store columns on behalf of the caller.
create or replace function public.get_topups_with_store_data()
returns table(id uuid, agent_store_id uuid, amount numeric, created_at timestamp without time zone, store_name text, topup_reference text, wallet_balance numeric, momo_name text, momo_number text, momo_network text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.agent_store_id, t.amount, t.created_at, a.store_name, a.topup_reference,
         a.wallet_balance, a.momo_name, a.momo_number, a.momo_network
  from wallet_topups t
  left join agent_stores a on t.agent_store_id = a.id
  where public.has_role((select auth.uid()), 'admin'::public.app_role)
  order by t.created_at desc;
$$;

create or replace function public.search_topups_by_store_or_ref(search_query text)
returns table(id uuid, agent_store_id uuid, amount numeric, created_at timestamp without time zone, store_name text, topup_reference text, wallet_balance numeric, momo_name text, momo_number text, momo_network text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.agent_store_id, t.amount, t.created_at, a.store_name, a.topup_reference,
         a.wallet_balance, a.momo_name, a.momo_number, a.momo_network
  from wallet_topups t
  left join agent_stores a on t.agent_store_id = a.id
  where public.has_role((select auth.uid()), 'admin'::public.app_role)
    and (
      (a.topup_reference::text = search_query)
      or (lower(a.store_name) ilike '%' || lower(search_query) || '%')
      or (a.topup_reference::text ilike '%' || search_query || '%')
    )
  order by t.created_at desc
  limit 100;
$$;

create or replace function public.get_withdrawals_with_stores(limit_count integer default 10000)
returns table(id uuid, agent_store_id uuid, subagent_store_id uuid, amount numeric, status text, created_at timestamp without time zone, processed_at timestamp without time zone, withdrawal_source text, agent_store_name text, agent_momo_name text, agent_momo_number text, agent_momo_network text, agent_wallet_balance numeric, agent_subagent_commission_balance numeric, subagent_store_name text, subagent_momo_name text, subagent_momo_number text, subagent_momo_network text, subagent_wallet_balance numeric)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.agent_store_id, w.subagent_store_id, w.amount, w.status, w.created_at, w.processed_at, w.withdrawal_source,
         a.store_name, a.momo_name, a.momo_number, a.momo_network, a.wallet_balance, a.subagent_commission_balance,
         s.store_name, s.momo_name, s.momo_number, s.momo_network, s.wallet_balance
  from withdrawal_requests w
  left join agent_stores a on w.agent_store_id = a.id
  left join subagent_stores s on w.subagent_store_id = s.id
  where public.has_role((select auth.uid()), 'admin'::public.app_role)
  order by w.created_at desc
  limit limit_count;
$$;

revoke all on function public.get_topups_with_store_data() from public, anon;
revoke all on function public.search_topups_by_store_or_ref(text) from public, anon;
revoke all on function public.get_withdrawals_with_stores(integer) from public, anon;
grant execute on function public.get_topups_with_store_data() to authenticated, service_role;
grant execute on function public.search_topups_by_store_or_ref(text) to authenticated, service_role;
grant execute on function public.get_withdrawals_with_stores(integer) to authenticated, service_role;

-- purchase_domain debits the agent wallet, so it must read wallet_balance. It already verifies store ownership
-- against auth.uid(); the idempotency lookup is now scoped to the buyer so definer rights cannot leak other users' purchases.
create or replace function public.purchase_domain(p_domain text, p_agent_store_id uuid default null, p_idempotency_key text default null, p_registration_metadata jsonb default '{}'::jsonb)
returns domain_purchases
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_tld text;
  v_price numeric;
  v_customer_id uuid;
  v_store_user uuid;
  v_purchase public.domain_purchases;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then raise exception 'A valid idempotency key is required'; end if;
  select * into v_purchase from public.domain_purchases where idempotency_key = p_idempotency_key and buyer_user_id = v_user;
  if found then return v_purchase; end if;
  select lower('.' || split_part(trim(p_domain), '.', 2)), customer_price into v_tld, v_price
  from public.spaceship_tld_pricing
  where lower(tld) = lower('.' || split_part(trim(p_domain), '.', 2)) and active = true;
  if v_price is null then raise exception 'No active price exists for this domain extension'; end if;
  if p_agent_store_id is null then
    select id into v_customer_id from public.customers where user_id = v_user for update;
    if v_customer_id is null then raise exception 'Customer wallet not found'; end if;
    update public.customers set wallet_balance = wallet_balance - v_price, updated_at = now()
    where id = v_customer_id and wallet_balance >= v_price;
    if not found then raise exception 'Insufficient wallet balance'; end if;
  else
    select user_id into v_store_user from public.agent_stores where id = p_agent_store_id for update;
    if v_store_user is distinct from v_user then raise exception 'Agent store does not belong to current user'; end if;
    update public.agent_stores set wallet_balance = wallet_balance - v_price
    where id = p_agent_store_id and wallet_balance >= v_price;
    if not found then raise exception 'Insufficient wallet balance'; end if;
  end if;
  insert into public.domain_purchases (buyer_user_id, agent_store_id, domain, tld, price, idempotency_key, registration_metadata)
  values (v_user, p_agent_store_id, lower(trim(p_domain)), v_tld, v_price, p_idempotency_key, coalesce(p_registration_metadata, '{}'::jsonb))
  returning * into v_purchase;
  insert into public.wallet_transactions (agent_store_id, transaction_type, reference_id, amount, status, completed_at)
  values (p_agent_store_id, 'domain_purchase', v_purchase.id, -v_price, 'completed', now());
  return v_purchase;
end;
$function$;

revoke all on function public.purchase_domain(text, uuid, text, jsonb) from public, anon;
grant execute on function public.purchase_domain(text, uuid, text, jsonb) to authenticated, service_role;

-- The order trigger credits agent_stores.subagent_commission_balance, which reads a private column.
-- It is internal (trigger only) so it runs with definer rights and a pinned search_path.
create or replace function public.credit_agent_subagent_profit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_agent_store_id uuid;
  v_agent_subagent_price numeric;
  v_admin_base_price numeric;
  v_subagent_profit numeric;
  v_agent_profit numeric;
begin
  if new.status != 'completed' or new.subagent_store_id is null then
    return new;
  end if;

  select agent_store_id, agent_price
  into v_agent_store_id, v_agent_subagent_price
  from public.subagent_stores
  where id = new.subagent_store_id;

  select agent_price into v_admin_base_price
  from public.data_packages
  where id = new.package_id;

  v_subagent_profit := new.selling_price - coalesce(v_agent_subagent_price, v_admin_base_price, 0);
  v_agent_profit := coalesce(v_agent_subagent_price, v_admin_base_price, 0) - coalesce(v_admin_base_price, 0);

  if v_subagent_profit > 0 then
    update public.subagent_stores
    set wallet_balance = coalesce(wallet_balance, 0) + v_subagent_profit
    where id = new.subagent_store_id;
  end if;

  if v_agent_store_id is not null and v_agent_profit > 0 then
    update public.agent_stores
    set subagent_commission_balance = coalesce(subagent_commission_balance, 0) + v_agent_profit
    where id = v_agent_store_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.credit_agent_subagent_profit() from public, anon, authenticated;

-- Column-level read access: the public storefront columns stay readable, private ones do not.
revoke select on public.agent_stores from anon, authenticated;
grant select (
  id, user_id, store_name, store_name_slug, url_slug, full_store_url, approved, created_at,
  parent_agent_id, theme_config, store_headline, tutorial_video_url,
  whatsapp_number, whatsapp_group, support_number, phone_number, topup_reference,
  show_whatsapp_group_icon, show_ussd_on_storefront,
  allow_registration, allow_subagent_registration,
  subagent_commission_rate, subagent_fee_enabled, subagent_fee_amount,
  afa_bundle_price, afa_profit, afa_subagent_base_price,
  custom_domain, custom_domain_status
) on public.agent_stores to anon, authenticated;

revoke select on public.social_boost_service_pricing from anon, authenticated;
grant select (
  service_id, service_name, category, provider, default_price_per_1000, admin_price_per_1000,
  base_price_per_1000, max_reseller_price_per_1000, min_quantity, max_quantity,
  average_completion_time, notes, updated_at, updated_by
) on public.social_boost_service_pricing to anon, authenticated;
