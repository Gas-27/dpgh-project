-- Game Hub native games (Cup Shuffle, Snap Fit): server-authoritative runs, lives, wallet life purchases and the 5GB reward.
-- Clients never write these tables directly; every state change goes through the security-definer functions below.

create table if not exists public.gamehub_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  wallet_hint text,
  level integer not null default 1,
  lives integer not null default 2 check (lives >= 0),
  status text not null default 'active' check (status in ('active', 'cleared', 'over', 'abandoned', 'flagged')),
  suspicion integer not null default 0,
  lives_bought integer not null default 0,
  claimed boolean not null default false,
  level_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gamehub_runs_user_game_idx on public.gamehub_runs (user_id, game_id, created_at desc);

create table if not exists public.gamehub_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  run_id uuid not null references public.gamehub_runs(id),
  phone text not null,
  order_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, game_id),
  unique (phone, game_id)
);

create table if not exists public.gamehub_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  run_id uuid,
  game_id text,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.gamehub_runs enable row level security;
alter table public.gamehub_claims enable row level security;
alter table public.gamehub_flags enable row level security;

drop policy if exists "Users read own gamehub runs" on public.gamehub_runs;
create policy "Users read own gamehub runs" on public.gamehub_runs for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users read own gamehub claims" on public.gamehub_claims;
create policy "Users read own gamehub claims" on public.gamehub_claims for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins read gamehub flags" on public.gamehub_flags;
create policy "Admins read gamehub flags" on public.gamehub_flags for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins read gamehub claims" on public.gamehub_claims;
create policy "Admins read gamehub claims" on public.gamehub_claims for select to authenticated using (public.has_role(auth.uid(), 'admin'));

revoke all on public.gamehub_runs, public.gamehub_claims, public.gamehub_flags from anon, authenticated;
grant select on public.gamehub_runs, public.gamehub_claims, public.gamehub_flags to authenticated;

-- Rules ------------------------------------------------------------------
create or replace function public.gamehub_target_level(p_game_id text)
returns integer language sql immutable as $$
  select case p_game_id when 'cup-shuffle' then 12 when 'snap-fit' then 20 else null end;
$$;

-- Lower bound (seconds) a human needs for a level; roughly 60% of the fastest possible play time.
create or replace function public.gamehub_min_seconds(p_game_id text, p_level integer)
returns numeric language sql immutable as $$
  select case p_game_id
    when 'cup-shuffle' then (array[9, 9, 10, 11, 11, 10, 13, 13, 14, 13, 14, 15])[least(greatest(p_level, 1), 12)]::numeric
    when 'snap-fit' then 1.6
    else 3600
  end;
$$;

create or replace function public.gamehub_resolve_wallet(p_hint text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_types text[] := array['customer', 'agent', 'subagent', 'subsubagent'];
  v_type text;
  v_id uuid;
  v_balance numeric;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  if p_hint = any (v_types) then
    v_types := array[p_hint] || array_remove(v_types, p_hint);
  end if;
  foreach v_type in array v_types loop
    v_id := null;
    if v_type = 'customer' then
      select c.id, coalesce(c.wallet_balance, 0) into v_id, v_balance from public.customers c where c.user_id = auth.uid() limit 1;
    elsif v_type = 'agent' then
      select s.id, coalesce(s.wallet_balance, 0) into v_id, v_balance from public.agent_stores s where s.user_id = auth.uid() limit 1;
    elsif v_type = 'subagent' then
      select s.id, coalesce(s.wallet_balance, 0) into v_id, v_balance from public.subagent_stores s where s.user_id = auth.uid() limit 1;
    else
      select s.id, coalesce(s.wallet_balance, 0) into v_id, v_balance from public.sub_subagent_stores s where s.user_id = auth.uid() limit 1;
    end if;
    if v_id is not null then
      return jsonb_build_object('owner_type', v_type, 'owner_id', v_id, 'balance', v_balance);
    end if;
  end loop;
  return null;
end $$;

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
    'life_price', 4
  );
$$;

create or replace function public.gamehub_wallet_balance(p_hint text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.gamehub_resolve_wallet(p_hint);
  if v is null then return null; end if;
  return (v ->> 'balance')::numeric;
end $$;

-- Run lifecycle -----------------------------------------------------------
create or replace function public.gamehub_start_run(p_game_id text, p_wallet_hint text default null, p_force_new boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  if auth.uid() is null then raise exception 'Sign in to play and win rewards'; end if;
  if public.gamehub_target_level(p_game_id) is null then raise exception 'This game has no rewards'; end if;

  select * into r from public.gamehub_runs
    where user_id = auth.uid() and game_id = p_game_id and status in ('active', 'cleared') and claimed = false
    order by created_at desc limit 1 for update;
  if found then
    if not p_force_new then
      if p_wallet_hint is not null and p_wallet_hint is distinct from r.wallet_hint then
        update public.gamehub_runs set wallet_hint = p_wallet_hint where id = r.id returning * into r;
      end if;
      return public.gamehub_run_json(r);
    end if;
    update public.gamehub_runs set status = 'abandoned', updated_at = now() where id = r.id;
  end if;

  if (select count(*) from public.gamehub_runs where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 25 then
    raise exception 'Too many new games. Please wait a few minutes and try again';
  end if;

  insert into public.gamehub_runs (user_id, game_id, wallet_hint) values (auth.uid(), p_game_id, p_wallet_hint) returning * into r;
  return public.gamehub_run_json(r);
end $$;

create or replace function public.gamehub_complete_level(p_run_id uuid, p_level integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  v_elapsed numeric;
  v_target integer;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  if r.lives <= 0 then raise exception 'Out of lives'; end if;
  if p_level is distinct from r.level then raise exception 'Level out of sync'; end if;

  v_elapsed := extract(epoch from (now() - r.level_started_at));
  if v_elapsed < public.gamehub_min_seconds(r.game_id, r.level) then
    insert into public.gamehub_flags (user_id, run_id, game_id, reason)
      values (auth.uid(), r.id, r.game_id, format('level %s finished in %ss', r.level, round(v_elapsed, 2)));
    update public.gamehub_runs
      set suspicion = suspicion + 1,
          status = case when suspicion + 1 >= 3 then 'flagged' else status end,
          level_started_at = now(),
          updated_at = now()
      where id = r.id returning * into r;
    return jsonb_build_object('ok', false, 'reason', 'too_fast', 'run', public.gamehub_run_json(r));
  end if;

  v_target := public.gamehub_target_level(r.game_id);
  insert into public.gamehub_scores as s (user_id, game_id, score, updated_at)
    values (auth.uid(), r.game_id, r.level * 100, now())
    on conflict (user_id, game_id) do update
      set score = greatest(s.score, excluded.score),
          updated_at = case when excluded.score > s.score then now() else s.updated_at end;

  if r.level >= v_target then
    update public.gamehub_runs set status = 'cleared', level_started_at = now(), updated_at = now() where id = r.id returning * into r;
  else
    update public.gamehub_runs set level = level + 1, level_started_at = now(), updated_at = now() where id = r.id returning * into r;
  end if;
  return jsonb_build_object('ok', true, 'run', public.gamehub_run_json(r));
end $$;

create or replace function public.gamehub_lose_life(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  if r.lives > 0 then
    update public.gamehub_runs set lives = lives - 1, updated_at = now() where id = r.id returning * into r;
  end if;
  return public.gamehub_run_json(r);
end $$;

create or replace function public.gamehub_buy_life(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  w jsonb;
  v_price constant numeric := 4;
  v_balance numeric;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  if r.lives > 0 then raise exception 'You still have lives left'; end if;

  w := public.gamehub_resolve_wallet(r.wallet_hint);
  if w is null then raise exception 'No wallet found for this account'; end if;
  if (w ->> 'balance')::numeric < v_price then
    raise exception 'Insufficient wallet balance. Top up GH₵% to buy a life', v_price;
  end if;

  perform public.wallet_apply_internal(
    w ->> 'owner_type', (w ->> 'owner_id')::uuid, -v_price, 'gamehub_life',
    r.id::text || ':' || (r.lives_bought + 1)::text, 'Game Hub extra life (' || r.game_id || ')', auth.uid()
  );
  update public.gamehub_runs set lives = 1, lives_bought = lives_bought + 1, updated_at = now() where id = r.id returning * into r;
  v_balance := public.gamehub_wallet_balance(r.wallet_hint);
  return jsonb_build_object('run', public.gamehub_run_json(r), 'balance', v_balance);
end $$;

create or replace function public.gamehub_end_run(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  update public.gamehub_runs set status = 'over', updated_at = now()
    where id = p_run_id and user_id = auth.uid() and status = 'active'
    returning * into r;
  if not found then
    select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid();
    if not found then raise exception 'Game session not found'; end if;
  end if;
  return public.gamehub_run_json(r);
end $$;

create or replace function public.gamehub_claim_reward(p_run_id uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_package uuid;
  v_order uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to claim your reward'; end if;
  if length(v_phone) = 12 and left(v_phone, 3) = '233' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone !~ '^0(24|25|53|54|55|59)[0-9]{7}$' then raise exception 'Enter a valid MTN number (e.g. 0241234567)'; end if;

  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status = 'flagged' then raise exception 'This game session failed our fair-play checks and cannot claim a reward'; end if;
  if r.status <> 'cleared' or r.level < public.gamehub_target_level(r.game_id) then raise exception 'Finish every level to claim your reward'; end if;
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

  select id into v_package from public.data_packages where lower(network) = 'mtn' and size_gb = 5 and active = true limit 1;
  if v_package is null then raise exception 'The MTN 5GB reward is unavailable right now'; end if;

  v_order := public.create_free_claim_order(v_phone, 'mtn', 5, v_package, null, null);
  insert into public.gamehub_claims (user_id, game_id, run_id, phone, order_id) values (auth.uid(), r.game_id, r.id, v_phone, v_order);
  update public.gamehub_runs set claimed = true, updated_at = now() where id = r.id;
  return jsonb_build_object('ok', true, 'order_id', v_order, 'phone', v_phone);
end $$;

revoke all on function
  public.gamehub_resolve_wallet(text),
  public.gamehub_run_json(public.gamehub_runs),
  public.gamehub_wallet_balance(text),
  public.gamehub_start_run(text, text, boolean),
  public.gamehub_complete_level(uuid, integer),
  public.gamehub_lose_life(uuid),
  public.gamehub_buy_life(uuid),
  public.gamehub_end_run(uuid),
  public.gamehub_claim_reward(uuid, text)
from public, anon;

grant execute on function
  public.gamehub_wallet_balance(text),
  public.gamehub_start_run(text, text, boolean),
  public.gamehub_complete_level(uuid, integer),
  public.gamehub_lose_life(uuid),
  public.gamehub_buy_life(uuid),
  public.gamehub_end_run(uuid),
  public.gamehub_claim_reward(uuid, text)
to authenticated;
