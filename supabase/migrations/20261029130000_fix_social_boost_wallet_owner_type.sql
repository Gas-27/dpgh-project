-- Plain users have no store row, so `SELECT ... INTO v_owner_type` reset the
-- owner type to NULL and the order insert failed. Resolve the store into
-- separate variables and only overwrite the owner type when a store is found.
create or replace function public.purchase_social_boost(
  p_platform text,
  p_service text,
  p_target_link text,
  p_quantity integer,
  p_provider_order_id text default null
) returns public.social_boost_orders
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_owner_type text := 'user';
  v_store_id uuid;
  v_wallet numeric;
  v_found_store uuid;
  v_found_wallet numeric;
  v_price numeric;
  v_amount numeric;
  v_order public.social_boost_orders;
  v_service_id integer;
  v_admin_price numeric;
  v_default_price numeric;
  v_max_price numeric;
  v_min_qty integer;
  v_max_qty integer;
  v_reseller_price numeric;
  v_link_error text;
  v_link text := trim(coalesce(p_target_link, ''));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be positive'; end if;

  v_link_error := public.validate_social_boost_link(p_platform, v_link);
  if v_link_error is not null then raise exception '%', v_link_error; end if;

  v_service_id := nullif(split_part(p_service, ':', 1), '')::integer;
  if v_service_id is null then raise exception 'Choose a valid Social Boost service'; end if;

  select admin_price_per_1000, default_price_per_1000, max_reseller_price_per_1000, min_quantity, max_quantity
    into v_admin_price, v_default_price, v_max_price, v_min_qty, v_max_qty
    from public.social_boost_service_pricing where service_id = v_service_id;
  if not found then raise exception 'This Social Boost service is not available'; end if;

  if p_quantity < coalesce(v_min_qty, 1) or p_quantity > coalesce(v_max_qty, 100000000) then
    raise exception 'This service accepts % to % only', coalesce(v_min_qty, 1), coalesce(v_max_qty, 100000000);
  end if;

  select id, wallet_balance into v_found_store, v_found_wallet
    from public.agent_stores where user_id = v_user order by created_at desc nulls last limit 1 for update;
  if v_found_store is not null then
    v_store_id := v_found_store; v_wallet := v_found_wallet; v_owner_type := 'agent';
  end if;

  if v_store_id is null then
    select id, wallet_balance into v_found_store, v_found_wallet
      from public.subagent_stores where user_id = v_user order by created_at desc nulls last limit 1 for update;
    if v_found_store is not null then
      v_store_id := v_found_store; v_wallet := v_found_wallet; v_owner_type := 'subagent';
    end if;
  end if;

  if v_store_id is null then
    select id, wallet_balance into v_found_store, v_found_wallet
      from public.sub_subagent_stores where user_id = v_user order by created_at desc nulls last limit 1 for update;
    if v_found_store is not null then
      v_store_id := v_found_store; v_wallet := v_found_wallet; v_owner_type := 'sub_subagent';
    end if;
  end if;

  if v_store_id is null then
    select wallet_balance into v_wallet from public.customers
      where user_id = v_user order by created_at desc nulls last limit 1 for update;
    v_owner_type := 'user';
  end if;

  if exists (
    select 1 from public.social_boost_orders o
    where o.user_id = v_user
      and split_part(o.service, ':', 1) = v_service_id::text
      and regexp_replace(lower(trim(o.target_link)), '/+$', '') = regexp_replace(lower(v_link), '/+$', '')
      and lower(coalesce(o.provider_status, '')) not in ('completed', 'complete', 'canceled', 'cancelled', 'failed', 'refunded', 'partial')
      and lower(coalesce(o.status, '')) not in ('completed', 'complete', 'canceled', 'cancelled', 'failed', 'refunded', 'partial')
  ) then
    raise exception 'You already have an active order for this link and service. Wait until it is completed, cancelled or failed before ordering again.';
  end if;

  if v_store_id is not null then
    select price_per_1000 into v_reseller_price from public.social_boost_reseller_pricing where user_id = v_user and service_id = v_service_id;
    v_price := coalesce(nullif(v_reseller_price, 0), nullif(v_default_price, 0), v_admin_price);
    if v_max_price is not null and v_max_price > 0 and v_price > v_max_price then v_price := v_max_price; end if;
  else
    v_price := v_admin_price;
  end if;

  if v_price is null or v_price <= 0 then raise exception 'Social Boost pricing is not configured'; end if;
  v_amount := round((p_quantity::numeric / 1000) * v_price, 3);
  if v_amount <= 0 then raise exception 'Order amount is below the minimum supported wallet value'; end if;
  if coalesce(v_wallet, 0) < v_amount then raise exception 'Insufficient wallet balance'; end if;

  if v_owner_type = 'agent' then update public.agent_stores set wallet_balance = wallet_balance - v_amount where id = v_store_id;
  elsif v_owner_type = 'subagent' then update public.subagent_stores set wallet_balance = wallet_balance - v_amount where id = v_store_id;
  elsif v_owner_type = 'sub_subagent' then update public.sub_subagent_stores set wallet_balance = wallet_balance - v_amount where id = v_store_id;
  else update public.customers set wallet_balance = wallet_balance - v_amount where user_id = v_user;
  end if;

  insert into public.social_boost_orders (
    user_id, owner_type, owner_store_id, platform, service, target_link, quantity, price_per_1000, amount,
    selling_amount, base_amount, profit_amount, seller_store_kind, seller_store_id, provider_order_id, provider_status
  ) values (
    v_user, v_owner_type, v_store_id, p_platform, p_service, v_link, p_quantity, v_price, v_amount,
    v_amount, v_price * p_quantity / 1000, 0, v_owner_type, v_store_id, p_provider_order_id, 'pending'
  ) returning * into v_order;

  return v_order;
end;
$function$;
