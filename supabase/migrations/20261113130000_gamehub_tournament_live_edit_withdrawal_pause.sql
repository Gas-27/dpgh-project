-- 1. Admin can edit a tournament while it is live (title, description, planned start, and
--    stages that no match has reached yet). Run AFTER 20261113120000_gamehub_tournaments.sql.
create or replace function public.gamehub_admin_save_tournament(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_max integer := (p ->> 'max_players')::integer;
  v_fee numeric := coalesce((p ->> 'entry_fee')::numeric, 0);
  v_prize numeric := (p ->> 'prize_gb')::numeric;
  v_publish boolean := coalesce((p ->> 'publish')::boolean, false);
  v_rounds integer;
  v_stage jsonb;
  v_idx integer := 0;
  v_games text[];
  v_wins integer;
  t public.gamehub_tournaments;
  v_entries integer := 0;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;

  if v_id is not null then
    select * into t from public.gamehub_tournaments where id = v_id for update;
    if found and t.status = 'live' then
      if jsonb_typeof(p -> 'stages') is distinct from 'array'
         or jsonb_array_length(p -> 'stages') <> (select count(*) from public.gamehub_tournament_stages where tournament_id = v_id) then
        raise exception 'This bracket needs exactly % stages', (select count(*) from public.gamehub_tournament_stages where tournament_id = v_id);
      end if;
      update public.gamehub_tournaments
        set title = trim(p ->> 'title'), description = coalesce(p ->> 'description', ''),
            starts_at = nullif(p ->> 'starts_at', '')::timestamptz
        where id = v_id;
      for v_stage in select * from jsonb_array_elements(p -> 'stages') loop
        v_idx := v_idx + 1;
        select array(select jsonb_array_elements_text(v_stage -> 'games')) into v_games;
        if cardinality(v_games) < 1 or cardinality(v_games) > 7 then raise exception 'Each stage needs 1 to 7 games'; end if;
        if exists (select 1 from unnest(v_games) g where g <> all (public.gamehub_tm_allowed_games())) then
          raise exception 'A selected game is not available for tournaments';
        end if;
        v_wins := nullif(v_stage ->> 'wins_needed', '')::integer;
        if v_wins is not null and v_wins > cardinality(v_games) then raise exception 'Wins needed cannot exceed the number of games'; end if;
        if exists (select 1 from public.gamehub_tournament_matches where tournament_id = v_id and stage_no = v_idx and status in ('live', 'finished')) then
          update public.gamehub_tournament_stages set name = left(trim(coalesce(v_stage ->> 'name', 'Stage ' || v_idx)), 40)
            where tournament_id = v_id and stage_no = v_idx;
        else
          update public.gamehub_tournament_stages
            set name = left(trim(coalesce(v_stage ->> 'name', 'Stage ' || v_idx)), 40), games = v_games, wins_needed = v_wins
            where tournament_id = v_id and stage_no = v_idx;
          update public.gamehub_tournament_matches
            set game_ids = v_games, wins_needed = coalesce(v_wins, cardinality(v_games) / 2 + 1)
            where tournament_id = v_id and stage_no = v_idx and status = 'waiting';
        end if;
      end loop;
      return v_id;
    end if;
  end if;

  if v_max not in (2, 4, 8, 16, 32) then raise exception 'Players needed must be 2, 4, 8, 16 or 32'; end if;
  if v_prize is null or v_prize <= 0 then raise exception 'Set a prize greater than 0 GB'; end if;
  if not exists (select 1 from public.data_packages where lower(network) = 'mtn' and size_gb = v_prize and active = true) then
    raise exception 'No active MTN %GB package exists for this prize', v_prize;
  end if;
  v_rounds := round(ln(v_max) / ln(2))::integer;
  if jsonb_typeof(p -> 'stages') is distinct from 'array' or jsonb_array_length(p -> 'stages') <> v_rounds then
    raise exception 'This bracket needs exactly % stages', v_rounds;
  end if;

  if v_id is null then
    insert into public.gamehub_tournaments (title, description, entry_fee, prize_gb, max_players, status, starts_at)
      values (trim(p ->> 'title'), coalesce(p ->> 'description', ''), v_fee, v_prize, v_max,
              case when v_publish then 'open' else 'draft' end, nullif(p ->> 'starts_at', '')::timestamptz)
      returning id into v_id;
  else
    if not found then raise exception 'Tournament not found'; end if;
    if t.status not in ('draft', 'open') then raise exception 'Finished or cancelled tournaments cannot be edited'; end if;
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

  for v_stage in select * from jsonb_array_elements(p -> 'stages') loop
    v_idx := v_idx + 1;
    select array(select jsonb_array_elements_text(v_stage -> 'games')) into v_games;
    if cardinality(v_games) < 1 or cardinality(v_games) > 7 then raise exception 'Each stage needs 1 to 7 games'; end if;
    if exists (select 1 from unnest(v_games) g where g <> all (public.gamehub_tm_allowed_games())) then
      raise exception 'A selected game is not available for tournaments';
    end if;
    insert into public.gamehub_tournament_stages (tournament_id, stage_no, name, games, wins_needed)
      values (v_id, v_idx, left(trim(coalesce(v_stage ->> 'name', 'Stage ' || v_idx)), 40), v_games,
              nullif(v_stage ->> 'wins_needed', '')::integer);
  end loop;
  return v_id;
end $$;
