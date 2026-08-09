-- Run once in Supabase SQL Editor after reviewing in a staging project first.
-- Adds per-network automation and protects role reads.

alter table public.delivery_progress_settings
  add column if not exists auto_enabled boolean not null default false,
  add column if not exists auto_min_minutes integer not null default 30,
  add column if not exists auto_max_minutes integer not null default 180;

alter table public.delivery_progress_settings
  add constraint delivery_progress_settings_auto_window_valid
  check (auto_min_minutes >= 0 and auto_max_minutes >= auto_min_minutes)
  not valid;

alter table public.user_roles enable row level security;

-- Users may read only their own role so login routing can work.
-- This does not allow inserting, updating, or deleting roles.
drop policy if exists "Users can view own role" on public.user_roles;
create policy "Users can view own role"
on public.user_roles
for select
to authenticated
using (
  auth.uid() = user_id
  or has_role(auth.uid(), 'admin'::app_role)
);

create or replace function public.run_delivery_automation_job()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  update public.orders o
  set order_status = 'delivered', updated_at = now()
  from public.delivery_progress_settings s
  where s.network = lower(trim(o.network))
    and s.enabled = true
    and s.auto_enabled = true
    and exists (
      select 1
      from public.delivery_progress_settings g
      where g.network = '__global__'
        and g.enabled = true
    )
    and o.order_status = 'processing'
    and o.created_at <= now() - make_interval(mins => greatest(s.auto_min_minutes, 0))
    and o.created_at >= now() - make_interval(mins => greatest(s.auto_max_minutes, s.auto_min_minutes))
    and (
      s.auto_max_minutes = s.auto_min_minutes
      or extract(epoch from (now() - o.created_at)) / 60 >=
        s.auto_min_minutes + mod(abs(hashtext(o.id::text)), s.auto_max_minutes - s.auto_min_minutes + 1)
    );

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function public.admin_run_delivery_automation()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin access required';
  end if;

  return public.run_delivery_automation_job();
end;
$$;

create or replace function public.run_delivery_automation_job_body()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.run_delivery_automation_job();
end;
$$;

/* Keep the existing automation update logic in the worker function. */
/* The admin RPC below remains protected for the dashboard Run now button. */

/*
  The following block is intentionally separate so it can be rerun safely.
  Supabase projects with pg_cron enabled will run the worker every minute.
*/
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'delivery-automation-every-minute';

    perform cron.schedule(
      'delivery-automation-every-minute',
      '* * * * *',
      'select public.run_delivery_automation_job_body();'
    );
  end if;
end;
$$;

revoke all on function public.run_delivery_automation_job() from public;
revoke all on function public.run_delivery_automation_job_body() from public;
revoke all on function public.admin_run_delivery_automation() from public;
grant execute on function public.admin_run_delivery_automation() to authenticated;

notify pgrst, 'reload schema';
