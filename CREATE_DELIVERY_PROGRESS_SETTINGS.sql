-- Run once in Supabase SQL Editor.
create table if not exists public.delivery_progress_settings (
  network text primary key,
  enabled boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'orders')),
  min_minutes integer not null default 30 check (min_minutes >= 0),
  max_minutes integer not null default 240 check (max_minutes >= min_minutes),
  message text not null default 'Orders are being processed. Delivery times can vary by network and order volume.',
  updated_at timestamptz not null default now()
);

insert into public.delivery_progress_settings (network, min_minutes, max_minutes, message)
values
  ('mtn', 60, 240, 'There may be a validation issue on the MTN portal. Orders are still being processed and will be delivered.'),
  ('mtn_express', 15, 90, 'MTN Express orders are usually delivered quickly, but delivery can vary by order volume.'),
  ('telecel', 30, 180, 'Telecel orders are being processed. Please allow the estimated delivery window.'),
  ('airteltigo', 30, 180, 'AirtelTigo orders are being processed. Please allow the estimated delivery window.')
on conflict (network) do nothing;

alter table public.delivery_progress_settings enable row level security;
drop policy if exists "Public can view delivery progress" on public.delivery_progress_settings;
create policy "Public can view delivery progress"
  on public.delivery_progress_settings for select using (true);

-- Optional admin write policy. This uses the existing admin_users table shown in your schema.
-- Run this only if admin_users.user_id identifies your administrators.
drop policy if exists "Admins can manage delivery progress" on public.delivery_progress_settings;
create policy "Admins can manage delivery progress"
  on public.delivery_progress_settings for all
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Normalize legacy order network values for accurate reporting.
update public.orders set network = 'mtn_express' where lower(replace(replace(network, '-', '_'), ' ', '_')) in ('mtnexpress', 'express_mtn');
update public.orders set network = 'airteltigo' where lower(replace(replace(network, '-', '_'), ' ', '_')) in ('airtel_tigo', 'airtel', 'tigo');
update public.orders set network = 'telecel' where lower(network) = 'vodafone';
