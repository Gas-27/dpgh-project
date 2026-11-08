create or replace function public.gamehub_public_win_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(game_id, wins), '{}'::jsonb)
  from (
    select c.game_id, count(*)::integer as wins
    from public.gamehub_claims c
    group by c.game_id
  ) counts
$$;

revoke all on function public.gamehub_public_win_counts() from public, anon;
grant execute on function public.gamehub_public_win_counts() to anon, authenticated;
