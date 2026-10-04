alter table public.app_settings
  add column if not exists subscription_coming_soon boolean not null default false;
