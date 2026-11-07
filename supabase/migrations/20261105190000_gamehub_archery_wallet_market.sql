-- Archery 3D market: weapons, bow skins and gloves are bought with real wallet money (GH₵), not coins.

create table if not exists public.gamehub_archery_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('w', 's', 'g')),
  item_key text not null,
  price numeric not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_key)
);

alter table public.gamehub_archery_items enable row level security;

drop policy if exists "Players read their own archery items" on public.gamehub_archery_items;
create policy "Players read their own archery items"
  on public.gamehub_archery_items for select to authenticated
  using (user_id = auth.uid());

-- Authoritative price list in cedis. Lowest price is GH₵1.50.
create or replace function public.gamehub_archery_item_price(p_type text, p_key text)
returns numeric language sql immutable as $$
  select case p_type || ':' || p_key
    when 'w:knife' then 1.5
    when 'w:spear' then 2
    when 'w:xbow' then 3
    when 'w:rifle' then 5
    when 'w:rocket' then 8
    when 's:camo' then 1.5
    when 's:chrome' then 2.5
    when 's:carbon' then 3
    when 's:gold' then 5
    when 'g:leather' then 1.5
    when 'g:arctic' then 2
    when 'g:camo' then 2
    else null
  end;
$$;

create or replace function public.gamehub_archery_market(p_hint text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owned jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  select coalesce(jsonb_agg(item_type || ':' || item_key), '[]'::jsonb) into v_owned
    from public.gamehub_archery_items where user_id = auth.uid();
  return jsonb_build_object('owned', v_owned, 'balance', public.gamehub_wallet_balance(p_hint));
end $$;

create or replace function public.gamehub_buy_archery_item(p_type text, p_key text, p_hint text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  w jsonb;
  v_price numeric;
  v_owned jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to buy with your wallet'; end if;
  v_price := public.gamehub_archery_item_price(p_type, p_key);
  if v_price is null then raise exception 'This item is not for sale'; end if;

  if not exists (
    select 1 from public.gamehub_archery_items
    where user_id = auth.uid() and item_type = p_type and item_key = p_key
  ) then
    w := public.gamehub_resolve_wallet(p_hint);
    if w is null then raise exception 'No wallet found for this account'; end if;
    if (w ->> 'balance')::numeric < v_price then
      raise exception 'Insufficient wallet balance. Top up GH₵% to buy this item', v_price;
    end if;

    perform public.wallet_apply_internal(
      w ->> 'owner_type', (w ->> 'owner_id')::uuid, -v_price, 'gamehub_archery_item',
      auth.uid()::text || ':' || p_type || ':' || p_key,
      'Archery 3D market item (' || p_type || ':' || p_key || ')', auth.uid()
    );
    insert into public.gamehub_archery_items (user_id, item_type, item_key, price)
    values (auth.uid(), p_type, p_key, v_price);
  end if;

  select coalesce(jsonb_agg(item_type || ':' || item_key), '[]'::jsonb) into v_owned
    from public.gamehub_archery_items where user_id = auth.uid();
  return jsonb_build_object('owned', v_owned, 'balance', public.gamehub_wallet_balance(p_hint));
end $$;

grant execute on function public.gamehub_archery_market(text) to authenticated;
grant execute on function public.gamehub_buy_archery_item(text, text, text) to authenticated;
