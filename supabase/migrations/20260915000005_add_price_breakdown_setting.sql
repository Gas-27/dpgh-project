alter table public.app_settings
  add column if not exists show_price_breakdown boolean not null default false;
