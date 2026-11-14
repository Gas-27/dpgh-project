-- Game Hub social layer: player usernames, direct messages, blocks and live Tic-Tac-Toe matches.
-- All writes go through SECURITY DEFINER functions; tables are read-only for clients under RLS.

create table if not exists public.gamehub_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint gamehub_players_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create table if not exists public.gamehub_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'game_invite', 'match')),
  body text not null check (char_length(body) between 1 and 1000),
  game_id text check (game_id is null or char_length(game_id) <= 80),
  match_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint gamehub_messages_not_self check (sender_id <> recipient_id)
);
create index if not exists gamehub_messages_recipient_idx on public.gamehub_messages (recipient_id, created_at desc);
create index if not exists gamehub_messages_sender_idx on public.gamehub_messages (sender_id, created_at desc);

create table if not exists public.gamehub_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.gamehub_matches (
  id uuid primary key default gen_random_uuid(),
  game_id text not null default 'tic-tac-toe',
  player_x uuid not null references auth.users(id) on delete cascade,
  player_o uuid not null references auth.users(id) on delete cascade,
  board text not null default '.........' check (char_length(board) = 9),
  turn uuid,
  status text not null default 'pending' check (status in ('pending', 'active', 'finished', 'declined')),
  winner uuid,
  is_draw boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gamehub_matches_two_players check (player_x <> player_o)
);
create index if not exists gamehub_matches_x_idx on public.gamehub_matches (player_x);
create index if not exists gamehub_matches_o_idx on public.gamehub_matches (player_o);

alter table public.gamehub_players enable row level security;
alter table public.gamehub_messages enable row level security;
alter table public.gamehub_blocks enable row level security;
alter table public.gamehub_matches enable row level security;

drop policy if exists "gamehub players are visible to signed-in users" on public.gamehub_players;
create policy "gamehub players are visible to signed-in users" on public.gamehub_players
  for select to authenticated using (true);

drop policy if exists "gamehub messages visible to participants" on public.gamehub_messages;
create policy "gamehub messages visible to participants" on public.gamehub_messages
  for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "gamehub blocks visible to blocker" on public.gamehub_blocks;
create policy "gamehub blocks visible to blocker" on public.gamehub_blocks
  for select to authenticated using (auth.uid() = blocker_id);

drop policy if exists "gamehub matches visible to players" on public.gamehub_matches;
create policy "gamehub matches visible to players" on public.gamehub_matches
  for select to authenticated using (auth.uid() = player_x or auth.uid() = player_o);

revoke all on public.gamehub_players, public.gamehub_messages, public.gamehub_blocks, public.gamehub_matches from anon;
revoke insert, update, delete on public.gamehub_players, public.gamehub_messages, public.gamehub_blocks, public.gamehub_matches from authenticated;

create or replace function public.gamehub_assert_can_chat(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_other is null or p_other = auth.uid() then raise exception 'invalid_recipient'; end if;
  if not exists (select 1 from public.gamehub_players where user_id = auth.uid()) then raise exception 'username_required'; end if;
  if not exists (select 1 from public.gamehub_players where user_id = p_other) then raise exception 'player_not_found'; end if;
  if exists (
    select 1 from public.gamehub_blocks
    where (blocker_id = auth.uid() and blocked_id = p_other) or (blocker_id = p_other and blocked_id = auth.uid())
  ) then raise exception 'blocked'; end if;
end $$;

create or replace function public.gamehub_rate_check()
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.gamehub_messages where sender_id = auth.uid() and created_at > now() - interval '60 seconds') >= 20 then
    raise exception 'slow_down';
  end if;
end $$;

create or replace function public.gamehub_set_username(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := lower(trim(coalesce(p_username, '')));
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then raise exception 'invalid_username'; end if;
  begin
    insert into public.gamehub_players (user_id, username) values (auth.uid(), v_name)
    on conflict (user_id) do update set username = excluded.username;
  exception when unique_violation then
    raise exception 'username_taken';
  end;
  return v_name;
end $$;

create or replace function public.gamehub_search_players(p_query text)
returns table (player_id uuid, player_username text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username
  from public.gamehub_players p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and char_length(trim(coalesce(p_query, ''))) >= 2
    and p.username like regexp_replace(lower(trim(p_query)), '([%_\\])', '\\\1', 'g') || '%'
    and not exists (
      select 1 from public.gamehub_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id) or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
    )
  order by p.username
  limit 20
$$;

create or replace function public.gamehub_send_message(p_recipient uuid, p_body text, p_kind text default 'text', p_game_id text default null)
returns public.gamehub_messages language plpgsql security definer set search_path = public as $$
declare
  v_body text := trim(coalesce(p_body, ''));
  v_row public.gamehub_messages;
begin
  perform public.gamehub_assert_can_chat(p_recipient);
  perform public.gamehub_rate_check();
  if p_kind not in ('text', 'game_invite') then raise exception 'invalid_kind'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then raise exception 'invalid_body'; end if;
  if p_kind = 'game_invite' and (p_game_id is null or char_length(p_game_id) > 80) then raise exception 'invalid_game'; end if;
  insert into public.gamehub_messages (sender_id, recipient_id, kind, body, game_id)
  values (auth.uid(), p_recipient, p_kind, v_body, case when p_kind = 'game_invite' then p_game_id else null end)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.gamehub_conversations()
returns table (peer_id uuid, peer_username text, last_body text, last_kind text, last_at timestamptz, last_from_me boolean, unread_count int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.*, case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as peer
    from public.gamehub_messages m
    where auth.uid() is not null and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
  ),
  latest as (
    select distinct on (peer) peer, body, kind, created_at, sender_id
    from mine order by peer, created_at desc
  ),
  unread as (
    select sender_id as peer, count(*)::int as total
    from public.gamehub_messages
    where recipient_id = auth.uid() and read_at is null
    group by sender_id
  )
  select l.peer, p.username, l.body, l.kind, l.created_at, (l.sender_id = auth.uid()), coalesce(u.total, 0)
  from latest l
  join public.gamehub_players p on p.user_id = l.peer
  left join unread u on u.peer = l.peer
  where not exists (select 1 from public.gamehub_blocks b where b.blocker_id = auth.uid() and b.blocked_id = l.peer)
  order by l.created_at desc
$$;

create or replace function public.gamehub_mark_read(p_peer uuid)
returns void language sql security definer set search_path = public as $$
  update public.gamehub_messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_peer and read_at is null
$$;

create or replace function public.gamehub_block_player(p_user uuid, p_blocked boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_user is null or p_user = auth.uid() then raise exception 'invalid_recipient'; end if;
  if p_blocked then
    insert into public.gamehub_blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  else
    delete from public.gamehub_blocks where blocker_id = auth.uid() and blocked_id = p_user;
  end if;
end $$;

create or replace function public.gamehub_challenge(p_opponent uuid)
returns public.gamehub_matches language plpgsql security definer set search_path = public as $$
declare v_match public.gamehub_matches;
begin
  perform public.gamehub_assert_can_chat(p_opponent);
  perform public.gamehub_rate_check();
  insert into public.gamehub_matches (player_x, player_o, turn, status)
  values (auth.uid(), p_opponent, auth.uid(), 'pending')
  returning * into v_match;
  insert into public.gamehub_messages (sender_id, recipient_id, kind, body, game_id, match_id)
  values (auth.uid(), p_opponent, 'match', 'Tic-Tac-Toe challenge', 'tic-tac-toe', v_match.id);
  return v_match;
end $$;

create or replace function public.gamehub_respond_match(p_match uuid, p_accept boolean)
returns public.gamehub_matches language plpgsql security definer set search_path = public as $$
declare v_match public.gamehub_matches;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into v_match from public.gamehub_matches where id = p_match for update;
  if not found or v_match.player_o <> auth.uid() then raise exception 'match_not_found'; end if;
  if v_match.status <> 'pending' then raise exception 'match_not_pending'; end if;
  update public.gamehub_matches
  set status = case when p_accept then 'active' else 'declined' end, updated_at = now()
  where id = p_match returning * into v_match;
  return v_match;
end $$;

create or replace function public.gamehub_play_move(p_match uuid, p_cell int)
returns public.gamehub_matches language plpgsql security definer set search_path = public as $$
declare
  v_match public.gamehub_matches;
  v_mark text;
  v_board text;
  v_win boolean := false;
  v_done boolean;
  v_lines int[] := array[1,2,3, 4,5,6, 7,8,9, 1,4,7, 2,5,8, 3,6,9, 1,5,9, 3,5,7];
  i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into v_match from public.gamehub_matches where id = p_match for update;
  if not found or auth.uid() not in (v_match.player_x, v_match.player_o) then raise exception 'match_not_found'; end if;
  if v_match.status <> 'active' then raise exception 'match_not_active'; end if;
  if v_match.turn is distinct from auth.uid() then raise exception 'not_your_turn'; end if;
  if p_cell is null or p_cell < 0 or p_cell > 8 then raise exception 'invalid_cell'; end if;
  if substr(v_match.board, p_cell + 1, 1) <> '.' then raise exception 'cell_taken'; end if;

  v_mark := case when auth.uid() = v_match.player_x then 'X' else 'O' end;
  v_board := overlay(v_match.board placing v_mark from p_cell + 1 for 1);
  for i in 0..7 loop
    if substr(v_board, v_lines[i*3+1], 1) = v_mark
       and substr(v_board, v_lines[i*3+2], 1) = v_mark
       and substr(v_board, v_lines[i*3+3], 1) = v_mark then
      v_win := true;
      exit;
    end if;
  end loop;
  v_done := v_win or position('.' in v_board) = 0;

  update public.gamehub_matches set
    board = v_board,
    status = case when v_done then 'finished' else 'active' end,
    winner = case when v_win then auth.uid() else null end,
    is_draw = (not v_win and v_done),
    turn = case when v_done then null when auth.uid() = v_match.player_x then v_match.player_o else v_match.player_x end,
    updated_at = now()
  where id = p_match returning * into v_match;
  return v_match;
end $$;

revoke all on function public.gamehub_assert_can_chat(uuid), public.gamehub_rate_check() from public, anon, authenticated;
revoke all on function public.gamehub_set_username(text), public.gamehub_search_players(text), public.gamehub_send_message(uuid, text, text, text),
  public.gamehub_conversations(), public.gamehub_mark_read(uuid), public.gamehub_block_player(uuid, boolean),
  public.gamehub_challenge(uuid), public.gamehub_respond_match(uuid, boolean), public.gamehub_play_move(uuid, int) from public, anon;
grant execute on function public.gamehub_set_username(text), public.gamehub_search_players(text), public.gamehub_send_message(uuid, text, text, text),
  public.gamehub_conversations(), public.gamehub_mark_read(uuid), public.gamehub_block_player(uuid, boolean),
  public.gamehub_challenge(uuid), public.gamehub_respond_match(uuid, boolean), public.gamehub_play_move(uuid, int) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.gamehub_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.gamehub_matches;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
