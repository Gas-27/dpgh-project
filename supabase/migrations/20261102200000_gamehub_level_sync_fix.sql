-- Fix players getting stuck replaying stage 1: the speed check was stricter than a fast human can be,
-- and a client that fell behind the server was rejected with an error instead of being re-synced.

create or replace function public.gamehub_min_seconds(p_game_id text, p_level integer)
returns numeric language sql immutable as $$
  select case p_game_id
    when 'cup-shuffle' then (array[9, 9, 10, 11, 11, 10, 13, 13, 14, 13, 14, 15])[least(greatest(p_level, 1), 12)]::numeric
    when 'snap-fit' then 1.6
    when 'nail-hit' then 0.75 + 0.15 * case when p_level % 5 = 0 then 10 else least(6 + p_level, 12) end
    when 'cut-score' then 3
    else 3600
  end;
$$;

create or replace function public.gamehub_complete_level(p_run_id uuid, p_level integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  v_elapsed numeric;
  v_min numeric;
  v_target integer;
  v_required integer;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  if r.lives <= 0 then raise exception 'Out of lives'; end if;
  if p_level < r.level then
    return jsonb_build_object('ok', false, 'reason', 'resync', 'run', public.gamehub_run_json(r));
  end if;
  if p_level > r.level then raise exception 'Level out of sync'; end if;

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
  v_min := public.gamehub_min_seconds(r.game_id, r.level);
  if v_elapsed < v_min * 0.5 then
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

revoke all on function public.gamehub_complete_level(uuid, integer) from public, anon;
grant execute on function public.gamehub_complete_level(uuid, integer) to authenticated;
