-- 1) SMS number generator ---------------------------------------------------
-- Numbers are generated from valid Ghana MTN / Telecel prefixes, are never
-- numbers that already appear on an order, and are never issued twice.

create index if not exists idx_orders_customer_number_n9
  on public.orders (right(regexp_replace(customer_number, '\D', '', 'g'), 9));

create table if not exists public.generated_sms_numbers (
  number9 text primary key,
  phone_number text not null,
  network text not null check (network in ('mtn', 'telecel')),
  owner_type text not null,
  owner_id uuid not null,
  owner_user_id uuid not null,
  batch_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_generated_sms_numbers_owner
  on public.generated_sms_numbers (owner_user_id, created_at desc);

alter table public.generated_sms_numbers enable row level security;

drop policy if exists "owners read their generated numbers" on public.generated_sms_numbers;
create policy "owners read their generated numbers"
  on public.generated_sms_numbers for select to authenticated
  using (owner_user_id = auth.uid());

create or replace function public.generate_sms_numbers(
  p_owner_type text,
  p_owner_id uuid,
  p_count integer,
  p_network text default 'mixed'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := case when p_owner_type = 'sub_subagent' then 'subsubagent' else p_owner_type end;
  v_price numeric;
  v_owner uuid;
  v_batch uuid := gen_random_uuid();
  v_have integer := 0;
  v_added integer;
  v_attempt integer := 0;
  v_row public.wallet_ledger;
  v_numbers jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_type not in ('customer', 'agent', 'subagent', 'subsubagent') then
    raise exception 'Unsupported wallet owner type' using errcode = '22023';
  end if;
  if p_network not in ('mixed', 'mtn', 'telecel') then
    raise exception 'Invalid network' using errcode = '22023';
  end if;
  v_price := case p_count when 250 then 3 when 500 then 6 when 1000 then 12 else null end;
  if v_price is null then raise exception 'Invalid package size' using errcode = '22023'; end if;

  v_owner := public.wallet_resolve_own(v_type, p_owner_id);
  v_row := public.wallet_apply_internal(v_type, v_owner, -v_price, 'sms_numbers', v_batch::text,
    p_count || ' generated SMS numbers', auth.uid());

  while v_have < p_count and v_attempt < 12 loop
    v_attempt := v_attempt + 1;
    with others as materialized (
      select right(regexp_replace(k.customer_number, '\D', '', 'g'), 9) n9 from public.korba_transaction_history k
      union
      select right(regexp_replace(u.recipient_number, '\D', '', 'g'), 9) from public.ussd_transactions u
      union
      select right(regexp_replace(o.customer_number, '\D', '', 'g'), 9) from public.old_extracted_contacts o
    ), raw as (
      select g,
        case when p_network = 'mtn' then 'mtn'
             when p_network = 'telecel' then 'telecel'
             when random() < 0.5 then 'mtn' else 'telecel' end net
      from generate_series(1, (p_count - v_have) * 3 + 50) g
    ), cand as (
      select r.net,
        (case when r.net = 'mtn'
              then (array['24','54','55','59','25','53'])[1 + floor(random() * 6)::int]
              else (array['20','50'])[1 + floor(random() * 2)::int] end)
        || lpad((1000000 + floor(random() * 9000000))::bigint::text, 7, '0') n9
      from raw r
    ), fresh as (
      select distinct on (c.n9) c.n9, c.net
      from cand c
      where c.n9 !~ '^\d\d(\d)\1{6}$'
        and not exists (
          select 1 from public.orders o
          where right(regexp_replace(o.customer_number, '\D', '', 'g'), 9) = c.n9)
        and not exists (select 1 from others x where x.n9 = c.n9)
        and not exists (select 1 from public.generated_sms_numbers gn where gn.number9 = c.n9)
      limit (p_count - v_have)
    )
    insert into public.generated_sms_numbers (number9, phone_number, network, owner_type, owner_id, owner_user_id, batch_id)
    select f.n9, '0' || f.n9, f.net, v_type, v_owner, auth.uid(), v_batch from fresh f
    on conflict (number9) do nothing;
    get diagnostics v_added = row_count;
    v_have := v_have + v_added;
  end loop;

  if v_have < p_count then
    raise exception 'Could not generate enough fresh numbers. Your wallet was not charged.' using errcode = 'P0001';
  end if;

  select jsonb_agg(phone_number) into v_numbers from public.generated_sms_numbers where batch_id = v_batch;
  return jsonb_build_object('batch_id', v_batch, 'count', v_have, 'price', v_price,
    'balance_after', v_row.balance_after, 'numbers', v_numbers);
end;
$$;

revoke all on function public.generate_sms_numbers(text, uuid, integer, text) from public, anon;
grant execute on function public.generate_sms_numbers(text, uuid, integer, text) to authenticated;

-- 2) Admin golden product boost ----------------------------------------------
alter table public.store_products add column if not exists admin_boost boolean not null default false;
alter table public.public_store_products add column if not exists admin_boost boolean not null default false;

create or replace function public.admin_set_product_boost(p_source text, p_product_id uuid, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_source = 'store' then
    update public.store_products set admin_boost = p_enabled where id = p_product_id;
  elsif p_source = 'admin' then
    update public.public_store_products set admin_boost = p_enabled where id = p_product_id;
  else
    raise exception 'Invalid product source' using errcode = '22023';
  end if;
  if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
  return p_enabled;
end;
$$;

create or replace function public.admin_list_products(p_search text default '', p_page integer default 0, p_page_size integer default 20)
returns table(id uuid, source text, title text, description text, price numeric, store_kind text, status text,
  available boolean, admin_boost boolean, created_at timestamptz, first_image text, total_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return query
  with all_products as (
    select sp.id, 'store'::text src, sp.title, sp.description, sp.price, sp.store_kind, sp.status,
      sp.available, sp.admin_boost, sp.created_at, (sp.image_urls ->> 0) img
    from public.store_products sp
    union all
    select ap.id, 'admin'::text, ap.title, ap.description, ap.price, 'admin'::text,
      case when ap.active then 'active' else 'inactive' end, ap.active, ap.admin_boost, ap.created_at, ap.image_urls[1]
    from public.public_store_products ap
  )
  select a.id, a.src, a.title, a.description, a.price, a.store_kind, a.status, a.available, a.admin_boost, a.created_at,
    case when a.img is null or a.img like 'data:%' then null else a.img end,
    count(*) over ()
  from all_products a
  where coalesce(p_search, '') = '' or a.title ilike '%' || p_search || '%' or a.description ilike '%' || p_search || '%'
  order by a.admin_boost desc, a.created_at desc, a.id desc
  limit greatest(1, least(coalesce(p_page_size, 20), 50))
  offset greatest(coalesce(p_page, 0), 0) * greatest(1, least(coalesce(p_page_size, 20), 50));
end;
$$;

revoke all on function public.admin_set_product_boost(text, uuid, boolean) from public, anon;
revoke all on function public.admin_list_products(text, integer, integer) from public, anon;
grant execute on function public.admin_set_product_boost(text, uuid, boolean) to authenticated;
grant execute on function public.admin_list_products(text, integer, integer) to authenticated;

-- 3) Marketplace ordering: admin golden boost always first ---------------------
drop function if exists public.marketplace_products_page(text, integer, integer, text);

create function public.marketplace_products_page(p_search text default ''::text, p_page integer default 0, p_page_size integer default 18, p_sort text default 'newest'::text)
 returns table(id uuid, title text, description text, price numeric, image_urls jsonb, created_at timestamp with time zone, store_id uuid, store_kind text, boost_global boolean, boost_global_expires_at timestamp with time zone, boost_sitewide boolean, boost_sitewide_expires_at timestamp with time zone, total_count bigint, has_inline_image boolean, admin_boost boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with params as (
    select greatest(1, least(coalesce(p_page_size, 18), 50)) size, greatest(coalesce(p_page, 0), 0) pg, coalesce(p_search, '') q, coalesce(p_sort, 'newest') sort
  ), light as (
    select sp.id, 'store'::text src, sp.created_at, sp.price, sp.admin_boost,
      coalesce((sp.boost_global and sp.boost_global_expires_at > now()) or (sp.boost_sitewide and sp.boost_sitewide_expires_at > now()), false) boosted
    from public.store_products sp, params
    where sp.status = 'active' and sp.available = true
      and (params.q = '' or sp.title ilike '%' || params.q || '%' or sp.description ilike '%' || params.q || '%')
    union all
    select ap.id, 'admin'::text, ap.created_at, ap.price, ap.admin_boost, false
    from public.public_store_products ap, params
    where ap.active = true
      and (params.q = '' or ap.title ilike '%' || params.q || '%' or ap.description ilike '%' || params.q || '%')
  ), paged as (
    select l.*, count(*) over () total_count,
      row_number() over (order by
        case when l.admin_boost then 0 else 1 end,
        case when (select sort from params) = 'price_asc' then l.price end asc nulls last,
        case when (select sort from params) = 'price_desc' then l.price end desc nulls last,
        case when (select sort from params) in ('price_asc','price_desc') then 0 when l.boosted then 0 else 1 end,
        l.created_at desc, l.id desc) rn
    from light l
    order by rn
    limit (select size from params) offset (select pg * size from params)
  )
  select u.id, u.title, u.description, u.price,
    case when u.first_image is null or u.first_image like 'data:%' then '[]'::jsonb else jsonb_build_array(u.first_image) end,
    u.created_at, u.store_id, u.store_kind, u.boost_global, u.boost_global_expires_at, u.boost_sitewide, u.boost_sitewide_expires_at, u.total_count,
    coalesce(u.first_image like 'data:%', false), u.admin_boost
  from (
    select sp.id, sp.title, sp.description, sp.price, (sp.image_urls ->> 0) as first_image,
      sp.created_at, sp.store_id, sp.store_kind, sp.boost_global, sp.boost_global_expires_at, sp.boost_sitewide, sp.boost_sitewide_expires_at, p.total_count, p.rn, sp.admin_boost
    from paged p join public.store_products sp on p.src = 'store' and sp.id = p.id
    union all
    select ap.id, ap.title, ap.description, ap.price, ap.image_urls[1],
      ap.created_at, null::uuid, 'admin'::text, false, null::timestamptz, false, null::timestamptz, p.total_count, p.rn, ap.admin_boost
    from paged p join public.public_store_products ap on p.src = 'admin' and ap.id = p.id
  ) u
  order by u.rn;
$function$;

grant execute on function public.marketplace_products_page(text, integer, integer, text) to anon, authenticated;
