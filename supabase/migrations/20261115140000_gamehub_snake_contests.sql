-- Snake War contests: players pay an entry fee from their wallet, play one timed Snake War match per
-- paid entry, and when the admin's closing time passes the longest snake wins a free MTN data prize.
-- The fee, timer, closing time and the minimum length needed to win are all set by the admin.

create table if not exists public.gamehub_snake_contests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '',
  entry_fee numeric not null default 0 check (entry_fee >= 0 and entry_fee <= 1000),
  prize_gb numeric not null check (prize_gb > 0),
  match_minutes integer not null default 4 check (match_minutes between 1 and 30),
  min_length integer not null default 0 check (min_length between 0 and 5000),
  max_attempts integer not null default 1 check (max_attempts between 1 and 20),
  closes_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'finished', 'cancelled')),
  winner_id uuid,
  winner_length integer,
  prize_claimed boolean not null default false,
  prize_order_id uuid,
  prize_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.gamehub_snake_attempts (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.gamehub_snake_contests(id) on delete cascade,
  user_id uuid not null,
  wallet_type text,
  wallet_id uuid,
  fee_paid numeric not null default 0,
  status text not null default 'paid' check (status in ('paid', 'playing', 'submitted', 'refunded')),
  started_at timestamptz,
  submitted_at timestamptz,
  length integer,
  created_at timestamptz not null default now()
);
create index if not exists gamehub_snake_attempts_contest_idx on public.gamehub_snake_attempts (contest_id, length desc);
create index if not exists gamehub_snake_attempts_user_idx on public.gamehub_snake_attempts (user_id, contest_id);

alter table public.gamehub_snake_contests enable row level security;
alter table public.gamehub_snake_attempts enable row level security;
revoke all on public.gamehub_snake_contests, public.gamehub_snake_attempts from anon, authenticated;

-- Settling -----------------------------------------------------------------------------------
-- A contest settles once it is closed and every started match has had time to finish.
create or replace function public.gamehub_snake_settle(p_c uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.gamehub_snake_contests; w public.gamehub_snake_attempts;
begin
  select * into c from public.gamehub_snake_contests where id = p_c for update;
  if not found or c.status <> 'open' or c.closes_at > now() then return; end if;
  if exists (
    select 1 from public.gamehub_snake_attempts a
    where a.contest_id = p_c and a.status = 'playing'
      and a.started_at + make_interval(mins => c.match_minutes) + interval '2 minutes' > now()
  ) then return; end if;

  select * into w from public.gamehub_snake_attempts
    where contest_id = p_c and status = 'submitted' and length >= greatest(c.min_length, 1)
    order by length desc, submitted_at asc limit 1;
  update public.gamehub_snake_contests
    set status = 'finished', winner_id = w.user_id, winner_length = w.length
    where id = p_c;
end $$;

create or replace function public.gamehub_snake_refund(p_a public.gamehub_snake_attempts, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_a.status = 'refunded' or p_a.fee_paid <= 0 or p_a.wallet_id is null then return; end if;
  perform public.wallet_apply_internal(
    p_a.wallet_type, p_a.wallet_id, p_a.fee_paid, 'gamehub_snake_refund',
    'snake-refund:' || p_a.id::text, 'Game Hub Snake War refund (' || p_title || ')', p_a.user_id
  );
  update public.gamehub_snake_attempts set status = 'refunded' where id = p_a.id;
end $$;

-- Admin ------------------------------------------------------------------------------------
create or replace function public.gamehub_snake_admin_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_fee numeric := coalesce((p ->> 'entry_fee')::numeric, 0);
  v_prize numeric := (p ->> 'prize_gb')::numeric;
  v_minutes integer := coalesce((p ->> 'match_minutes')::integer, 4);
  v_min integer := coalesce((p ->> 'min_length')::integer, 0);
  v_attempts integer := coalesce((p ->> 'max_attempts')::integer, 1);
  v_closes timestamptz := (p ->> 'closes_at')::timestamptz;
  v_publish boolean := coalesce((p ->> 'publish')::boolean, false);
  c public.gamehub_snake_contests;
  v_count integer := 0;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'Give the contest a title'; end if;
  if v_fee < 0 or v_fee > 1000 then raise exception 'Entry fee must be between 0 and 1000'; end if;
  if v_prize is null or v_prize <= 0 then raise exception 'Set a prize greater than 0 GB'; end if;
  if v_minutes < 1 or v_minutes > 30 then raise exception 'Match timer must be 1 to 30 minutes'; end if;
  if v_closes is null then raise exception 'Set when the contest closes'; end if;
  if not exists (select 1 from public.data_packages where lower(network) = 'mtn' and size_gb = v_prize and active = true) then
    raise exception 'No active MTN %GB package exists for this prize', v_prize;
  end if;

  if v_id is null then
    if v_closes <= now() then raise exception 'The closing time must be in the future'; end if;
    insert into public.gamehub_snake_contests (title, description, entry_fee, prize_gb, match_minutes, min_length, max_attempts, closes_at, status)
      values (trim(p ->> 'title'), coalesce(p ->> 'description', ''), v_fee, v_prize, v_minutes, v_min, v_attempts, v_closes,
              case when v_publish then 'open' else 'draft' end)
      returning id into v_id;
    return v_id;
  end if;

  select * into c from public.gamehub_snake_contests where id = v_id for update;
  if not found then raise exception 'Contest not found'; end if;
  if c.status in ('finished', 'cancelled') then raise exception 'This contest is already over'; end if;
  select count(*) into v_count from public.gamehub_snake_attempts where contest_id = v_id;
  if v_count > 0 and (c.entry_fee <> v_fee or c.prize_gb <> v_prize or c.match_minutes <> v_minutes or c.max_attempts <> v_attempts) then
    raise exception 'Players have already entered: fee, prize, match timer and attempts are locked';
  end if;
  update public.gamehub_snake_contests
    set title = trim(p ->> 'title'), description = coalesce(p ->> 'description', ''), entry_fee = v_fee, prize_gb = v_prize,
        match_minutes = v_minutes, min_length = v_min, max_attempts = v_attempts, closes_at = v_closes,
        status = case when v_publish then 'open' else status end
    where id = v_id;
  return v_id;
end $$;

create or replace function public.gamehub_snake_admin_cancel(p_c uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.gamehub_snake_contests; a public.gamehub_snake_attempts;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  select * into c from public.gamehub_snake_contests where id = p_c for update;
  if not found or c.status in ('finished', 'cancelled') then raise exception 'This contest is already over'; end if;
  for a in select * from public.gamehub_snake_attempts where contest_id = p_c and status <> 'refunded' loop
    perform public.gamehub_snake_refund(a, c.title);
  end loop;
  update public.gamehub_snake_contests set status = 'cancelled' where id = p_c;
end $$;

-- End the contest now: the longest snake so far wins.
create or replace function public.gamehub_snake_admin_end(p_c uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.gamehub_snake_contests;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  select * into c from public.gamehub_snake_contests where id = p_c for update;
  if not found or c.status <> 'open' then raise exception 'Only an open contest can be ended'; end if;
  update public.gamehub_snake_contests set closes_at = now() - interval '1 second' where id = p_c;
  update public.gamehub_snake_attempts set started_at = started_at - interval '1 hour'
    where contest_id = p_c and status = 'playing';
  perform public.gamehub_snake_settle(p_c);
end $$;

create or replace function public.gamehub_snake_json(c public.gamehub_snake_contests)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  return jsonb_build_object(
    'id', c.id, 'title', c.title, 'description', c.description, 'entry_fee', c.entry_fee, 'prize_gb', c.prize_gb,
    'match_minutes', c.match_minutes, 'min_length', c.min_length, 'max_attempts', c.max_attempts,
    'closes_at', c.closes_at, 'status', c.status, 'winner_length', c.winner_length,
    'winner_name', case when c.winner_id is null then null else public.gamehub_tm_name(c.winner_id) end,
    'prize_claimed', c.prize_claimed,
    'can_claim', (c.status = 'finished' and c.winner_id is not null and c.winner_id = v_me and not c.prize_claimed),
    'players', (select count(distinct user_id) from public.gamehub_snake_attempts where contest_id = c.id and status <> 'refunded'),
    'my_attempts', (select count(*) from public.gamehub_snake_attempts where contest_id = c.id and user_id = v_me and status <> 'refunded'),
    'my_best', (select max(length) from public.gamehub_snake_attempts where contest_id = c.id and user_id = v_me and status = 'submitted'),
    'my_pending', (select a.id from public.gamehub_snake_attempts a where a.contest_id = c.id and a.user_id = v_me and a.status = 'paid' order by a.created_at limit 1),
    'leaders', (select coalesce(jsonb_agg(jsonb_build_object('username', l.name, 'length', l.best) order by l.best desc), '[]'::jsonb) from (
        select public.gamehub_tm_name(a.user_id) as name, max(a.length) as best
        from public.gamehub_snake_attempts a
        where a.contest_id = c.id and a.status = 'submitted' group by a.user_id order by max(a.length) desc limit 10) l)
  );
end $$;

create or replace function public.gamehub_snake_admin_list()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  for r in select id from public.gamehub_snake_contests where status = 'open' loop perform public.gamehub_snake_settle(r.id); end loop;
  return (select coalesce(jsonb_agg(public.gamehub_snake_json(c) || jsonb_build_object(
      'prize_phone', c.prize_phone,
      'collected', (select coalesce(sum(fee_paid), 0) from public.gamehub_snake_attempts where contest_id = c.id and status <> 'refunded')
    ) order by c.created_at desc), '[]'::jsonb) from public.gamehub_snake_contests c);
end $$;

-- Players ------------------------------------------------------------------------------------
create or replace function public.gamehub_snake_list()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.gamehub_snake_contests where status = 'open' and closes_at <= now() loop
    perform public.gamehub_snake_settle(r.id);
  end loop;
  return (select coalesce(jsonb_agg(public.gamehub_snake_json(c) order by (c.status = 'open') desc, c.closes_at desc), '[]'::jsonb)
    from public.gamehub_snake_contests c
    where c.status = 'open' or (c.status = 'finished' and c.created_at > now() - interval '14 days'));
end $$;

create or replace function public.gamehub_snake_join(p_c uuid, p_hint text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.gamehub_snake_contests;
  w jsonb;
  v_id uuid := gen_random_uuid();
  v_used integer;
begin
  if auth.uid() is null then raise exception 'Sign in to enter a contest'; end if;
  select * into c from public.gamehub_snake_contests where id = p_c for update;
  if not found or c.status <> 'open' or c.closes_at <= now() then raise exception 'This contest is not open for entries'; end if;
  select count(*) into v_used from public.gamehub_snake_attempts where contest_id = p_c and user_id = auth.uid() and status <> 'refunded';
  if v_used >= c.max_attempts then raise exception 'You have used all % entries for this contest', c.max_attempts; end if;
  if exists (select 1 from public.gamehub_snake_attempts where contest_id = p_c and user_id = auth.uid() and status in ('paid', 'playing')) then
    raise exception 'Finish your current Snake War match first';
  end if;

  w := null;
  if c.entry_fee > 0 then
    w := public.gamehub_resolve_wallet(p_hint);
    if w is null then raise exception 'No wallet found for this account'; end if;
    if (w ->> 'balance')::numeric < c.entry_fee then
      raise exception 'Insufficient wallet balance. Top up GH₵% to enter', c.entry_fee;
    end if;
    perform public.wallet_apply_internal(
      w ->> 'owner_type', (w ->> 'owner_id')::uuid, -c.entry_fee, 'gamehub_snake_fee',
      'snake-fee:' || v_id::text, 'Game Hub Snake War entry (' || c.title || ')', auth.uid()
    );
  end if;
  insert into public.gamehub_snake_attempts (id, contest_id, user_id, wallet_type, wallet_id, fee_paid)
    values (v_id, p_c, auth.uid(), w ->> 'owner_type', (w ->> 'owner_id')::uuid, case when c.entry_fee > 0 then c.entry_fee else 0 end);
  return jsonb_build_object('ok', true, 'attempt_id', v_id);
end $$;

-- Starts the match clock. The server decides how long the match lasts and when it may be submitted.
create or replace function public.gamehub_snake_start(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.gamehub_snake_attempts; c public.gamehub_snake_contests;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into a from public.gamehub_snake_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'Entry not found'; end if;
  select * into c from public.gamehub_snake_contests where id = a.contest_id;
  if a.status <> 'paid' then raise exception 'This entry has already been played'; end if;
  if c.status <> 'open' or c.closes_at <= now() then raise exception 'This contest has closed'; end if;
  update public.gamehub_snake_attempts set status = 'playing', started_at = now() where id = p_attempt;
  return jsonb_build_object('ok', true, 'match_minutes', c.match_minutes);
end $$;

create or replace function public.gamehub_snake_submit(p_attempt uuid, p_length integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.gamehub_snake_attempts; c public.gamehub_snake_contests; v_cap integer; v_len integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into a from public.gamehub_snake_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'Entry not found'; end if;
  if a.status <> 'playing' then raise exception 'This match was already submitted'; end if;
  select * into c from public.gamehub_snake_contests where id = a.contest_id;
  if now() < a.started_at + make_interval(mins => c.match_minutes) - interval '15 seconds' then
    raise exception 'The match timer has not finished yet';
  end if;
  v_cap := 15 + c.match_minutes * 150;
  v_len := least(greatest(coalesce(p_length, 0), 0), v_cap);
  update public.gamehub_snake_attempts set status = 'submitted', submitted_at = now(), length = v_len where id = p_attempt;
  perform public.gamehub_snake_settle(a.contest_id);
  return jsonb_build_object('ok', true, 'length', v_len);
end $$;

create or replace function public.gamehub_snake_claim_prize(p_c uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.gamehub_snake_contests;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_package uuid;
  v_order uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to claim your prize'; end if;
  if length(v_phone) = 12 and left(v_phone, 3) = '233' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone !~ '^0(24|25|53|54|55|59)[0-9]{7}$' then raise exception 'Enter a valid MTN number (e.g. 0241234567)'; end if;
  select * into c from public.gamehub_snake_contests where id = p_c for update;
  if not found or c.status <> 'finished' or c.winner_id is distinct from auth.uid() then raise exception 'Only the contest winner can claim this prize'; end if;
  if c.prize_claimed then raise exception 'This prize was already claimed'; end if;
  select id into v_package from public.data_packages where lower(network) = 'mtn' and size_gb = c.prize_gb and active = true order by price asc limit 1;
  if v_package is null then raise exception 'The MTN %GB prize is unavailable right now', c.prize_gb; end if;
  v_order := public.create_free_claim_order(v_phone, 'mtn', c.prize_gb, v_package, null, null);
  update public.gamehub_snake_contests set prize_claimed = true, prize_order_id = v_order, prize_phone = v_phone where id = p_c;
  return jsonb_build_object('ok', true, 'order_id', v_order, 'phone', v_phone, 'reward_gb', c.prize_gb);
end $$;

revoke all on function public.gamehub_snake_settle(uuid), public.gamehub_snake_refund(public.gamehub_snake_attempts, text),
  public.gamehub_snake_json(public.gamehub_snake_contests) from public, anon, authenticated;
revoke all on function public.gamehub_snake_admin_save(jsonb), public.gamehub_snake_admin_cancel(uuid), public.gamehub_snake_admin_end(uuid),
  public.gamehub_snake_admin_list() from public, anon;
grant execute on function public.gamehub_snake_admin_save(jsonb), public.gamehub_snake_admin_cancel(uuid), public.gamehub_snake_admin_end(uuid),
  public.gamehub_snake_admin_list() to authenticated;
revoke all on function public.gamehub_snake_list(), public.gamehub_snake_join(uuid, text), public.gamehub_snake_start(uuid),
  public.gamehub_snake_submit(uuid, integer), public.gamehub_snake_claim_prize(uuid, text) from public, anon;
grant execute on function public.gamehub_snake_list() to anon, authenticated;
grant execute on function public.gamehub_snake_join(uuid, text), public.gamehub_snake_start(uuid),
  public.gamehub_snake_submit(uuid, integer), public.gamehub_snake_claim_prize(uuid, text) to authenticated;
