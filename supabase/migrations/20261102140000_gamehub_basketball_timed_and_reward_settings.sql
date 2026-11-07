-- Basketball "get free data" (10 minutes, one life, no misses) and admin-controlled reward size per game.

create table if not exists public.gamehub_game_settings (
  game_id text primary key,
  title text not null,
  reward_gb numeric not null default 5 check (reward_gb > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.gamehub_game_settings (game_id, title, reward_gb) values
  ('cup-shuffle', 'Cup Shuffle', 5),
  ('snap-fit', 'Snap Fit', 5),
  ('basketball', 'Basketball', 5)
on conflict (game_id) do nothing;

alter table public.gamehub_game_settings enable row level security;
drop policy if exists "Anyone reads gamehub game settings" on public.gamehub_game_settings;
create policy "Anyone reads gamehub game settings" on public.gamehub_game_settings for select to anon, authenticated using (true);
revoke all on public.gamehub_game_settings from anon, authenticated;
grant select on public.gamehub_game_settings to anon, authenticated;

alter table public.gamehub_runs
  add column if not exists play_seconds numeric not null default 0,
  add column if not exists last_tick_at timestamptz;

-- Rules ------------------------------------------------------------------
create or replace function public.gamehub_target_level(p_game_id text)
returns integer language sql immutable as $$
  select case p_game_id when 'cup-shuffle' then 12 when 'snap-fit' then 20 when 'basketball' then 1 else null end;
$$;

create or replace function public.gamehub_required_seconds(p_game_id text)
returns integer language sql immutable as $$
  select case p_game_id when 'basketball' then 600 else null end;
$$;

create or replace function public.gamehub_initial_lives(p_game_id text)
returns integer language sql immutable as $$
  select case p_game_id when 'basketball' then 1 else 2 end;
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
    'life_price', 4,
    'reward_gb', coalesce((select s.reward_gb from public.gamehub_game_settings s where s.game_id = r.game_id), 5),
    'reward_enabled', coalesce((select s.enabled from public.gamehub_game_settings s where s.game_id = r.game_id), true),
    'required_seconds', public.gamehub_required_seconds(r.game_id),
    'play_seconds', floor(r.play_seconds)
  );
$$;

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
      update public.gamehub_runs
        set wallet_hint = coalesce(p_wallet_hint, wallet_hint),
            last_tick_at = null,
            updated_at = now()
        where id = r.id returning * into r;
      return public.gamehub_run_json(r);
    end if;
    update public.gamehub_runs set status = 'abandoned', last_tick_at = null, updated_at = now() where id = r.id;
  end if;

  if (select count(*) from public.gamehub_runs where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 25 then
    raise exception 'Too many new games. Please wait a few minutes and try again';
  end if;

  insert into public.gamehub_runs (user_id, game_id, wallet_hint, lives)
    values (auth.uid(), p_game_id, p_wallet_hint, public.gamehub_initial_lives(p_game_id)) returning * into r;
  return public.gamehub_run_json(r);
end $$;

-- Timed games: the server counts play time from heartbeats, never from a number the page reports.
create or replace function public.gamehub_timed_begin(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if public.gamehub_required_seconds(r.game_id) is null then raise exception 'This game is not timed'; end if;
  if r.status = 'active' and r.lives > 0 and r.last_tick_at is null then
    update public.gamehub_runs set last_tick_at = now(), updated_at = now() where id = r.id returning * into r;
  end if;
  return public.gamehub_run_json(r);
end $$;

create or replace function public.gamehub_timed_tick(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status = 'active' and r.last_tick_at is not null then
    update public.gamehub_runs
      set play_seconds = play_seconds + least(extract(epoch from (now() - last_tick_at)), 15),
          last_tick_at = now(),
          updated_at = now()
      where id = r.id returning * into r;
  end if;
  return public.gamehub_run_json(r);
end $$;

create or replace function public.gamehub_lose_life(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  if r.last_tick_at is not null then
    update public.gamehub_runs
      set play_seconds = play_seconds + least(extract(epoch from (now() - last_tick_at)), 15),
          last_tick_at = null
      where id = r.id returning * into r;
  end if;
  if r.lives > 0 then
    update public.gamehub_runs set lives = lives - 1, updated_at = now() where id = r.id returning * into r;
  end if;
  return public.gamehub_run_json(r);
end $$;

create or replace function public.gamehub_complete_level(p_run_id uuid, p_level integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  v_elapsed numeric;
  v_target integer;
  v_required integer;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  if r.lives <= 0 then raise exception 'Out of lives'; end if;
  if p_level is distinct from r.level then raise exception 'Level out of sync'; end if;

  v_target := public.gamehub_target_level(r.game_id);
  v_required := public.gamehub_required_seconds(r.game_id);

  if v_required is not null then
    if r.last_tick_at is not null then
      update public.gamehub_runs
        set play_seconds = play_seconds + least(extract(epoch from (now() - last_tick_at)), 15),
            last_tick_at = now()
        where id = r.id returning * into r;
    end if;
    if r.play_seconds < v_required - 5 then
      if r.play_seconds < v_required * 0.5 then
        insert into public.gamehub_flags (user_id, run_id, game_id, reason)
          values (auth.uid(), r.id, r.game_id, format('claimed completion after only %ss of %ss', round(r.play_seconds), v_required));
        update public.gamehub_runs
          set suspicion = suspicion + 1,
              status = case when suspicion + 1 >= 3 then 'flagged' else status end,
              updated_at = now()
          where id = r.id returning * into r;
      end if;
      return jsonb_build_object('ok', false, 'reason', 'keep_playing', 'run', public.gamehub_run_json(r));
    end if;
    update public.gamehub_runs set status = 'cleared', last_tick_at = null, updated_at = now() where id = r.id returning * into r;
    return jsonb_build_object('ok', true, 'run', public.gamehub_run_json(r));
  end if;

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

create or replace function public.gamehub_claim_reward(p_run_id uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_package uuid;
  v_order uuid;
  v_gb numeric;
  v_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to claim your reward'; end if;
  if length(v_phone) = 12 and left(v_phone, 3) = '233' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone !~ '^0(24|25|53|54|55|59)[0-9]{7}$' then raise exception 'Enter a valid MTN number (e.g. 0241234567)'; end if;

  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status = 'flagged' then raise exception 'This game session failed our fair-play checks and cannot claim a reward'; end if;
  if r.status <> 'cleared' or r.level < public.gamehub_target_level(r.game_id) then raise exception 'Finish the challenge to claim your reward'; end if;
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

  select reward_gb, enabled into v_gb, v_enabled from public.gamehub_game_settings where game_id = r.game_id;
  v_gb := coalesce(v_gb, 5);
  if coalesce(v_enabled, true) = false then raise exception 'Rewards for this game are paused right now'; end if;

  select id into v_package from public.data_packages where lower(network) = 'mtn' and size_gb = v_gb and active = true order by price asc limit 1;
  if v_package is null then raise exception 'The MTN %GB reward is unavailable right now', v_gb; end if;

  v_order := public.create_free_claim_order(v_phone, 'mtn', v_gb, v_package, null, null);
  insert into public.gamehub_claims (user_id, game_id, run_id, phone, order_id) values (auth.uid(), r.game_id, r.id, v_phone, v_order);
  update public.gamehub_runs set claimed = true, updated_at = now() where id = r.id;
  return jsonb_build_object('ok', true, 'order_id', v_order, 'phone', v_phone, 'reward_gb', v_gb);
end $$;

-- Admin ------------------------------------------------------------------
create or replace function public.admin_set_gamehub_reward(p_game_id text, p_gb numeric, p_enabled boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.gamehub_game_settings;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if p_gb is null or p_gb <= 0 then raise exception 'Enter a reward size above 0 GB'; end if;
  if not exists (select 1 from public.data_packages where lower(network) = 'mtn' and size_gb = p_gb and active = true) then
    raise exception 'There is no active MTN % GB package. Pick a size that exists in your MTN packages', p_gb;
  end if;
  update public.gamehub_game_settings
    set reward_gb = p_gb, enabled = coalesce(p_enabled, true), updated_at = now(), updated_by = auth.uid()
    where game_id = p_game_id returning * into s;
  if not found then raise exception 'Unknown game'; end if;
  return to_jsonb(s);
end $$;

revoke all on function
  public.gamehub_required_seconds(text),
  public.gamehub_initial_lives(text),
  public.gamehub_timed_begin(uuid),
  public.gamehub_timed_tick(uuid),
  public.admin_set_gamehub_reward(text, numeric, boolean)
from public, anon;

grant execute on function
  public.gamehub_timed_begin(uuid),
  public.gamehub_timed_tick(uuid),
  public.admin_set_gamehub_reward(text, numeric, boolean)
to authenticated;
