-- Persistent cache of Korba bundle catalogues so the gateway does not call
-- Korba (through the Fixie proxy) for every customer who opens the buy page.
-- Service role only: the gateway reads and writes it, browsers never do.
create table if not exists public.korba_catalogue_cache (
  network text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.korba_catalogue_cache enable row level security;
revoke all on public.korba_catalogue_cache from anon, authenticated;
