-- Paid players get 5 minutes (was 3) to enter their game once a tournament goes live.
-- Patches the live function bodies in place so it works whichever tournament migration shape is deployed.
do $do$
declare f record; d text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('gamehub_tm_my_game', 'gamehub_tm_settle_match', 'gamehub_tm_start')
  loop
    d := pg_get_functiondef(f.oid);
    if position('3 minutes' in d) > 0 then
      execute replace(d, '3 minutes', '5 minutes');
    end if;
  end loop;
end $do$;

-- Tracks the "your tournament has started" SMS so each paid player is only texted once.
create table if not exists public.gamehub_tournament_sms (
  tournament_id uuid not null references public.gamehub_tournaments(id) on delete cascade,
  user_id uuid not null,
  phone text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
alter table public.gamehub_tournament_sms enable row level security;
revoke all on public.gamehub_tournament_sms from anon, authenticated;

notify pgrst, 'reload schema';
