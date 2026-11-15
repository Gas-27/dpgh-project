-- Scheduled bulk SMS for customers, agents, subagents and sub-subagents.
-- The wallet is charged by claim_due_scheduled_sms BEFORE any message is handed to the SMS provider.
-- If the wallet cannot cover the run, nothing is sent and the run is marked failed.

create table if not exists public.scheduled_sms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  owner_type text not null check (owner_type in ('customer', 'agent', 'subagent', 'subsubagent')),
  owner_id uuid,
  sender_id text not null,
  message text not null check (char_length(message) between 1 and 1600),
  recipients text[] not null,
  frequency text not null check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  run_time time,
  day_of_week integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 28),
  active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_sms_due_idx on public.scheduled_sms (next_run_at) where active;
create index if not exists scheduled_sms_owner_idx on public.scheduled_sms (user_id, created_at desc);

alter table public.scheduled_sms enable row level security;

drop policy if exists "owners read their sms schedules" on public.scheduled_sms;
create policy "owners read their sms schedules" on public.scheduled_sms for select to authenticated using (user_id = auth.uid());
drop policy if exists "owners delete their sms schedules" on public.scheduled_sms;
create policy "owners delete their sms schedules" on public.scheduled_sms for delete to authenticated using (user_id = auth.uid());

create or replace function public.create_sms_schedule(
  p_owner_type text, p_owner_id uuid, p_sender_id text, p_message text, p_recipients text[],
  p_frequency text, p_run_at timestamptz, p_run_time time, p_day_of_week integer, p_day_of_month integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender text := upper(regexp_replace(trim(coalesce(p_sender_id, '')), '\s+', ' ', 'g'));
  v_message text := trim(coalesce(p_message, ''));
  v_recipients text[];
  v_next timestamptz;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to schedule SMS'; end if;
  if p_owner_type not in ('customer', 'agent', 'subagent', 'subsubagent') then raise exception 'Scheduling is not available for this account type'; end if;
  if v_sender = '' or char_length(v_sender) > 11 then raise exception 'Choose an approved sender ID'; end if;
  if v_message = '' or char_length(v_message) > 1600 then raise exception 'Write a message (up to 1600 characters)'; end if;
  if p_frequency not in ('once', 'daily', 'weekly', 'monthly') then raise exception 'Choose when to send'; end if;

  select coalesce(array_agg(distinct n), '{}') into v_recipients from (
    select case
      when d ~ '^233[0-9]{9}$' then '0' || substr(d, 4)
      when d ~ '^[0-9]{9}$' then '0' || d
      else d end as n
    from (select regexp_replace(x, '[^0-9]', '', 'g') as d from unnest(coalesce(p_recipients, '{}')) as x) s
  ) t where n ~ '^0[2-5][0-9]{8}$';
  if coalesce(array_length(v_recipients, 1), 0) = 0 then raise exception 'Add at least one valid Ghana phone number'; end if;
  if array_length(v_recipients, 1) > 5000 then raise exception 'A schedule can have up to 5000 recipients'; end if;

  if not exists (
    select 1 from public.sms_sender_ids s
    where upper(s.sender_id) = v_sender and s.status = 'approved' and (s.is_global or s.user_id = auth.uid() or s.user_id is null)
  ) then raise exception 'This sender ID is not approved yet'; end if;
  if coalesce(public.is_sms_sender_blocked(v_sender), false) then raise exception 'This sender ID is locked and cannot be used'; end if;

  if (select count(*) from public.scheduled_sms where user_id = auth.uid() and active) >= 30 then
    raise exception 'You can keep up to 30 active SMS schedules';
  end if;

  if p_frequency = 'once' then
    if p_run_at is null then raise exception 'Choose a date and time'; end if;
    if p_run_at < now() - interval '1 minute' then raise exception 'Choose a time in the future'; end if;
    if p_run_at > now() + interval '1 year' then raise exception 'Choose a date within the next year'; end if;
    v_next := p_run_at;
  else
    if p_run_time is null then raise exception 'Choose a time'; end if;
    if p_frequency = 'weekly' and (p_day_of_week is null or p_day_of_week not between 0 and 6) then raise exception 'Choose a day of the week'; end if;
    if p_frequency = 'monthly' and (p_day_of_month is null or p_day_of_month not between 1 and 28) then raise exception 'Choose a day of the month (1-28)'; end if;
    v_next := public.compute_schedule_next_run(p_frequency, p_run_time, p_day_of_week, p_day_of_month, now());
  end if;

  insert into public.scheduled_sms (user_id, owner_type, owner_id, sender_id, message, recipients, frequency, run_time, day_of_week, day_of_month, next_run_at)
  values (auth.uid(), p_owner_type, p_owner_id, v_sender, v_message, v_recipients, p_frequency,
    case when p_frequency <> 'once' then p_run_time end,
    case when p_frequency = 'weekly' then p_day_of_week end,
    case when p_frequency = 'monthly' then p_day_of_month end,
    v_next)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_sms_schedule_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.scheduled_sms;
begin
  select * into r from public.scheduled_sms where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Schedule not found'; end if;
  if p_active and r.frequency = 'once' and r.next_run_at < now() then raise exception 'This one-time SMS has already run. Create a new schedule instead'; end if;
  update public.scheduled_sms
    set active = p_active,
        next_run_at = case when p_active and r.frequency <> 'once'
          then public.compute_schedule_next_run(r.frequency, r.run_time, r.day_of_week, r.day_of_month, now())
          else next_run_at end
    where id = p_id;
end $$;

-- Called by the run-scheduled-sms edge function (service role only).
-- Charges the wallet first; a run whose wallet cannot pay is recorded as failed and nothing is sent.
create or replace function public.claim_due_scheduled_sms(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.scheduled_sms;
  v_settings record;
  v_storefront boolean;
  v_contact numeric;
  v_page numeric;
  v_pages integer;
  v_total numeric;
  v_ok boolean;
  v_next timestamptz;
  v_jobs jsonb := '[]'::jsonb;
begin
  select sms_dashboard_recipient_price, sms_dashboard_page_price, sms_storefront_recipient_price, sms_storefront_page_price
    into v_settings from public.app_settings where id = 1;

  for r in
    select * from public.scheduled_sms
    where active and next_run_at <= now()
    order by next_run_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  loop
    v_next := case when r.frequency = 'once' then r.next_run_at
      else public.compute_schedule_next_run(r.frequency, r.run_time, r.day_of_week, r.day_of_month, now()) end;
    begin
      if not exists (
        select 1 from public.sms_sender_ids s
        where upper(s.sender_id) = upper(r.sender_id) and s.status = 'approved' and (s.is_global or s.user_id = r.user_id or s.user_id is null)
      ) then raise exception 'Sender ID is no longer approved'; end if;
      if coalesce(public.is_sms_sender_blocked(r.sender_id), false) then raise exception 'Sender ID is locked'; end if;

      v_storefront := r.owner_type <> 'customer';
      v_contact := coalesce(case when v_storefront then v_settings.sms_storefront_recipient_price else v_settings.sms_dashboard_recipient_price end, 0);
      v_page := coalesce(case when v_storefront then v_settings.sms_storefront_page_price else v_settings.sms_dashboard_page_price end, 0);
      v_pages := greatest(1, ceil(char_length(r.message) / 160.0)::integer);
      v_total := (v_contact * array_length(r.recipients, 1)) + (v_page * v_pages);

      select public.charge_sms_wallet(r.user_id, v_total, r.owner_type) into v_ok;
      if not coalesce(v_ok, false) then raise exception 'Insufficient wallet balance for this scheduled SMS'; end if;

      update public.scheduled_sms
        set last_run_at = now(), last_status = 'sending', last_error = null,
            next_run_at = v_next, active = (r.frequency <> 'once')
        where id = r.id;

      v_jobs := v_jobs || jsonb_build_array(jsonb_build_object(
        'schedule_id', r.id, 'user_id', r.user_id, 'owner_type', r.owner_type, 'owner_id', coalesce(r.owner_id, r.user_id),
        'sender_id', r.sender_id, 'message', r.message, 'recipients', to_jsonb(r.recipients),
        'unit_price', v_contact, 'total_charge', v_total));
    exception when others then
      update public.scheduled_sms
        set last_run_at = now(), last_status = 'failed', last_error = left(sqlerrm, 200),
            next_run_at = v_next, active = (r.frequency <> 'once')
        where id = r.id;
    end;
  end loop;
  return v_jobs;
end $$;

revoke all on function public.claim_due_scheduled_sms(integer) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_sms(integer) to service_role;

revoke all on function public.create_sms_schedule(text, uuid, text, text, text[], text, timestamptz, time, integer, integer) from public, anon;
grant execute on function public.create_sms_schedule(text, uuid, text, text, text[], text, timestamptz, time, integer, integer) to authenticated;
revoke all on function public.set_sms_schedule_active(uuid, boolean) from public, anon;
grant execute on function public.set_sms_schedule_active(uuid, boolean) to authenticated;

-- Runner wiring --------------------------------------------------------------------------------
-- pg_cron asks the run-scheduled-sms edge function to work every minute. The edge function URL and
-- secrets live in this single-row table, which only the service role can read.
create table if not exists public.sms_schedule_runner (
  id integer primary key default 1 check (id = 1),
  function_url text not null,
  auth_token text not null,
  cron_secret text not null
);
alter table public.sms_schedule_runner enable row level security;
revoke all on public.sms_schedule_runner from public, anon, authenticated;

create or replace function public.trigger_scheduled_sms_runner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.sms_schedule_runner;
begin
  if not exists (select 1 from public.scheduled_sms where active and next_run_at <= now()) then return; end if;
  select * into c from public.sms_schedule_runner where id = 1;
  if not found or not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  execute format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
    c.function_url,
    jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || c.auth_token, 'x-cron-secret', c.cron_secret)::text,
    '{}'
  );
end $$;
revoke all on function public.trigger_scheduled_sms_runner() from public, anon, authenticated;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('run-scheduled-sms', '* * * * *', 'select public.trigger_scheduled_sms_runner()');
  end if;
end $do$;
