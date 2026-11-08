-- Game Hub: server-side idle pause for timed games and client integrity reports.

alter table public.gamehub_runs add column if not exists last_activity_at timestamptz;

-- Idle time is never credited: a timed game with activity enforcement only earns clock time
-- while the player keeps throwing (activity seen within the last 12 seconds).
create or replace function public.gamehub_play_credit(r public.gamehub_runs)
returns numeric language sql stable security definer set search_path = '' as $$
  select case
    when r.last_tick_at is null then 0
    when public.gamehub_requires_activity(r.game_id)
         and (coalesce(r.last_activity_at, r.last_shot_at) is null
              or coalesce(r.last_activity_at, r.last_shot_at) < now() - interval '12 seconds') then 0
    else least(extract(epoch from (now() - r.last_tick_at)), 15)
  end
$$;

update public.gamehub_game_settings set require_activity = true where game_id = 'basketball';

-- Starting or resuming the clock counts as activity.
create or replace function public.gamehub_timed_begin(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if public.gamehub_required_seconds(r.game_id) is null then raise exception 'This game is not timed'; end if;
  if r.status = 'active' and r.lives > 0 and r.last_tick_at is null then
    update public.gamehub_runs
       set last_tick_at = now(), last_activity_at = now(), updated_at = now()
     where id = r.id returning * into r;
  end if;
  return public.gamehub_run_json(r);
end $$;

-- Stops the clock (idle player, game over screen) after crediting the time already played.
create or replace function public.gamehub_timed_pause(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status = 'active' and r.last_tick_at is not null then
    update public.gamehub_runs
       set play_seconds = play_seconds + public.gamehub_play_credit(r), last_tick_at = null, updated_at = now()
     where id = r.id returning * into r;
  end if;
  return public.gamehub_run_json(r);
end $$;

-- Every throw (made or missed) keeps the clock alive.
create or replace function public.gamehub_timed_activity(p_run_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.gamehub_runs
     set last_activity_at = now()
   where id = p_run_id and user_id = auth.uid() and status = 'active' and last_tick_at is not null
     and coalesce(last_activity_at, '-infinity'::timestamptz) < now() - interval '0.25 seconds';
end $$;

-- Made shots also count as activity.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gamehub_record_shot(uuid)'::regprocedure) into d;
  d := replace(d, $a$last_shot_at = now(), updated_at = now()$a$, $b$last_shot_at = now(), last_activity_at = now(), updated_at = now()$b$);
  execute d;
end
$do$;

-- Tamper signals from the game page. Honest play never triggers these, so they weigh heavily.
create or replace function public.gamehub_report_integrity(p_run_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.gamehub_runs; v_weight integer; v_reason text := 'client integrity: ' || coalesce(p_kind, '');
begin
  v_weight := case p_kind when 'automation' then 3 when 'speed_hack' then 2 when 'synthetic_input' then 2 when 'tamper' then 1 else null end;
  if v_weight is null then raise exception 'Unknown report'; end if;
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then return public.gamehub_run_json(r); end if;
  if exists (select 1 from public.gamehub_flags where run_id = r.id and reason = v_reason) then
    return public.gamehub_run_json(r);
  end if;
  insert into public.gamehub_flags (user_id, run_id, game_id, reason) values (auth.uid(), r.id, r.game_id, v_reason);
  update public.gamehub_runs
     set suspicion = suspicion + v_weight,
         status = case when suspicion + v_weight >= 3 then 'flagged' else status end,
         last_tick_at = case when suspicion + v_weight >= 3 then null else last_tick_at end,
         updated_at = now()
   where id = r.id returning * into r;
  return public.gamehub_run_json(r);
end $$;

-- Players with repeated flagged sessions cannot claim rewards.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gamehub_claim_reward(uuid,text)'::regprocedure) into d;
  d := replace(
    d,
    $a$if r.status = 'flagged' then raise exception 'This game session failed our fair-play checks and cannot claim a reward'; end if;$a$,
    $b$if r.status = 'flagged' then raise exception 'This game session failed our fair-play checks and cannot claim a reward'; end if;
  if (select count(*) from public.gamehub_runs where user_id = auth.uid() and status = 'flagged' and created_at > now() - interval '30 days') >= 2 then
    raise exception 'This account is under fair-play review and cannot claim rewards right now';
  end if;$b$
  );
  execute d;
end
$do$;

revoke all on function public.gamehub_timed_pause(uuid), public.gamehub_timed_activity(uuid), public.gamehub_report_integrity(uuid, text) from public, anon;
grant execute on function public.gamehub_timed_pause(uuid), public.gamehub_timed_activity(uuid), public.gamehub_report_integrity(uuid, text) to authenticated;
