-- Game Hub tournaments: "last person standing" mode and any pool size (2 to 200) for it.
-- Run AFTER 20261113120000 and 20261113130000. Safe to run more than once.
--
-- How a last-standing tournament plays:
--   * Every round all remaining players get the SAME game, one life each.
--   * Players who clear the target level stay in. If nobody or everybody clears, the better half
--     (highest level, then fastest clear / longest survival) stays in. At least one player is always cut.
--   * Rounds repeat (cycling through the admin's game list) until one player is left. That player wins the prize.
-- Each round is stored as one row in gamehub_tournament_matches (p1/p2 null) with one game and one attempt per player,
-- so the existing start / level / life / integrity RPCs keep working unchanged.

alter table public.gamehub_tournaments add column if not exists mode text not null default 'bracket';
alter table public.gamehub_tournaments drop constraint if exists gamehub_tournaments_mode_check;
alter table public.gamehub_tournaments add constraint gamehub_tournaments_mode_check check (mode in ('bracket', 'survival'));
alter table public.gamehub_tournaments drop constraint if exists gamehub_tournaments_max_players_check;
alter table public.gamehub_tournaments add constraint gamehub_tournaments_max_players_check check (max_players between 2 and 200);
alter table public.gamehub_tournament_entries add column if not exists eliminated_round integer;

-- Keep the original bracket functions under new names so the new entry points can dispatch by mode.
do $$ begin
  if to_regprocedure('public.gamehub_tm_begin_bracket(uuid)') is null then
    alter function public.gamehub_tm_begin(uuid) rename to gamehub_tm_begin_bracket;
  end if;
  if to_regprocedure('public.gamehub_tm_settle_match_bracket(uuid)') is null then
    alter function public.gamehub_tm_settle_match(uuid) rename to gamehub_tm_settle_match_bracket;
  end if;
  if to_regprocedure('public.gamehub_tm_my_game_bracket(uuid)') is null then
    alter function public.gamehub_tm_my_game(uuid) rename to gamehub_tm_my_game_bracket;
  end if;
  if to_regprocedure('public.gamehub_tournament_detail_bracket(uuid)') is null then
    alter function public.gamehub_tournament_detail(uuid) rename to gamehub_tournament_detail_bracket;
  end if;
  if to_regprocedure('public.gamehub_tournaments_list_bracket()') is null then
    alter function public.gamehub_tournaments_list() rename to gamehub_tournaments_list_bracket;
  end if;
  if to_regprocedure('public.gamehub_admin_tournaments_bracket()') is null then
    alter function public.gamehub_admin_tournaments() rename to gamehub_admin_tournaments_bracket;
  end if;
  if to_regprocedure('public.gamehub_admin_save_tournament_bracket(jsonb)') is null then
    alter function public.gamehub_admin_save_tournament(jsonb) rename to gamehub_admin_save_tournament_bracket;
  end if;
  if to_regprocedure('public.gamehub_admin_disqualify_bracket(uuid, uuid)') is null then
    alter function public.gamehub_admin_disqualify(uuid, uuid) rename to gamehub_admin_disqualify_bracket;
  end if;
end $$;

-- Engine ---------------------------------------------------------------------------------
create or replace function public.gamehub_tm_survival_open_round(p_t uuid, p_round integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  st public.gamehub_tournament_stages;
  v_game text;
  v_target integer;
  v_match uuid;
  v_game_row uuid;
begin
  select * into st from public.gamehub_tournament_stages where tournament_id = p_t and stage_no = 1;
  v_game := st.games[((p_round - 1) % cardinality(st.games)) + 1];
  v_target := coalesce(public.gamehub_target_level(v_game), 10);
  insert into public.gamehub_tournament_matches (tournament_id, round, slot, stage_no, status, wins_needed, game_ids)
    values (p_t, p_round, 0, 1, 'live', 1, array[v_game]) returning id into v_match;
  insert into public.gamehub_tournament_games (match_id, game_no, game_id, target)
    values (v_match, 1, v_game, v_target) returning id into v_game_row;
  insert into public.gamehub_tournament_attempts (match_game_id, user_id)
    select v_game_row, user_id from public.gamehub_tournament_entries
    where tournament_id = p_t and status = 'joined' and eliminated_round is null;
end $$;

create or replace function public.gamehub_tm_survival_begin(p_t uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.gamehub_tournaments; n integer;
begin
  select * into t from public.gamehub_tournaments where id = p_t for update;
  if not found or t.status <> 'open' then return; end if;
  select count(*) into n from public.gamehub_tournament_entries where tournament_id = p_t and status = 'joined';
  if n < 2 then raise exception 'At least 2 players are needed to start'; end if;
  update public.gamehub_tournaments set status = 'live', started_at = now() where id = p_t;
  perform public.gamehub_tm_survival_open_round(p_t, 1);
end $$;

create or replace function public.gamehub_tm_survival_settle(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.gamehub_tournament_matches;
  t public.gamehub_tournaments;
  g public.gamehub_tournament_games;
  v_order uuid[];
  v_alive integer;
  v_cleared integer;
  v_keep integer;
  v_survivors uuid[];
  v_losers uuid[];
begin
  select * into m from public.gamehub_tournament_matches where id = p_match for update;
  if not found or m.status <> 'live' then return; end if;
  select * into t from public.gamehub_tournaments where id = m.tournament_id;
  if t.status <> 'live' then return; end if;
  select * into g from public.gamehub_tournament_games where match_id = m.id and status = 'open' order by game_no desc limit 1 for update;
  if not found then return; end if;

  update public.gamehub_tournament_attempts set status = 'forfeit', finished_at = now()
    where match_game_id = g.id and status = 'ready' and now() > g.opened_at + interval '3 minutes';
  update public.gamehub_tournament_attempts set status = 'over', finished_at = now()
    where match_game_id = g.id and status = 'playing' and now() > started_at + interval '15 minutes';

  if exists (
    select 1 from public.gamehub_tournament_attempts a
    join public.gamehub_tournament_entries e on e.tournament_id = t.id and e.user_id = a.user_id and e.status = 'joined'
    where a.match_game_id = g.id and a.status in ('ready', 'playing')
  ) then return; end if;

  with ranked as (
    select a.user_id, a.status,
      row_number() over (
        order by public.gamehub_tm_score(a.status, a.level, g.target) desc,
                 case when a.status = 'cleared'
                      then coalesce(extract(epoch from (a.finished_at - a.started_at)), 0)
                      else -coalesce(extract(epoch from (a.finished_at - a.started_at)), 0) end asc,
                 random()
      ) as rn
    from public.gamehub_tournament_attempts a
    join public.gamehub_tournament_entries e on e.tournament_id = t.id and e.user_id = a.user_id and e.status = 'joined'
    where a.match_game_id = g.id
  )
  select array_agg(user_id order by rn), count(*)::integer, (count(*) filter (where status = 'cleared'))::integer
    into v_order, v_alive, v_cleared from ranked;

  if coalesce(v_alive, 0) = 0 then return; end if;

  v_keep := case
    when v_alive = 1 then 1
    when v_cleared between 1 and v_alive - 1 then v_cleared
    else ceil(v_alive / 2.0)::integer
  end;
  v_survivors := v_order[1:v_keep];
  v_losers := v_order[v_keep + 1:v_alive];

  if v_losers is not null then
    update public.gamehub_tournament_entries set eliminated_round = m.round
      where tournament_id = t.id and user_id = any (v_losers);
  end if;
  update public.gamehub_tournament_games set status = 'finished', finished_at = now() where id = g.id;

  if v_keep = 1 then
    update public.gamehub_tournament_matches set status = 'finished', winner = v_survivors[1] where id = m.id;
    update public.gamehub_tournaments set status = 'finished', finished_at = now(), winner_id = v_survivors[1] where id = t.id;
  else
    update public.gamehub_tournament_matches set status = 'finished' where id = m.id;
    perform public.gamehub_tm_survival_open_round(t.id, m.round + 1);
  end if;
end $$;

revoke execute on function public.gamehub_tm_survival_open_round(uuid, integer) from public, anon, authenticated;
revoke execute on function public.gamehub_tm_survival_begin(uuid) from public, anon, authenticated;
revoke execute on function public.gamehub_tm_survival_settle(uuid) from public, anon, authenticated;

-- Dispatchers: same names the app already calls ---------------------------------------------
create or replace function public.gamehub_tm_begin(p_t uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select mode from public.gamehub_tournaments where id = p_t) = 'survival' then
    perform public.gamehub_tm_survival_begin(p_t);
  else
    perform public.gamehub_tm_begin_bracket(p_t);
  end if;
end $$;

create or replace function public.gamehub_tm_settle_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.gamehub_tournament_matches m
    join public.gamehub_tournaments t on t.id = m.tournament_id
    where m.id = p_match and t.mode = 'survival'
  ) then
    perform public.gamehub_tm_survival_settle(p_match);
  else
    perform public.gamehub_tm_settle_match_bracket(p_match);
  end if;
end $$;

create or replace function public.gamehub_tm_my_game(p_t uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.gamehub_tournament_matches;
  g public.gamehub_tournament_games;
  a public.gamehub_tournament_attempts;
begin
  if auth.uid() is null then return null; end if;
  if coalesce((select mode from public.gamehub_tournaments where id = p_t), 'bracket') <> 'survival' then
    return public.gamehub_tm_my_game_bracket(p_t);
  end if;
  perform public.gamehub_tm_settle_tournament(p_t);
  select gg.* into g from public.gamehub_tournament_games gg
    join public.gamehub_tournament_matches mm on mm.id = gg.match_id
    where mm.tournament_id = p_t and gg.status = 'open'
      and exists (select 1 from public.gamehub_tournament_attempts aa where aa.match_game_id = gg.id and aa.user_id = auth.uid())
    order by gg.opened_at desc limit 1;
  if not found then return null; end if;
  select * into m from public.gamehub_tournament_matches where id = g.match_id;
  select * into a from public.gamehub_tournament_attempts where match_game_id = g.id and user_id = auth.uid();
  return jsonb_build_object(
    'mode', 'survival', 'match_id', m.id, 'match_game_id', g.id, 'game_id', g.game_id, 'game_no', m.round, 'games_total', 0,
    'wins_needed', 0, 'target', g.target, 'round', m.round,
    'alive', (select count(*) from public.gamehub_tournament_attempts where match_game_id = g.id),
    'finished_count', (select count(*) from public.gamehub_tournament_attempts where match_game_id = g.id and status in ('cleared', 'over', 'forfeit')),
    'start_seconds_left', greatest(0, extract(epoch from (g.opened_at + interval '3 minutes' - now()))::integer),
    'me', jsonb_build_object('user_id', auth.uid(), 'status', a.status, 'level', a.level, 'wins', 0),
    'opponent', null
  );
end $$;

create or replace function public.gamehub_tournament_detail(p_t uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d jsonb; t public.gamehub_tournaments;
begin
  d := public.gamehub_tournament_detail_bracket(p_t);
  select * into t from public.gamehub_tournaments where id = p_t;
  d := jsonb_set(d, '{tournament,mode}', to_jsonb(t.mode));
  d := jsonb_set(d, '{entries}', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', e.user_id, 'username', public.gamehub_tm_name(e.user_id), 'status', e.status, 'eliminated_round', e.eliminated_round
    ) order by e.created_at), '[]'::jsonb)
    from public.gamehub_tournament_entries e where e.tournament_id = p_t and e.status in ('joined', 'disqualified')
  ));
  return d;
end $$;

create or replace function public.gamehub_tournaments_list()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j || jsonb_build_object('mode', coalesce((select t.mode from public.gamehub_tournaments t where t.id = (x.j ->> 'id')::uuid), 'bracket')) order by x.n), '[]'::jsonb)
  from jsonb_array_elements(public.gamehub_tournaments_list_bracket()) with ordinality as x(j, n);
$$;

create or replace function public.gamehub_admin_tournaments()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j || jsonb_build_object('mode', coalesce((select t.mode from public.gamehub_tournaments t where t.id = (x.j ->> 'id')::uuid), 'bracket')) order by x.n), '[]'::jsonb)
  from jsonb_array_elements(public.gamehub_admin_tournaments_bracket()) with ordinality as x(j, n);
$$;

-- Admin: save (bracket logic is untouched; survival has a single "game rotation" stage) ------------
create or replace function public.gamehub_admin_save_tournament_survival(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_max integer := (p ->> 'max_players')::integer;
  v_fee numeric := coalesce((p ->> 'entry_fee')::numeric, 0);
  v_prize numeric := (p ->> 'prize_gb')::numeric;
  v_publish boolean := coalesce((p ->> 'publish')::boolean, false);
  v_stage jsonb := (p -> 'stages') -> 0;
  v_games text[];
  v_entries integer := 0;
  t public.gamehub_tournaments;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  if v_stage is null or jsonb_array_length(p -> 'stages') <> 1 then raise exception 'Pick the games that rotate each round'; end if;
  select array(select jsonb_array_elements_text(v_stage -> 'games')) into v_games;
  if cardinality(v_games) < 1 or cardinality(v_games) > 7 then raise exception 'Pick 1 to 7 games'; end if;
  if exists (select 1 from unnest(v_games) g where g <> all (public.gamehub_tm_allowed_games())) then
    raise exception 'A selected game is not available for tournaments';
  end if;

  if v_id is not null then
    select * into t from public.gamehub_tournaments where id = v_id for update;
    if not found then raise exception 'Tournament not found'; end if;
    if t.status = 'live' then
      update public.gamehub_tournaments
        set title = trim(p ->> 'title'), description = coalesce(p ->> 'description', ''), starts_at = nullif(p ->> 'starts_at', '')::timestamptz
        where id = v_id;
      update public.gamehub_tournament_stages set games = v_games where tournament_id = v_id and stage_no = 1;
      return v_id;
    end if;
    if t.status not in ('draft', 'open') then raise exception 'Finished or cancelled tournaments cannot be edited'; end if;
  end if;

  if v_max is null or v_max < 2 or v_max > 200 then raise exception 'Players needed must be between 2 and 200'; end if;
  if v_prize is null or v_prize <= 0 then raise exception 'Set a prize greater than 0 GB'; end if;
  if not exists (select 1 from public.data_packages where lower(network) = 'mtn' and size_gb = v_prize and active = true) then
    raise exception 'No active MTN %GB package exists for this prize', v_prize;
  end if;

  if v_id is null then
    insert into public.gamehub_tournaments (title, description, entry_fee, prize_gb, max_players, status, starts_at, mode)
      values (trim(p ->> 'title'), coalesce(p ->> 'description', ''), v_fee, v_prize, v_max,
              case when v_publish then 'open' else 'draft' end, nullif(p ->> 'starts_at', '')::timestamptz, 'survival')
      returning id into v_id;
  else
    select count(*) into v_entries from public.gamehub_tournament_entries where tournament_id = v_id and status = 'joined';
    if v_entries > 0 and (t.entry_fee <> v_fee or t.max_players <> v_max or t.prize_gb <> v_prize) then
      raise exception 'Players have already joined: fee, prize and players needed are locked';
    end if;
    update public.gamehub_tournaments
      set title = trim(p ->> 'title'), description = coalesce(p ->> 'description', ''), entry_fee = v_fee, prize_gb = v_prize,
          max_players = v_max, starts_at = nullif(p ->> 'starts_at', '')::timestamptz,
          status = case when v_publish then 'open' else t.status end
      where id = v_id;
    delete from public.gamehub_tournament_stages where tournament_id = v_id;
  end if;

  insert into public.gamehub_tournament_stages (tournament_id, stage_no, name, games, wins_needed)
    values (v_id, 1, left(trim(coalesce(v_stage ->> 'name', 'Game rotation')), 40), v_games, null);
  return v_id;
end $$;

create or replace function public.gamehub_admin_save_tournament(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_existing text := (select mode from public.gamehub_tournaments where id = nullif(p ->> 'id', '')::uuid);
  v_mode text := coalesce(p ->> 'mode', v_existing, 'bracket');
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  if v_existing is not null and v_existing <> v_mode then raise exception 'The tournament type cannot be changed after it is created'; end if;
  if v_mode = 'survival' then
    return public.gamehub_admin_save_tournament_survival(p);
  end if;
  return public.gamehub_admin_save_tournament_bracket(p);
end $$;

create or replace function public.gamehub_admin_disqualify(p_t uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  if coalesce((select mode from public.gamehub_tournaments where id = p_t), 'bracket') <> 'survival' then
    perform public.gamehub_admin_disqualify_bracket(p_t, p_user);
    return;
  end if;
  update public.gamehub_tournament_entries set status = 'disqualified' where tournament_id = p_t and user_id = p_user and status = 'joined';
  update public.gamehub_tournament_attempts set status = 'forfeit', finished_at = now()
    where user_id = p_user and status in ('ready', 'playing')
      and match_game_id in (
        select g.id from public.gamehub_tournament_games g
        join public.gamehub_tournament_matches m on m.id = g.match_id
        where m.tournament_id = p_t and g.status = 'open'
      );
  perform public.gamehub_tm_settle_tournament(p_t);
end $$;
