-- Game Hub tournaments: single-elimination brackets with a wallet entry fee and a GB prize.
-- Every rule (entry fee, pairing, level validation, winners, prize) is decided by these functions.
-- Clients can never write to the tables directly; they only call the RPCs at the bottom.

-- Tables -----------------------------------------------------------------------------
create table if not exists public.gamehub_tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '',
  entry_fee numeric not null default 0 check (entry_fee >= 0 and entry_fee <= 1000),
  prize_gb numeric not null check (prize_gb > 0),
  max_players integer not null check (max_players in (2, 4, 8, 16, 32)),
  status text not null default 'draft' check (status in ('draft', 'open', 'live', 'finished', 'cancelled')),
  starts_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  winner_id uuid,
  prize_claimed boolean not null default false,
  prize_order_id uuid,
  prize_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.gamehub_tournament_stages (
  tournament_id uuid not null references public.gamehub_tournaments(id) on delete cascade,
  stage_no integer not null check (stage_no >= 1),
  name text not null check (char_length(name) between 1 and 40),
  games text[] not null check (cardinality(games) between 1 and 7),
  wins_needed integer check (wins_needed is null or wins_needed >= 1),
  primary key (tournament_id, stage_no)
);

create table if not exists public.gamehub_tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.gamehub_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_type text,
  wallet_id uuid,
  fee_paid numeric not null default 0,
  status text not null default 'joined' check (status in ('joined', 'refunded', 'disqualified')),
  created_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.gamehub_tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.gamehub_tournaments(id) on delete cascade,
  round integer not null,
  slot integer not null,
  stage_no integer not null,
  p1 uuid,
  p2 uuid,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'finished')),
  winner uuid,
  p1_wins integer not null default 0,
  p2_wins integer not null default 0,
  wins_needed integer not null,
  game_ids text[] not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, round, slot)
);

create table if not exists public.gamehub_tournament_games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.gamehub_tournament_matches(id) on delete cascade,
  game_no integer not null,
  game_id text not null,
  target integer not null,
  status text not null default 'open' check (status in ('open', 'finished')),
  winner uuid,
  opened_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (match_id, game_no)
);

create table if not exists public.gamehub_tournament_attempts (
  id uuid primary key default gen_random_uuid(),
  match_game_id uuid not null references public.gamehub_tournament_games(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'ready' check (status in ('ready', 'playing', 'cleared', 'over', 'forfeit')),
  level integer not null default 1,
  started_at timestamptz,
  level_started_at timestamptz,
  finished_at timestamptz,
  suspicion integer not null default 0,
  unique (match_game_id, user_id)
);

create index if not exists gamehub_tm_matches_t on public.gamehub_tournament_matches (tournament_id);
create index if not exists gamehub_tm_games_m on public.gamehub_tournament_games (match_id);
create index if not exists gamehub_tm_entries_t on public.gamehub_tournament_entries (tournament_id);

alter table public.gamehub_tournaments enable row level security;
alter table public.gamehub_tournament_stages enable row level security;
alter table public.gamehub_tournament_entries enable row level security;
alter table public.gamehub_tournament_matches enable row level security;
alter table public.gamehub_tournament_games enable row level security;
alter table public.gamehub_tournament_attempts enable row level security;
revoke all on public.gamehub_tournaments, public.gamehub_tournament_stages, public.gamehub_tournament_entries,
  public.gamehub_tournament_matches, public.gamehub_tournament_games, public.gamehub_tournament_attempts from anon, authenticated;

-- Helpers ----------------------------------------------------------------------------
create or replace function public.gamehub_tm_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select username from public.gamehub_players where user_id = p_user), 'player');
$$;

create or replace function public.gamehub_tm_score(p_status text, p_level integer, p_target integer)
returns integer language sql immutable as $$
  select case p_status when 'cleared' then p_target when 'forfeit' then -1 else greatest(p_level - 1, 0) end;
$$;

create or replace function public.gamehub_tm_allowed_games()
returns text[] language sql immutable as $$
  select array['cup-shuffle', 'snap-fit', 'nail-hit', 'fruits-slash', 'rock-blast', 'cut-score', 'brain-memory', 'sliding-tiles', 'stop-timer', 'endless-runner'];
$$;

-- Lower bound for one level. The shared table falls back to 3600s for games it does not know, so cap that.
create or replace function public.gamehub_tm_min_seconds(p_game_id text, p_level integer)
returns numeric language sql immutable as $$
  select case when public.gamehub_min_seconds(p_game_id, p_level) >= 600 then 2 else public.gamehub_min_seconds(p_game_id, p_level) end;
$$;

create or replace function public.gamehub_tm_refund(p_entry public.gamehub_tournament_entries, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_entry.status <> 'joined' or p_entry.fee_paid <= 0 or p_entry.wallet_id is null then return; end if;
  perform public.wallet_apply_internal(
    p_entry.wallet_type, p_entry.wallet_id, p_entry.fee_paid, 'gamehub_tournament_refund',
    'tm-refund:' || p_entry.id::text, 'Game Hub tournament refund (' || p_title || ')', p_entry.user_id
  );
end $$;

-- Bracket engine ------------------------------------------------------------------------
create or replace function public.gamehub_tm_open_game(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.gamehub_tournament_matches;
  v_played integer;
  v_game text;
  v_target integer;
  v_id uuid;
begin
  select * into m from public.gamehub_tournament_matches where id = p_match;
  select count(*) into v_played from public.gamehub_tournament_games where match_id = p_match;
  v_game := m.game_ids[(v_played % cardinality(m.game_ids)) + 1];
  v_target := coalesce(public.gamehub_target_level(v_game), 10);
  insert into public.gamehub_tournament_games (match_id, game_no, game_id, target)
    values (p_match, v_played + 1, v_game, v_target) returning id into v_id;
  insert into public.gamehub_tournament_attempts (match_game_id, user_id) values (v_id, m.p1), (v_id, m.p2);
end $$;

create or replace function public.gamehub_tm_finish_match(p_match uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.gamehub_tournament_matches;
  n public.gamehub_tournament_matches;
  v_last integer;
begin
  update public.gamehub_tournament_matches set status = 'finished', winner = p_winner where id = p_match returning * into m;
  update public.gamehub_tournament_games set status = 'finished', finished_at = now() where match_id = p_match and status = 'open';
  select max(round) into v_last from public.gamehub_tournament_matches where tournament_id = m.tournament_id;
  if m.round >= v_last then
    update public.gamehub_tournaments set status = 'finished', finished_at = now(), winner_id = p_winner where id = m.tournament_id;
    return;
  end if;
  select * into n from public.gamehub_tournament_matches
    where tournament_id = m.tournament_id and round = m.round + 1 and slot = m.slot / 2 for update;
  if m.slot % 2 = 0 then
    update public.gamehub_tournament_matches set p1 = p_winner where id = n.id;
  else
    update public.gamehub_tournament_matches set p2 = p_winner where id = n.id;
  end if;
  perform public.gamehub_tm_activate(n.id);
end $$;

-- A match starts as soon as both players are known; a disqualified or missing player loses by default.
create or replace function public.gamehub_tm_activate(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.gamehub_tournament_matches;
  v_dq1 boolean;
  v_dq2 boolean;
begin
  select * into m from public.gamehub_tournament_matches where id = p_match;
  if m.status <> 'waiting' or m.p1 is null or m.p2 is null then return; end if;
  select exists (select 1 from public.gamehub_tournament_entries where tournament_id = m.tournament_id and user_id = m.p1 and status = 'disqualified') into v_dq1;
  select exists (select 1 from public.gamehub_tournament_entries where tournament_id = m.tournament_id and user_id = m.p2 and status = 'disqualified') into v_dq2;
  if v_dq1 and not v_dq2 then
    perform public.gamehub_tm_finish_match(m.id, m.p2);
  elsif v_dq2 then
    perform public.gamehub_tm_finish_match(m.id, m.p1);
  else
    update public.gamehub_tournament_matches set status = 'live' where id = m.id;
    perform public.gamehub_tm_open_game(m.id);
  end if;
end $$;

create or replace function public.gamehub_tm_begin(p_t uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.gamehub_tournaments;
  ids uuid[];
  n integer;
  v_size integer := 2;
  v_rounds integer := 1;
  v_total integer;
  r integer;
  s integer;
  st public.gamehub_tournament_stages;
  v_p2 uuid;
  v_match uuid;
begin
  select * into t from public.gamehub_tournaments where id = p_t for update;
  if not found or t.status <> 'open' then return; end if;
  select array_agg(user_id order by random()) into ids from public.gamehub_tournament_entries where tournament_id = p_t and status = 'joined';
  n := coalesce(cardinality(ids), 0);
  if n < 2 then raise exception 'At least 2 players are needed to start'; end if;
  while v_size < n loop v_size := v_size * 2; v_rounds := v_rounds + 1; end loop;
  v_total := round(ln(t.max_players) / ln(2))::integer;

  update public.gamehub_tournaments set status = 'live', started_at = now() where id = p_t;

  for r in 1..v_rounds loop
    select * into st from public.gamehub_tournament_stages where tournament_id = p_t and stage_no = v_total - v_rounds + r;
    for s in 0..((v_size >> r) - 1) loop
      v_p2 := null;
      if r = 1 and s + v_size / 2 + 1 <= n then v_p2 := ids[s + v_size / 2 + 1]; end if;
      insert into public.gamehub_tournament_matches (tournament_id, round, slot, stage_no, p1, p2, wins_needed, game_ids)
        values (p_t, r, s, st.stage_no, case when r = 1 then ids[s + 1] else null end, v_p2,
                coalesce(st.wins_needed, cardinality(st.games) / 2 + 1), st.games);
    end loop;
  end loop;

  -- Round 1: odd players get a bye, everyone else starts playing.
  for v_match in
    select id from public.gamehub_tournament_matches where tournament_id = p_t and round = 1 order by slot
  loop
    select * into st from public.gamehub_tournament_matches where id = v_match;
    if (select p2 from public.gamehub_tournament_matches where id = v_match) is null then
      perform public.gamehub_tm_finish_match(v_match, (select p1 from public.gamehub_tournament_matches where id = v_match));
    else
      perform public.gamehub_tm_activate(v_match);
    end if;
  end loop;
end $$;

-- Resolves finished, abandoned or timed-out games and moves the match on. Safe to call any time.
create or replace function public.gamehub_tm_settle_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.gamehub_tournament_matches;
  g public.gamehub_tournament_games;
  a1 public.gamehub_tournament_attempts;
  a2 public.gamehub_tournament_attempts;
  s1 integer;
  s2 integer;
  d1 numeric;
  d2 numeric;
  v_winner uuid;
  v_played integer;
  v_done uuid;
begin
  select * into m from public.gamehub_tournament_matches where id = p_match for update;
  if not found or m.status <> 'live' then return; end if;
  if (select status from public.gamehub_tournaments where id = m.tournament_id) <> 'live' then return; end if;
  select * into g from public.gamehub_tournament_games where match_id = m.id and status = 'open' order by game_no desc limit 1 for update;
  if not found then return; end if;

  update public.gamehub_tournament_attempts set status = 'forfeit', finished_at = now()
    where match_game_id = g.id and status = 'ready' and now() > g.opened_at + interval '3 minutes';
  update public.gamehub_tournament_attempts set status = 'over', finished_at = now()
    where match_game_id = g.id and status = 'playing' and now() > started_at + interval '15 minutes';

  select * into a1 from public.gamehub_tournament_attempts where match_game_id = g.id and user_id = m.p1;
  select * into a2 from public.gamehub_tournament_attempts where match_game_id = g.id and user_id = m.p2;
  if a1.status in ('ready', 'playing') or a2.status in ('ready', 'playing') then return; end if;

  s1 := public.gamehub_tm_score(a1.status, a1.level, g.target);
  s2 := public.gamehub_tm_score(a2.status, a2.level, g.target);
  if s1 > s2 then
    v_winner := m.p1;
  elsif s2 > s1 then
    v_winner := m.p2;
  elsif a1.status = 'cleared' and a2.status = 'cleared' then
    d1 := extract(epoch from (a1.finished_at - a1.started_at));
    d2 := extract(epoch from (a2.finished_at - a2.started_at));
    if d1 < d2 then v_winner := m.p1; elsif d2 < d1 then v_winner := m.p2; end if;
  end if;

  update public.gamehub_tournament_games set status = 'finished', winner = v_winner, finished_at = now() where id = g.id;
  update public.gamehub_tournament_matches
    set p1_wins = p1_wins + case when v_winner = m.p1 then 1 else 0 end,
        p2_wins = p2_wins + case when v_winner = m.p2 then 1 else 0 end
    where id = m.id returning * into m;

  select count(*) into v_played from public.gamehub_tournament_games where match_id = m.id and status = 'finished';
  if m.p1_wins >= m.wins_needed then
    v_done := m.p1;
  elsif m.p2_wins >= m.wins_needed then
    v_done := m.p2;
  elsif v_played >= cardinality(m.game_ids) and m.p1_wins <> m.p2_wins then
    v_done := case when m.p1_wins > m.p2_wins then m.p1 else m.p2 end;
  elsif v_played >= cardinality(m.game_ids) + 3 then
    v_done := m.p1;
  end if;

  if v_done is not null then
    perform public.gamehub_tm_finish_match(m.id, v_done);
  else
    perform public.gamehub_tm_open_game(m.id);
  end if;
end $$;

create or replace function public.gamehub_tm_settle_tournament(p_t uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_match uuid;
begin
  for v_match in select id from public.gamehub_tournament_matches where tournament_id = p_t and status = 'live' loop
    perform public.gamehub_tm_settle_match(v_match);
  end loop;
end $$;

-- Admin RPCs ---------------------------------------------------------------------------
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
  t public.gamehub_tournaments;
  v_entries integer := 0;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
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
    select * into t from public.gamehub_tournaments where id = v_id for update;
    if not found then raise exception 'Tournament not found'; end if;
    if t.status not in ('draft', 'open') then raise exception 'Only draft or open tournaments can be edited'; end if;
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

create or replace function public.gamehub_admin_start_tournament(p_t uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  perform public.gamehub_tm_begin(p_t);
end $$;

create or replace function public.gamehub_admin_cancel_tournament(p_t uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.gamehub_tournaments; e public.gamehub_tournament_entries;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  select * into t from public.gamehub_tournaments where id = p_t for update;
  if not found then raise exception 'Tournament not found'; end if;
  if t.status in ('finished', 'cancelled') then raise exception 'This tournament is already closed'; end if;
  for e in select * from public.gamehub_tournament_entries where tournament_id = p_t and status = 'joined' loop
    perform public.gamehub_tm_refund(e, t.title);
    update public.gamehub_tournament_entries set status = 'refunded' where id = e.id;
  end loop;
  update public.gamehub_tournament_games set status = 'finished', finished_at = now()
    where status = 'open' and match_id in (select id from public.gamehub_tournament_matches where tournament_id = p_t);
  update public.gamehub_tournaments set status = 'cancelled', finished_at = now() where id = p_t;
end $$;

create or replace function public.gamehub_admin_disqualify(p_t uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.gamehub_tournament_matches;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  update public.gamehub_tournament_entries set status = 'disqualified' where tournament_id = p_t and user_id = p_user and status = 'joined';
  for m in select * from public.gamehub_tournament_matches where tournament_id = p_t and status = 'live' and p_user in (p1, p2) loop
    perform public.gamehub_tm_finish_match(m.id, case when m.p1 = p_user then m.p2 else m.p1 end);
  end loop;
end $$;

create or replace function public.gamehub_admin_tournaments()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'description', t.description, 'entry_fee', t.entry_fee, 'prize_gb', t.prize_gb,
      'max_players', t.max_players, 'status', t.status, 'starts_at', t.starts_at, 'created_at', t.created_at,
      'winner_name', case when t.winner_id is null then null else public.gamehub_tm_name(t.winner_id) end,
      'prize_claimed', t.prize_claimed,
      'entries_count', (select count(*) from public.gamehub_tournament_entries e where e.tournament_id = t.id and e.status in ('joined', 'disqualified')),
      'fees_collected', (select coalesce(sum(e.fee_paid), 0) from public.gamehub_tournament_entries e where e.tournament_id = t.id and e.status in ('joined', 'disqualified')),
      'stages', (select coalesce(jsonb_agg(jsonb_build_object('stage_no', s.stage_no, 'name', s.name, 'games', to_jsonb(s.games), 'wins_needed', s.wins_needed) order by s.stage_no), '[]'::jsonb)
                 from public.gamehub_tournament_stages s where s.tournament_id = t.id)
    ) order by t.created_at desc), '[]'::jsonb)
    from public.gamehub_tournaments t
  );
end $$;

-- Player RPCs --------------------------------------------------------------------------
create or replace function public.gamehub_tournaments_list()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return (
    select coalesce(jsonb_agg(x.j order by x.ord, x.created_at desc), '[]'::jsonb)
    from (
      select t.created_at,
        case t.status when 'live' then 0 when 'open' then 1 else 2 end as ord,
        jsonb_build_object(
          'id', t.id, 'title', t.title, 'description', t.description, 'entry_fee', t.entry_fee, 'prize_gb', t.prize_gb,
          'max_players', t.max_players, 'status', t.status, 'starts_at', t.starts_at,
          'entries_count', (select count(*) from public.gamehub_tournament_entries e where e.tournament_id = t.id and e.status in ('joined', 'disqualified')),
          'joined', exists (select 1 from public.gamehub_tournament_entries e where e.tournament_id = t.id and e.user_id = auth.uid() and e.status = 'joined'),
          'winner_name', case when t.winner_id is null then null else public.gamehub_tm_name(t.winner_id) end
        ) as j
      from public.gamehub_tournaments t
      where t.status in ('open', 'live', 'finished')
      order by t.created_at desc
      limit 30
    ) x
  );
end $$;

create or replace function public.gamehub_tournament_detail(p_t uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.gamehub_tournaments;
begin
  select * into t from public.gamehub_tournaments where id = p_t and status <> 'draft';
  if not found then raise exception 'Tournament not found'; end if;
  if t.status = 'live' then perform public.gamehub_tm_settle_tournament(p_t); select * into t from public.gamehub_tournaments where id = p_t; end if;
  return jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', t.id, 'title', t.title, 'description', t.description, 'entry_fee', t.entry_fee, 'prize_gb', t.prize_gb,
      'max_players', t.max_players, 'status', t.status, 'starts_at', t.starts_at, 'winner_id', t.winner_id,
      'winner_name', case when t.winner_id is null then null else public.gamehub_tm_name(t.winner_id) end,
      'prize_claimed', t.prize_claimed,
      'can_claim', (t.status = 'finished' and t.winner_id = auth.uid() and not t.prize_claimed),
      'joined', exists (select 1 from public.gamehub_tournament_entries e where e.tournament_id = t.id and e.user_id = auth.uid() and e.status = 'joined'),
      'me', auth.uid()
    ),
    'stages', (select coalesce(jsonb_agg(jsonb_build_object('stage_no', s.stage_no, 'name', s.name, 'games', to_jsonb(s.games), 'wins_needed', coalesce(s.wins_needed, cardinality(s.games) / 2 + 1)) order by s.stage_no), '[]'::jsonb)
               from public.gamehub_tournament_stages s where s.tournament_id = t.id),
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('user_id', e.user_id, 'username', public.gamehub_tm_name(e.user_id), 'status', e.status) order by e.created_at), '[]'::jsonb)
                from public.gamehub_tournament_entries e where e.tournament_id = t.id and e.status in ('joined', 'disqualified')),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'round', m.round, 'slot', m.slot, 'stage_no', m.stage_no, 'status', m.status,
        'p1', m.p1, 'p2', m.p2,
        'p1_name', case when m.p1 is null then null else public.gamehub_tm_name(m.p1) end,
        'p2_name', case when m.p2 is null then null else public.gamehub_tm_name(m.p2) end,
        'winner', m.winner, 'p1_wins', m.p1_wins, 'p2_wins', m.p2_wins, 'wins_needed', m.wins_needed, 'game_ids', to_jsonb(m.game_ids),
        'games', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', g.id, 'game_no', g.game_no, 'game_id', g.game_id, 'status', g.status, 'winner', g.winner, 'target', g.target, 'opened_at', g.opened_at,
            'attempts', (select coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'status', a.status, 'level', a.level,
                           'score', public.gamehub_tm_score(a.status, a.level, g.target))), '[]'::jsonb)
                         from public.gamehub_tournament_attempts a where a.match_game_id = g.id)
          ) order by g.game_no), '[]'::jsonb) from public.gamehub_tournament_games g where g.match_id = m.id)
      ) order by m.round, m.slot), '[]'::jsonb)
      from public.gamehub_tournament_matches m where m.tournament_id = t.id)
  );
end $$;

create or replace function public.gamehub_tournament_join(p_t uuid, p_hint text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.gamehub_tournaments;
  w jsonb;
  v_count integer;
  v_entry uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'Sign in to join a tournament'; end if;
  if not exists (select 1 from public.gamehub_players where user_id = auth.uid()) then raise exception 'Pick a player name first'; end if;
  select * into t from public.gamehub_tournaments where id = p_t for update;
  if not found or t.status <> 'open' then raise exception 'This tournament is not open for entries'; end if;
  if exists (select 1 from public.gamehub_tournament_entries where tournament_id = p_t and user_id = auth.uid()) then
    raise exception 'You have already joined this tournament';
  end if;
  select count(*) into v_count from public.gamehub_tournament_entries where tournament_id = p_t and status = 'joined';
  if v_count >= t.max_players then raise exception 'This tournament is full'; end if;

  w := null;
  if t.entry_fee > 0 then
    w := public.gamehub_resolve_wallet(p_hint);
    if w is null then raise exception 'No wallet found for this account'; end if;
    if (w ->> 'balance')::numeric < t.entry_fee then
      raise exception 'Insufficient wallet balance. Top up GH₵% to join', t.entry_fee;
    end if;
    perform public.wallet_apply_internal(
      w ->> 'owner_type', (w ->> 'owner_id')::uuid, -t.entry_fee, 'gamehub_tournament_fee',
      'tm-fee:' || v_entry::text, 'Game Hub tournament entry (' || t.title || ')', auth.uid()
    );
  end if;
  insert into public.gamehub_tournament_entries (id, tournament_id, user_id, wallet_type, wallet_id, fee_paid)
    values (v_entry, p_t, auth.uid(), w ->> 'owner_type', (w ->> 'owner_id')::uuid, case when t.entry_fee > 0 then t.entry_fee else 0 end);

  if v_count + 1 >= t.max_players then perform public.gamehub_tm_begin(p_t); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gamehub_tournament_leave(p_t uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.gamehub_tournaments; e public.gamehub_tournament_entries;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into t from public.gamehub_tournaments where id = p_t for update;
  if not found or t.status <> 'open' then raise exception 'You can only leave before the tournament starts'; end if;
  select * into e from public.gamehub_tournament_entries where tournament_id = p_t and user_id = auth.uid() and status = 'joined' for update;
  if not found then raise exception 'You have not joined this tournament'; end if;
  perform public.gamehub_tm_refund(e, t.title);
  delete from public.gamehub_tournament_entries where id = e.id;
end $$;

-- Current open game for the signed-in player, plus what their opponent is doing.
create or replace function public.gamehub_tm_my_game(p_t uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.gamehub_tournament_matches;
  g public.gamehub_tournament_games;
  a public.gamehub_tournament_attempts;
  o public.gamehub_tournament_attempts;
  v_opp uuid;
begin
  if auth.uid() is null then return null; end if;
  for m in select * from public.gamehub_tournament_matches where tournament_id = p_t and status = 'live' and auth.uid() in (p1, p2) loop
    perform public.gamehub_tm_settle_match(m.id);
  end loop;
  select * into m from public.gamehub_tournament_matches where tournament_id = p_t and status = 'live' and auth.uid() in (p1, p2) limit 1;
  if not found then return null; end if;
  select * into g from public.gamehub_tournament_games where match_id = m.id and status = 'open' order by game_no desc limit 1;
  if not found then return null; end if;
  select * into a from public.gamehub_tournament_attempts where match_game_id = g.id and user_id = auth.uid();
  v_opp := case when m.p1 = auth.uid() then m.p2 else m.p1 end;
  select * into o from public.gamehub_tournament_attempts where match_game_id = g.id and user_id = v_opp;
  return jsonb_build_object(
    'match_id', m.id, 'match_game_id', g.id, 'game_id', g.game_id, 'game_no', g.game_no, 'games_total', cardinality(m.game_ids),
    'wins_needed', m.wins_needed, 'target', g.target,
    'start_seconds_left', greatest(0, extract(epoch from (g.opened_at + interval '3 minutes' - now()))::integer),
    'me', jsonb_build_object('user_id', auth.uid(), 'status', a.status, 'level', a.level, 'wins', case when m.p1 = auth.uid() then m.p1_wins else m.p2_wins end),
    'opponent', jsonb_build_object('user_id', v_opp, 'username', public.gamehub_tm_name(v_opp), 'status', o.status, 'level', o.level,
                                   'wins', case when m.p1 = v_opp then m.p1_wins else m.p2_wins end)
  );
end $$;

create or replace function public.gamehub_tm_attempt_json(a public.gamehub_tournament_attempts, p_target integer)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'ok', true, 'level', a.level, 'target', p_target,
    'lives', case when a.status = 'playing' then 1 else 0 end,
    'status', case a.status when 'cleared' then 'cleared' when 'playing' then 'active' when 'ready' then 'active' else 'over' end
  );
$$;

-- Locks match -> game -> attempt in the same order everywhere to avoid deadlocks.
create or replace function public.gamehub_tm_lock_attempt(p_mg uuid, out o_match public.gamehub_tournament_matches, out o_game public.gamehub_tournament_games, out o_attempt public.gamehub_tournament_attempts)
language plpgsql security definer set search_path = public as $$
begin
  select * into o_game from public.gamehub_tournament_games where id = p_mg;
  if not found then raise exception 'Game not found'; end if;
  select * into o_match from public.gamehub_tournament_matches where id = o_game.match_id for update;
  select * into o_game from public.gamehub_tournament_games where id = p_mg for update;
  select * into o_attempt from public.gamehub_tournament_attempts where match_game_id = p_mg and user_id = auth.uid() for update;
  if not found then raise exception 'You are not part of this match'; end if;
end $$;

create or replace function public.gamehub_tm_start(p_mg uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into l from public.gamehub_tm_lock_attempt(p_mg);
  if l.o_game.status <> 'open' then raise exception 'This game is already finished'; end if;
  if l.o_attempt.status = 'ready' then
    if now() > l.o_game.opened_at + interval '3 minutes' then
      perform public.gamehub_tm_settle_match(l.o_match.id);
      raise exception 'The start window has closed';
    end if;
    update public.gamehub_tournament_attempts set status = 'playing', started_at = now(), level_started_at = now()
      where id = l.o_attempt.id returning * into l.o_attempt;
  end if;
  return public.gamehub_tm_attempt_json(l.o_attempt, l.o_game.target);
end $$;

create or replace function public.gamehub_tm_level_complete(p_mg uuid, p_level integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; v_elapsed numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into l from public.gamehub_tm_lock_attempt(p_mg);
  if l.o_game.status <> 'open' or l.o_attempt.status <> 'playing' then
    return public.gamehub_tm_attempt_json(l.o_attempt, l.o_game.target) || jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if now() > l.o_attempt.started_at + interval '15 minutes' then
    perform public.gamehub_tm_settle_match(l.o_match.id);
    return jsonb_build_object('ok', false, 'reason', 'closed', 'status', 'over', 'lives', 0, 'level', l.o_attempt.level);
  end if;
  if p_level is distinct from l.o_attempt.level then raise exception 'Level out of sync'; end if;

  v_elapsed := extract(epoch from (now() - l.o_attempt.level_started_at));
  if v_elapsed < public.gamehub_tm_min_seconds(l.o_game.game_id, l.o_attempt.level) then
    insert into public.gamehub_flags (user_id, run_id, game_id, reason)
      values (auth.uid(), null, l.o_game.game_id, format('tournament level %s finished in %ss', l.o_attempt.level, round(v_elapsed, 2)));
    update public.gamehub_tournament_attempts
      set suspicion = suspicion + 1, level_started_at = now(),
          status = case when suspicion + 1 >= 3 then 'forfeit' else status end,
          finished_at = case when suspicion + 1 >= 3 then now() else finished_at end
      where id = l.o_attempt.id returning * into l.o_attempt;
    perform public.gamehub_tm_settle_match(l.o_match.id);
    return public.gamehub_tm_attempt_json(l.o_attempt, l.o_game.target) || jsonb_build_object('ok', false, 'reason', 'too_fast');
  end if;

  if l.o_attempt.level >= l.o_game.target then
    update public.gamehub_tournament_attempts set status = 'cleared', finished_at = now() where id = l.o_attempt.id returning * into l.o_attempt;
  else
    update public.gamehub_tournament_attempts set level = level + 1, level_started_at = now() where id = l.o_attempt.id returning * into l.o_attempt;
  end if;
  perform public.gamehub_tm_settle_match(l.o_match.id);
  return public.gamehub_tm_attempt_json(l.o_attempt, l.o_game.target);
end $$;

-- Tournament games give one life: losing it ends your attempt.
create or replace function public.gamehub_tm_life_lost(p_mg uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into l from public.gamehub_tm_lock_attempt(p_mg);
  if l.o_game.status = 'open' and l.o_attempt.status = 'playing' then
    update public.gamehub_tournament_attempts set status = 'over', finished_at = now() where id = l.o_attempt.id returning * into l.o_attempt;
    perform public.gamehub_tm_settle_match(l.o_match.id);
  end if;
  return public.gamehub_tm_attempt_json(l.o_attempt, l.o_game.target);
end $$;

create or replace function public.gamehub_tm_integrity(p_mg uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into l from public.gamehub_tm_lock_attempt(p_mg);
  if l.o_game.status = 'open' and l.o_attempt.status in ('ready', 'playing') then
    insert into public.gamehub_flags (user_id, run_id, game_id, reason)
      values (auth.uid(), null, l.o_game.game_id, 'tournament integrity: ' || left(coalesce(p_kind, 'unknown'), 40));
    update public.gamehub_tournament_attempts
      set suspicion = suspicion + 2,
          status = case when suspicion + 2 >= 3 then 'forfeit' else status end,
          finished_at = case when suspicion + 2 >= 3 then now() else finished_at end
      where id = l.o_attempt.id returning * into l.o_attempt;
    perform public.gamehub_tm_settle_match(l.o_match.id);
  end if;
  return public.gamehub_tm_attempt_json(l.o_attempt, l.o_game.target);
end $$;

create or replace function public.gamehub_tournament_claim_prize(p_t uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.gamehub_tournaments;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_package uuid;
  v_order uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to claim your prize'; end if;
  if length(v_phone) = 12 and left(v_phone, 3) = '233' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone !~ '^0(24|25|53|54|55|59)[0-9]{7}$' then raise exception 'Enter a valid MTN number (e.g. 0241234567)'; end if;
  select * into t from public.gamehub_tournaments where id = p_t for update;
  if not found or t.status <> 'finished' or t.winner_id is distinct from auth.uid() then raise exception 'Only the tournament winner can claim this prize'; end if;
  if t.prize_claimed then raise exception 'This prize was already claimed'; end if;
  select id into v_package from public.data_packages where lower(network) = 'mtn' and size_gb = t.prize_gb and active = true order by price asc limit 1;
  if v_package is null then raise exception 'The MTN %GB prize is unavailable right now', t.prize_gb; end if;
  v_order := public.create_free_claim_order(v_phone, 'mtn', t.prize_gb, v_package, null, null);
  update public.gamehub_tournaments set prize_claimed = true, prize_order_id = v_order, prize_phone = v_phone where id = p_t;
  return jsonb_build_object('ok', true, 'order_id', v_order, 'phone', v_phone, 'reward_gb', t.prize_gb);
end $$;

-- Grants -------------------------------------------------------------------------------
revoke all on function public.gamehub_tm_open_game(uuid), public.gamehub_tm_finish_match(uuid, uuid), public.gamehub_tm_activate(uuid),
  public.gamehub_tm_begin(uuid), public.gamehub_tm_settle_match(uuid), public.gamehub_tm_settle_tournament(uuid),
  public.gamehub_tm_refund(public.gamehub_tournament_entries, text), public.gamehub_tm_min_seconds(text, integer),
  public.gamehub_tm_lock_attempt(uuid), public.gamehub_tm_attempt_json(public.gamehub_tournament_attempts, integer)
  from public, anon, authenticated;

revoke all on function public.gamehub_admin_save_tournament(jsonb), public.gamehub_admin_start_tournament(uuid),
  public.gamehub_admin_cancel_tournament(uuid), public.gamehub_admin_disqualify(uuid, uuid), public.gamehub_admin_tournaments()
  from public, anon;
grant execute on function public.gamehub_admin_save_tournament(jsonb), public.gamehub_admin_start_tournament(uuid),
  public.gamehub_admin_cancel_tournament(uuid), public.gamehub_admin_disqualify(uuid, uuid), public.gamehub_admin_tournaments() to authenticated;

revoke all on function public.gamehub_tm_name(uuid), public.gamehub_tm_score(text, integer, integer), public.gamehub_tm_allowed_games() from public, anon;
grant execute on function public.gamehub_tm_name(uuid), public.gamehub_tm_score(text, integer, integer), public.gamehub_tm_allowed_games() to authenticated;

-- Visitors who are not signed in can browse and spectate.
grant execute on function public.gamehub_tournaments_list(), public.gamehub_tournament_detail(uuid) to anon, authenticated;

revoke all on function public.gamehub_tournament_join(uuid, text), public.gamehub_tournament_leave(uuid), public.gamehub_tm_my_game(uuid),
  public.gamehub_tm_start(uuid), public.gamehub_tm_level_complete(uuid, integer), public.gamehub_tm_life_lost(uuid),
  public.gamehub_tm_integrity(uuid, text), public.gamehub_tournament_claim_prize(uuid, text) from public, anon;
grant execute on function public.gamehub_tournament_join(uuid, text), public.gamehub_tournament_leave(uuid), public.gamehub_tm_my_game(uuid),
  public.gamehub_tm_start(uuid), public.gamehub_tm_level_complete(uuid, integer), public.gamehub_tm_life_lost(uuid),
  public.gamehub_tm_integrity(uuid, text), public.gamehub_tournament_claim_prize(uuid, text) to authenticated;
