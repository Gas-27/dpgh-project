-- Persistent cache for Korba bundle catalogue responses.
-- Survives Edge Function cold starts (unlike an in-memory cache), which is
-- what was causing repeated live Korba calls through the Fixie proxy.
create table if not exists public.korba_catalogue_cache (
  network text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.korba_catalogue_cache enable row level security;
revoke all on public.korba_catalogue_cache from anon, authenticated;
