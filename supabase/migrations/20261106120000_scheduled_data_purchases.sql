create table if not exists public.scheduled_data_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  owner_type text not null check (owner_type in ('customer', 'agent')),
  owner_id uuid not null,
  phone text not null,
  package_id uuid not null references public.data_packages(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  run_time time not null,
  day_of_week integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 28),
  active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz not null default now(),
  unique (owner_type, owner_id, phone)
);

create index if not exists scheduled_data_purchases_due_idx on public.scheduled_data_purchases (next_run_at) where active;

alter table public.scheduled_data_purchases enable row level security;

drop policy if exists "owners read their schedules" on public.scheduled_data_purchases;
create policy "owners read their schedules" on public.scheduled_data_purchases for select to authenticated using (user_id = auth.uid());
drop policy if exists "owners delete their schedules" on public.scheduled_data_purchases;
create policy "owners delete their schedules" on public.scheduled_data_purchases for delete to authenticated using (user_id = auth.uid());

create or replace function public.compute_schedule_next_run(p_freq text, p_time time, p_dow integer, p_dom integer, p_after timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_after at time zone 'Africa/Accra';
  v_cand timestamp;
begin
  v_cand := date_trunc('day', v_local) + p_time;
  if p_freq = 'daily' then
    if v_cand <= v_local then v_cand := v_cand + interval '1 day'; end if;
  elsif p_freq = 'weekly' then
    v_cand := v_cand + (((p_dow - extract(dow from v_cand)::integer) + 7) % 7) * interval '1 day';
    if v_cand <= v_local then v_cand := v_cand + interval '7 days'; end if;
  else
    v_cand := date_trunc('month', v_local) + ((p_dom - 1) * interval '1 day') + p_time;
    if v_cand <= v_local then
      v_cand := date_trunc('month', v_local) + interval '1 month' + ((p_dom - 1) * interval '1 day') + p_time;
    end if;
  end if;
  return v_cand at time zone 'Africa/Accra';
end $$;

create or replace function public.upsert_data_schedule(
  p_owner_type text, p_owner_id uuid, p_phone text, p_package_id uuid,
  p_frequency text, p_run_time time, p_day_of_week integer, p_day_of_month integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_pkg public.data_packages;
  v_detected text;
  v_pkg_net text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to schedule purchases'; end if;
  if p_owner_type not in ('customer', 'agent') then raise exception 'Scheduling is not available for this account type'; end if;
  v_owner := public.wallet_resolve_own(p_owner_type, p_owner_id);
  if length(v_phone) <> 10 then raise exception 'Enter a valid 10-digit phone number'; end if;
  if p_frequency not in ('daily', 'weekly', 'monthly') then raise exception 'Choose how often to repeat'; end if;
  if p_run_time is null then raise exception 'Choose a time'; end if;
  if p_frequency = 'weekly' and (p_day_of_week is null or p_day_of_week not between 0 and 6) then raise exception 'Choose a day of the week'; end if;
  if p_frequency = 'monthly' and (p_day_of_month is null or p_day_of_month not between 1 and 28) then raise exception 'Choose a day of the month (1-28)'; end if;

  select * into v_pkg from public.data_packages where id = p_package_id and active;
  if not found then raise exception 'That data package is not available'; end if;

  v_detected := case
    when left(v_phone, 3) in ('024', '054', '055', '059', '025', '053') then 'mtn'
    when left(v_phone, 3) in ('027', '026', '056', '057') then 'airteltigo'
    when left(v_phone, 3) in ('020', '050') then 'telecel'
    else 'unknown' end;
  v_pkg_net := case when lower(v_pkg.network) in ('mtn', 'mtn_express', 'mtn_mashup', 'mashup') then 'mtn' else lower(v_pkg.network) end;
  if v_detected = 'unknown' or v_detected <> v_pkg_net then raise exception 'This number does not match the selected network'; end if;

  if not exists (select 1 from public.scheduled_data_purchases where owner_type = p_owner_type and owner_id = v_owner and phone = v_phone)
     and (select count(*) from public.scheduled_data_purchases where owner_type = p_owner_type and owner_id = v_owner) >= 20 then
    raise exception 'You can keep up to 20 schedules';
  end if;

  insert into public.scheduled_data_purchases (user_id, owner_type, owner_id, phone, package_id, frequency, run_time, day_of_week, day_of_month, active, next_run_at, last_status, last_error)
  values (auth.uid(), p_owner_type, v_owner, v_phone, p_package_id, p_frequency, p_run_time,
    case when p_frequency = 'weekly' then p_day_of_week end,
    case when p_frequency = 'monthly' then p_day_of_month end,
    true, public.compute_schedule_next_run(p_frequency, p_run_time, p_day_of_week, p_day_of_month, now()), null, null)
  on conflict (owner_type, owner_id, phone) do update set
    package_id = excluded.package_id, frequency = excluded.frequency, run_time = excluded.run_time,
    day_of_week = excluded.day_of_week, day_of_month = excluded.day_of_month, active = true,
    next_run_at = excluded.next_run_at, last_status = null, last_error = null, user_id = excluded.user_id
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_data_schedule_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.scheduled_data_purchases;
begin
  select * into r from public.scheduled_data_purchases where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Schedule not found'; end if;
  update public.scheduled_data_purchases
    set active = p_active,
        next_run_at = case when p_active then public.compute_schedule_next_run(r.frequency, r.run_time, r.day_of_week, r.day_of_month, now()) else next_run_at end
    where id = p_id;
end $$;

create or replace function public.run_scheduled_data_purchases()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  pkg public.data_packages;
  v_price numeric;
  v_order uuid;
  v_next timestamptz;
  v_done integer := 0;
begin
  for r in
    select * from public.scheduled_data_purchases
    where active and next_run_at <= now()
    order by next_run_at
    limit 100
    for update skip locked
  loop
    v_next := public.compute_schedule_next_run(r.frequency, r.run_time, r.day_of_week, r.day_of_month, now());
    begin
      select * into pkg from public.data_packages where id = r.package_id;
      if not found or pkg.active is not true then raise exception 'Package is no longer available'; end if;
      v_price := case when r.owner_type = 'agent' then coalesce(pkg.agent_price, pkg.price) else pkg.price end;
      v_order := gen_random_uuid();

      perform public.wallet_apply_internal(r.owner_type, r.owner_id, -v_price, 'data_purchase', v_order::text,
        'Scheduled ' || pkg.network || ' ' || pkg.size_gb || 'GB for ' || r.phone, r.user_id);

      if r.owner_type = 'customer' then
        insert into public.orders (id, package_id, customer_id, user_id, customer_number, network, size_gb, amount, status, fulfillment_status, payment_method, source)
        values (v_order, r.package_id, r.user_id, r.user_id, r.phone, pkg.network, pkg.size_gb, v_price, 'paid', 'pending', 'wallet', 'web');
      else
        insert into public.orders (id, package_id, agent_store_id, customer_number, network, size_gb, amount, status, fulfillment_status, payment_method)
        values (v_order, r.package_id, r.owner_id, r.phone, pkg.network, pkg.size_gb, v_price, 'paid', 'pending', 'wallet');
      end if;

      update public.scheduled_data_purchases set last_run_at = now(), last_status = 'success', last_error = null where id = r.id;
      v_done := v_done + 1;
    exception when others then
      update public.scheduled_data_purchases set last_run_at = now(), last_status = 'failed', last_error = left(sqlerrm, 200) where id = r.id;
    end;
    update public.scheduled_data_purchases set next_run_at = v_next where id = r.id;
  end loop;
  return v_done;
end $$;

revoke all on function public.run_scheduled_data_purchases() from public, anon, authenticated;
revoke all on function public.compute_schedule_next_run(text, time, integer, integer, timestamptz) from public, anon;
grant execute on function public.upsert_data_schedule(text, uuid, text, uuid, text, time, integer, integer) to authenticated;
grant execute on function public.set_data_schedule_active(uuid, boolean) to authenticated;
revoke execute on function public.upsert_data_schedule(text, uuid, text, uuid, text, time, integer, integer) from anon, public;
revoke execute on function public.set_data_schedule_active(uuid, boolean) from anon, public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('run-scheduled-data-purchases', '* * * * *', 'select public.run_scheduled_data_purchases()');
  end if;
end $$;
