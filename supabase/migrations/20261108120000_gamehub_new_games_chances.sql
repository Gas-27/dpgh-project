-- New Game Hub reward games (Brain Memory, Sliding Tiles, Stop the Timer, Endless Runner),
-- admin-editable rules, wallet item market for the runner, consecutive-win cash-out tiers,
-- and store-front "chances" bought with a data package at the store owner's price.

alter table public.gamehub_game_settings
  add column if not exists chance_gb_single numeric not null default 1 check (chance_gb_single > 0),
  add column if not exists chance_gb_double numeric not null default 3 check (chance_gb_double > 0),
  add column if not exists tier1_level integer,
  add column if not exists tier1_reward_gb numeric,
  add column if not exists extra_config jsonb not null default '{}'::jsonb;

alter table public.gamehub_runs
  add column if not exists cashed_tier boolean not null default false;

insert into public.gamehub_game_settings (game_id, title, reward_gb, target_level, max_level, life_price, initial_lives, required_seconds, tier1_level, tier1_reward_gb, extra_config) values
  ('brain-memory',   'Brain Memory',   5, 15, 60, 4, 2, null, null, null, '{"seconds_scale":0.7}'),
  ('sliding-tiles',  'Sliding Tiles',  5, 30, 60, 4, 1, null, null, null, '{"shuffles":2}'),
  ('stop-timer',     'Stop the Timer', 8, 5,  10, 4, 1, null, 3,    2,    '{"free_seconds":60,"paid_seconds":120,"difficulty":"extreme"}'),
  ('endless-runner', 'Endless Runner', 5, 4,  20, 4, 1, null, null, null, '{}')
on conflict (game_id) do nothing;

create or replace function public.gamehub_min_seconds(p_game_id text, p_level integer)
returns numeric language sql immutable as $$
  select case p_game_id
    when 'cup-shuffle' then (array[9, 9, 10, 11, 11, 10, 13, 13, 14, 13, 14, 15])[least(greatest(p_level, 1), 12)]::numeric
    when 'snap-fit' then 1.6
    when 'nail-hit' then 0.75 + 0.15 * case when p_level % 5 = 0 then 10 else least(6 + p_level, 12) end
    when 'cut-score' then 3
    when 'brain-memory' then 3
    when 'sliding-tiles' then 4
    when 'stop-timer' then 2
    when 'endless-runner' then 40
    else 3600
  end;
$$;

create or replace function public.gamehub_run_json(r public.gamehub_runs)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'run_id', r.id,
    'game_id', r.game_id,
    'level', r.level,
    'lives', r.lives,
    'status', r.status,
    'target', public.gamehub_target_level(r.game_id),
    'lives_bought', r.lives_bought,
    'claimed', r.claimed,
    'reward_claimed', exists (select 1 from public.gamehub_claims c where c.user_id = r.user_id and c.game_id = r.game_id),
    'life_price', public.gamehub_life_price(r.game_id),
    'reward_gb', case when r.cashed_tier
        then coalesce((select s.tier1_reward_gb from public.gamehub_game_settings s where s.game_id = r.game_id), 2)
        else coalesce((select s.reward_gb from public.gamehub_game_settings s where s.game_id = r.game_id), 5) end,
    'reward_enabled', coalesce((select s.enabled from public.gamehub_game_settings s where s.game_id = r.game_id), true),
    'required_seconds', public.gamehub_required_seconds(r.game_id),
    'play_seconds', floor(r.play_seconds),
    'cashed_tier', r.cashed_tier,
    'tier1_level', (select s.tier1_level from public.gamehub_game_settings s where s.game_id = r.game_id),
    'tier1_reward_gb', (select s.tier1_reward_gb from public.gamehub_game_settings s where s.game_id = r.game_id),
    'config', coalesce((select s.extra_config from public.gamehub_game_settings s where s.game_id = r.game_id), '{}'::jsonb)
  );
$$;

-- Stop the Timer: a missed stop resets the winning streak back to level 1 (no life is spent).
create or replace function public.gamehub_reset_streak(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  update public.gamehub_runs set level = 1, level_started_at = now(), updated_at = now() where id = r.id returning * into r;
  return public.gamehub_run_json(r);
end $$;

-- Stop the Timer: after the first tier is reached the player may cash out the smaller reward.
create or replace function public.gamehub_cash_out(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs; v_tier integer;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  select s.tier1_level into v_tier from public.gamehub_game_settings s where s.game_id = r.game_id;
  if v_tier is null then raise exception 'This game has no early cash-out'; end if;
  if r.status <> 'active' or r.level < v_tier + 1 then raise exception 'Win % in a row to cash out', v_tier; end if;
  update public.gamehub_runs set status = 'cleared', cashed_tier = true, updated_at = now() where id = r.id returning * into r;
  return public.gamehub_run_json(r);
end $$;

create or replace function public.gamehub_claim_reward(p_run_id uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_package uuid;
  v_order uuid;
  v_gb numeric;
  v_tier_gb numeric;
  v_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to claim your reward'; end if;
  if length(v_phone) = 12 and left(v_phone, 3) = '233' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone !~ '^0(24|25|53|54|55|59)[0-9]{7}$' then raise exception 'Enter a valid MTN number (e.g. 0241234567)'; end if;

  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status = 'flagged' then raise exception 'This game session failed our fair-play checks and cannot claim a reward'; end if;
  if r.status <> 'cleared' or (r.level < public.gamehub_target_level(r.game_id) and not r.cashed_tier) then
    raise exception 'Finish the challenge to claim your reward';
  end if;
  if r.claimed then raise exception 'This reward was already claimed'; end if;
  if exists (select 1 from public.gamehub_claims where user_id = auth.uid() and game_id = r.game_id) then
    raise exception 'You have already claimed the reward for this game';
  end if;
  if exists (select 1 from public.gamehub_claims where phone = v_phone and game_id = r.game_id) then
    raise exception 'This number has already received this reward';
  end if;
  if (select count(*) from public.gamehub_claims where game_id = r.game_id and created_at > now() - interval '24 hours') >= 100 then
    raise exception 'Today''s reward pool is used up. Please try again tomorrow';
  end if;

  select reward_gb, enabled, tier1_reward_gb into v_gb, v_enabled, v_tier_gb from public.gamehub_game_settings where game_id = r.game_id;
  v_gb := case when r.cashed_tier then coalesce(v_tier_gb, 2) else coalesce(v_gb, 5) end;
  if coalesce(v_enabled, true) = false then raise exception 'Rewards for this game are paused right now'; end if;

  select id into v_package from public.data_packages where lower(network) = 'mtn' and size_gb = v_gb and active = true order by price asc limit 1;
  if v_package is null then raise exception 'The MTN %GB reward is unavailable right now', v_gb; end if;

  v_order := public.create_free_claim_order(v_phone, 'mtn', v_gb, v_package, null, null);
  insert into public.gamehub_claims (user_id, game_id, run_id, phone, order_id) values (auth.uid(), r.game_id, r.id, v_phone, v_order);
  update public.gamehub_runs set claimed = true, updated_at = now() where id = r.id;
  return jsonb_build_object('ok', true, 'order_id', v_order, 'phone', v_phone, 'reward_gb', v_gb);
end $$;

-- Admin: full rule editor including shuffles / chance packs / cash-out tier --------------
create or replace function public.admin_set_gamehub_rules_v2(
  p_game_id text,
  p_gb numeric,
  p_enabled boolean,
  p_target_level integer,
  p_life_price numeric,
  p_required_seconds integer,
  p_tier1_level integer,
  p_tier1_reward_gb numeric,
  p_chance_gb_single numeric,
  p_chance_gb_double numeric,
  p_extra_config jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.gamehub_game_settings;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  select * into s from public.gamehub_game_settings where game_id = p_game_id;
  if not found then raise exception 'Unknown game'; end if;
  if p_gb is null or p_gb <= 0 then raise exception 'Enter a reward size above 0 GB'; end if;
  if p_life_price is null or p_life_price <= 0 or p_life_price > 500 then raise exception 'Enter a life price between GH₵0.01 and GH₵500'; end if;
  if p_chance_gb_single is null or p_chance_gb_single <= 0 or p_chance_gb_double is null or p_chance_gb_double <= 0 then
    raise exception 'Chance packs must be above 0 GB';
  end if;
  if s.required_seconds is null then
    if p_target_level is null or p_target_level < 1 or p_target_level > coalesce(s.max_level, 1) then
      raise exception 'Level must be between 1 and % for this game', coalesce(s.max_level, 1);
    end if;
  elsif p_required_seconds is null or p_required_seconds < 30 or p_required_seconds > 3600 then
    raise exception 'Play time must be between 30 seconds and 60 minutes';
  end if;
  if p_tier1_level is not null and (p_tier1_level < 1 or p_tier1_level >= coalesce(p_target_level, s.target_level)) then
    raise exception 'Cash-out level must be below the final level';
  end if;
  if not exists (select 1 from public.data_packages where lower(network) = 'mtn' and size_gb = p_gb and active = true) then
    raise exception 'There is no active MTN % GB package. Pick a size that exists in your MTN packages', p_gb;
  end if;
  if p_tier1_level is not null and not exists (select 1 from public.data_packages where lower(network) = 'mtn' and size_gb = p_tier1_reward_gb and active = true) then
    raise exception 'There is no active MTN % GB package for the cash-out reward', p_tier1_reward_gb;
  end if;
  update public.gamehub_game_settings
    set reward_gb = p_gb,
        enabled = coalesce(p_enabled, true),
        life_price = p_life_price,
        target_level = case when required_seconds is null then p_target_level else target_level end,
        required_seconds = case when required_seconds is null then null else p_required_seconds end,
        tier1_level = p_tier1_level,
        tier1_reward_gb = case when p_tier1_level is null then null else p_tier1_reward_gb end,
        chance_gb_single = p_chance_gb_single,
        chance_gb_double = p_chance_gb_double,
        extra_config = coalesce(p_extra_config, extra_config),
        updated_at = now(), updated_by = auth.uid()
    where game_id = p_game_id returning * into s;
  return to_jsonb(s);
end $$;

-- Wallet item market for games with shops (Endless Runner) ----------------------------
create table if not exists public.gamehub_game_items (
  user_id uuid not null,
  game_id text not null,
  item_type text not null,
  item_key text not null,
  qty integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id, item_type, item_key)
);
alter table public.gamehub_game_items enable row level security;
revoke all on public.gamehub_game_items from anon, authenticated;

create or replace function public.gamehub_game_item_price(p_game_id text, p_type text, p_key text)
returns numeric language sql immutable as $$
  select (case when p_game_id = 'endless-runner' then (jsonb_build_object(
    'skin:ghana',150,'skin:zombie',350,'skin:ninja',400,'skin:alien',500,'skin:santa',600,'skin:neon',700,'skin:hero',800,'skin:trex',1200,'skin:gold',1500,'skin:rainbow',2000,
    'car:taxi',300,'car:bus',500,'car:cop',700,'car:fire',900,'car:sport',1200,'car:monster',1600,
    'plane:biplane',350,'plane:chopper',600,'plane:fighter',900,'plane:ufo',1300,'plane:shuttle',1800,
    'boat:jetski',300,'boat:sail',450,'boat:yacht',700,'boat:pirate',1000,'boat:sub',1500,
    'boost:shield',120,'boost:dbl',200
  ) ->> (p_type || ':' || p_key))::numeric / 100 else null end);
$$;

create or replace function public.gamehub_game_market(p_game_id text, p_hint text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owned jsonb; v_inv jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('owned', '[]'::jsonb, 'inv', '{}'::jsonb, 'balance', null); end if;
  select coalesce(jsonb_agg(item_type || ':' || item_key), '[]'::jsonb) into v_owned
    from public.gamehub_game_items where user_id = auth.uid() and game_id = p_game_id and item_type <> 'boost';
  select coalesce(jsonb_object_agg(item_key, qty), '{}'::jsonb) into v_inv
    from public.gamehub_game_items where user_id = auth.uid() and game_id = p_game_id and item_type = 'boost';
  return jsonb_build_object('owned', v_owned, 'inv', v_inv, 'balance', public.gamehub_wallet_balance(p_hint));
end $$;

create or replace function public.gamehub_buy_game_item(p_game_id text, p_type text, p_key text, p_hint text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w jsonb; v_price numeric;
begin
  if auth.uid() is null then raise exception 'Sign in to buy with your wallet'; end if;
  v_price := public.gamehub_game_item_price(p_game_id, p_type, p_key);
  if v_price is null then raise exception 'Unknown item'; end if;
  if p_type <> 'boost' and exists (select 1 from public.gamehub_game_items where user_id = auth.uid() and game_id = p_game_id and item_type = p_type and item_key = p_key) then
    raise exception 'You already own this item';
  end if;
  w := public.gamehub_resolve_wallet(p_hint);
  if w is null then raise exception 'No wallet found for this account'; end if;
  if (w ->> 'balance')::numeric < v_price then raise exception 'Insufficient wallet balance. Top up GH₵% to buy this', v_price; end if;
  perform public.wallet_apply_internal(
    w ->> 'owner_type', (w ->> 'owner_id')::uuid, -v_price, 'gamehub_item',
    p_game_id || ':' || p_type || ':' || p_key || ':' || extract(epoch from clock_timestamp())::text,
    'Game Hub item (' || p_game_id || ' ' || p_type || ' ' || p_key || ')', auth.uid()
  );
  insert into public.gamehub_game_items as i (user_id, game_id, item_type, item_key, qty)
    values (auth.uid(), p_game_id, p_type, p_key, 1)
    on conflict (user_id, game_id, item_type, item_key) do update set qty = i.qty + 1;
  return public.gamehub_game_market(p_game_id, p_hint);
end $$;

create or replace function public.gamehub_consume_game_item(p_game_id text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.gamehub_game_items set qty = qty - 1
    where user_id = auth.uid() and game_id = p_game_id and item_type = 'boost' and item_key = p_key and qty > 0;
end $$;

-- Store-front chances: a data-package purchase grants extra lives on the player's exact run ---
create table if not exists public.gamehub_chance_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id text not null,
  run_id uuid,
  chances integer not null check (chances in (1, 2)),
  gb numeric not null,
  store_kind text,
  store_id uuid,
  order_id uuid,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.gamehub_chance_orders enable row level security;
revoke all on public.gamehub_chance_orders from anon, authenticated;

create or replace function public.gamehub_chance_packs(p_game_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'single_gb', coalesce(s.chance_gb_single, 1), 'single_chances', 1,
    'double_gb', coalesce(s.chance_gb_double, 3), 'double_chances', 2)
  from (select 1) d left join public.gamehub_game_settings s on s.game_id = p_game_id;
$$;

create or replace function public.gamehub_create_chance_order(p_run_id uuid, p_chances integer, p_store_kind text, p_store_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs; v_gb numeric; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to buy a chance'; end if;
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid();
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  select case when p_chances = 2 then chance_gb_double else chance_gb_single end into v_gb
    from public.gamehub_game_settings where game_id = r.game_id;
  if v_gb is null then raise exception 'This game does not sell chances'; end if;
  insert into public.gamehub_chance_orders (user_id, game_id, run_id, chances, gb, store_kind, store_id)
    values (auth.uid(), r.game_id, r.id, case when p_chances = 2 then 2 else 1 end, v_gb, p_store_kind, p_store_id)
    returning id into v_id;
  return jsonb_build_object('chance_order_id', v_id, 'game_id', r.game_id, 'gb', v_gb, 'chances', case when p_chances = 2 then 2 else 1 end);
end $$;

-- Called by the order flow once the chance data order is paid; idempotent.
create or replace function public.gamehub_apply_chance_order(p_chance_order_id uuid, p_order_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.gamehub_chance_orders; r public.gamehub_runs;
begin
  select * into c from public.gamehub_chance_orders where id = p_chance_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Chance order not found'; end if;
  if c.applied then
    select * into r from public.gamehub_runs where id = c.run_id;
    return jsonb_build_object('ok', true, 'run', public.gamehub_run_json(r), 'game_id', c.game_id);
  end if;
  if p_order_id is null or not exists (
    select 1 from public.orders o where o.id = p_order_id and o.status in ('completed', 'processing', 'paid', 'pending_processing')
  ) then
    raise exception 'Payment for this chance has not been confirmed yet';
  end if;
  update public.gamehub_runs set lives = lives + c.chances, updated_at = now()
    where id = c.run_id and status = 'active' returning * into r;
  if not found then raise exception 'Game session is no longer active'; end if;
  update public.gamehub_chance_orders set applied = true, order_id = p_order_id where id = c.id;
  return jsonb_build_object('ok', true, 'run', public.gamehub_run_json(r), 'game_id', c.game_id);
end $$;

revoke all on function
  public.gamehub_reset_streak(uuid), public.gamehub_cash_out(uuid),
  public.admin_set_gamehub_rules_v2(text, numeric, boolean, integer, numeric, integer, integer, numeric, numeric, numeric, jsonb),
  public.gamehub_game_market(text, text), public.gamehub_buy_game_item(text, text, text, text),
  public.gamehub_consume_game_item(text, text), public.gamehub_chance_packs(text),
  public.gamehub_create_chance_order(uuid, integer, text, uuid), public.gamehub_apply_chance_order(uuid, uuid)
from public, anon;
grant execute on function
  public.gamehub_reset_streak(uuid), public.gamehub_cash_out(uuid),
  public.admin_set_gamehub_rules_v2(text, numeric, boolean, integer, numeric, integer, integer, numeric, numeric, numeric, jsonb),
  public.gamehub_game_market(text, text), public.gamehub_buy_game_item(text, text, text, text),
  public.gamehub_consume_game_item(text, text),
  public.gamehub_create_chance_order(uuid, integer, text, uuid), public.gamehub_apply_chance_order(uuid, uuid)
to authenticated;
grant execute on function public.gamehub_chance_packs(text) to anon, authenticated;
