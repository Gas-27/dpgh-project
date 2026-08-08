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

-- Admin writes should be performed by your existing authenticated admin policy.
-- If your project has no admin write policy yet, add one using your existing
-- admin_users/user_roles convention rather than exposing updates publicly.
