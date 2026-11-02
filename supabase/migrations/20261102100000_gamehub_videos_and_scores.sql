-- Game Hub: admin gameplay videos, cross-site scores and a masked-email leaderboard.

-- 1. Gameplay videos chosen by the admin for each Game Hub game.
create table if not exists public.gamehub_game_videos (
  game_id text primary key,
  video_url text not null,
  storage_path text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.gamehub_game_videos enable row level security;

drop policy if exists "Anyone can view gamehub videos" on public.gamehub_game_videos;
create policy "Anyone can view gamehub videos"
  on public.gamehub_game_videos for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage gamehub videos" on public.gamehub_game_videos;
create policy "Admins manage gamehub videos"
  on public.gamehub_game_videos for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 2. Storage bucket for the uploaded videos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gamehub-videos',
  'gamehub-videos',
  true,
  52428800,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read gamehub videos" on storage.objects;
create policy "Public read gamehub videos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'gamehub-videos');

drop policy if exists "Admins upload gamehub videos" on storage.objects;
create policy "Admins upload gamehub videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gamehub-videos' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update gamehub videos" on storage.objects;
create policy "Admins update gamehub videos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gamehub-videos' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins delete gamehub videos" on storage.objects;
create policy "Admins delete gamehub videos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gamehub-videos' and public.has_role(auth.uid(), 'admin'));

-- 3. One best score per account per game. The same auth account is used on the user,
--    agent, subagent and sub-subagent dashboards, so scores follow the person across the site.
create table if not exists public.gamehub_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  score bigint not null check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index if not exists gamehub_scores_game_score_idx on public.gamehub_scores (game_id, score desc);

alter table public.gamehub_scores enable row level security;

drop policy if exists "Users read own gamehub scores" on public.gamehub_scores;
create policy "Users read own gamehub scores"
  on public.gamehub_scores for select
  to authenticated
  using (user_id = auth.uid());

-- 4. Email masking so the leaderboard never exposes a full address.
create or replace function public.gamehub_mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then 'player***'
    else left(split_part(p_email, '@', 1), 2) || '***@' || left(split_part(p_email, '@', 2), 1) || '***'
  end;
$$;

-- 5. Submit a score; only the best score per game is kept.
create or replace function public.gamehub_submit_score(p_game_id text, p_score bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save your score';
  end if;
  if p_game_id is null or length(p_game_id) = 0 or length(p_game_id) > 80 then
    raise exception 'Invalid game';
  end if;
  if p_score is null or p_score < 0 or p_score > 100000000 then
    raise exception 'Invalid score';
  end if;

  insert into public.gamehub_scores as s (user_id, game_id, score, updated_at)
  values (auth.uid(), p_game_id, p_score, now())
  on conflict (user_id, game_id) do update
    set score = greatest(s.score, excluded.score),
        updated_at = case when excluded.score > s.score then now() else s.updated_at end
  returning s.score into v_best;

  return v_best;
end;
$$;

-- 6. Leaderboard. A null game returns the site-wide ranking (sum of each player's best scores).
create or replace function public.gamehub_leaderboard(p_game_id text default null, p_limit integer default 50)
returns table (rank bigint, player text, score bigint, games_played integer, is_you boolean)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select s.user_id, sum(s.score)::bigint as total, count(*)::integer as played
    from public.gamehub_scores s
    where p_game_id is null or s.game_id = p_game_id
    group by s.user_id
  )
  select
    row_number() over (order by t.total desc, t.user_id) as rank,
    public.gamehub_mask_email(u.email) as player,
    t.total as score,
    t.played as games_played,
    (t.user_id = auth.uid()) as is_you
  from totals t
  join auth.users u on u.id = t.user_id
  order by t.total desc, t.user_id
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

grant execute on function public.gamehub_leaderboard(text, integer) to anon, authenticated;
grant execute on function public.gamehub_submit_score(text, bigint) to authenticated;
grant execute on function public.gamehub_mask_email(text) to anon, authenticated;
