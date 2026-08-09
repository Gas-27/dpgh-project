-- Run this entire script in Supabase SQL Editor.
create table if not exists public.delivery_progress_settings (
  network text primary key,
  enabled boolean not null default true,
  is_default boolean not null default false,
  source text not null default 'manual' check (source in ('manual','orders','fake')),
  min_minutes integer not null default 30 check (min_minutes >= 2),
  max_minutes integer not null default 240 check (max_minutes >= min_minutes),
  rotation_minutes integer not null default 30 check (rotation_minutes >= 1),
  fake_enabled boolean not null default false,
  fake_prefix text not null default '024',
  fake_count integer not null default 10 check (fake_count between 1 and 100),
  status_color text not null default 'green' check (status_color in ('green','red','yellow')),
  message text not null default 'Orders are being processed. Please allow the estimated delivery window.',
  updated_at timestamptz not null default now()
);

alter table public.delivery_progress_settings add column if not exists is_default boolean not null default false;
alter table public.delivery_progress_settings add column if not exists rotation_minutes integer not null default 30;
alter table public.delivery_progress_settings add column if not exists fake_enabled boolean not null default false;
alter table public.delivery_progress_settings add column if not exists fake_prefix text not null default '024';
alter table public.delivery_progress_settings add column if not exists fake_count integer not null default 10;
alter table public.delivery_progress_settings add column if not exists status_color text not null default 'green';
alter table public.delivery_progress_settings add column if not exists auto_enabled boolean not null default false;
alter table public.delivery_progress_settings add column if not exists auto_min_minutes integer not null default 30;
alter table public.delivery_progress_settings add column if not exists auto_max_minutes integer not null default 240;
alter table public.delivery_progress_settings drop constraint if exists delivery_progress_settings_source_check;
alter table public.delivery_progress_settings add constraint delivery_progress_settings_source_check check (source in ('manual','orders','fake'));

insert into public.delivery_progress_settings (network, source, min_minutes, max_minutes, rotation_minutes, fake_enabled, fake_prefix, fake_count, message)
values
('mtn','manual',60,240,30,false,'024',10,'There may be a validation issue on the MTN portal. Orders are still being processed and will be delivered.'),
('mtn_express','fake',15,90,30,true,'024',10,'MTN Express orders are usually delivered quickly, but delivery can vary by order volume.'),
('telecel','manual',30,180,30,false,'020',10,'Telecel orders are being processed. Please allow the estimated delivery window.'),
('airteltigo','manual',30,180,30,false,'026',10,'AirtelTigo orders are being processed. Please allow the estimated delivery window.')
on conflict (network) do nothing;

alter table public.delivery_progress_settings enable row level security;
drop policy if exists "Public can view delivery progress" on public.delivery_progress_settings;
create policy "Public can view delivery progress" on public.delivery_progress_settings for select using (true);

-- This RPC avoids client-side RLS insert/upsert failures while checking the signed-in admin.
create or replace function public.save_delivery_progress_settings(payload jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and lower(trim(role::text)) = 'admin'
  ) then
    raise exception 'admin access required';
  end if;
  insert into public.delivery_progress_settings (network, enabled, is_default, source, min_minutes, max_minutes, rotation_minutes, fake_enabled, fake_prefix, fake_count, status_color, message, auto_enabled, auto_min_minutes, auto_max_minutes, updated_at)
  select x.network, x.enabled, x.is_default, coalesce(nullif(trim(x.source), ''), current.source, 'manual'), coalesce(x.min_minutes, current.min_minutes, 30), coalesce(x.max_minutes, current.max_minutes, 240), coalesce(x.rotation_minutes, current.rotation_minutes, 30), coalesce(x.fake_enabled, current.fake_enabled, false), coalesce(x.fake_prefix, current.fake_prefix, '024'), coalesce(x.fake_count, current.fake_count, 10), coalesce(x.status_color, current.status_color, 'green'), coalesce(nullif(trim(x.message), ''), case x.network when 'mtn' then 'MTN orders are being processed. Please allow the estimated delivery window.' when 'telecel' then 'Telecel orders are being processed. Please allow the estimated delivery window.' when 'airteltigo' then 'AirtelTigo orders are being processed. Please allow the estimated delivery window.' else 'Your order is being processed. Please allow the estimated delivery window.' end), coalesce(x.auto_enabled, current.auto_enabled, false), coalesce(x.auto_min_minutes, current.auto_min_minutes, 30), coalesce(x.auto_max_minutes, current.auto_max_minutes, 240), coalesce(x.updated_at, now())
  from jsonb_to_recordset(payload) as x(network text, enabled boolean, is_default boolean, source text, min_minutes integer, max_minutes integer, rotation_minutes integer, fake_enabled boolean, fake_prefix text, fake_count integer, status_color text, message text, auto_enabled boolean, auto_min_minutes integer, auto_max_minutes integer, updated_at timestamptz)
  left join public.delivery_progress_settings as current on current.network = x.network
  on conflict (network) do update set enabled=excluded.enabled, is_default=excluded.is_default, source=excluded.source, min_minutes=excluded.min_minutes, max_minutes=excluded.max_minutes, rotation_minutes=excluded.rotation_minutes, fake_enabled=excluded.fake_enabled, fake_prefix=excluded.fake_prefix, fake_count=excluded.fake_count, status_color=excluded.status_color, message=excluded.message, auto_enabled=coalesce(excluded.auto_enabled, public.delivery_progress_settings.auto_enabled), auto_min_minutes=coalesce(excluded.auto_min_minutes, public.delivery_progress_settings.auto_min_minutes), auto_max_minutes=coalesce(excluded.auto_max_minutes, public.delivery_progress_settings.auto_max_minutes), updated_at=coalesce(excluded.updated_at, now());
end;
$$;
grant execute on function public.save_delivery_progress_settings(jsonb) to authenticated;

update public.orders set network='mtn_express' where lower(replace(replace(network,'-','_'),' ','_')) in ('mtnexpress','express_mtn');
update public.orders set network='airteltigo' where lower(replace(replace(network,'-','_'),' ','_')) in ('airtel_tigo','airtel','tigo');
update public.orders set network='telecel' where lower(network)='vodafone';
