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

create or replace function public.admin_run_delivery_automation()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin access required';
  end if;

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
    and o.created_at >= now() - make_interval(mins => greatest(
      s.auto_max_minutes,
      s.auto_min_minutes
    ))
    and (
      s.auto_max_minutes = s.auto_min_minutes
      or extract(epoch from (now() - o.created_at)) / 60 >= s.auto_min_minutes
        + mod(abs(hashtext(o.id::text)), greatest(s.auto_max_minutes - s.auto_min_minutes + 1, 1))
    );

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

revoke all on function public.admin_run_delivery_automation() from public;
grant execute on function public.admin_run_delivery_automation() to authenticated;

-- Unattended execution requires Supabase Cron/pg_cron or an external scheduler.
-- Example scheduler call should invoke this function using a protected server credential,
-- never from an unauthenticated browser.
