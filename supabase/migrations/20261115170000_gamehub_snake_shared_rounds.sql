create or replace function public.gamehub_snake_start(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.gamehub_snake_attempts;
  c public.gamehub_snake_contests;
  v_now timestamptz := clock_timestamp();
  v_len double precision;
  v_start timestamptz;
  v_end timestamptz;
  v_left integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into a from public.gamehub_snake_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'Entry not found'; end if;
  select * into c from public.gamehub_snake_contests where id = a.contest_id;
  if a.status <> 'paid' then raise exception 'This entry has already been played'; end if;
  if c.status <> 'open' or c.closes_at <= v_now then raise exception 'This contest has closed'; end if;

  v_len := c.match_minutes * 60;
  v_start := to_timestamp(floor(extract(epoch from v_now) / v_len) * v_len);
  v_end := v_start + make_interval(secs => v_len);
  v_left := ceil(extract(epoch from v_end - v_now))::integer;
  if v_left < 45 then
    raise exception 'This round ends in % seconds. Your entry is safe - tap play again when the next round starts.', v_left;
  end if;

  update public.gamehub_snake_attempts set status = 'playing', started_at = v_start where id = p_attempt;
  return jsonb_build_object(
    'ok', true,
    'match_minutes', c.match_minutes,
    'round_start_ms', (extract(epoch from v_start) * 1000)::bigint,
    'round_end_ms', (extract(epoch from v_end) * 1000)::bigint,
    'server_ms', (extract(epoch from v_now) * 1000)::bigint
  );
end $function$;

notify pgrst, 'reload schema';
