-- Game Hub leaderboard for the games hosted on JustBuy (the ones with server-tracked runs),
-- filterable by today, yesterday, this week, this month or all time.
-- A run's score is the levels it completed x 100, or the seconds survived for timed games.

create index if not exists gamehub_runs_game_updated_idx on public.gamehub_runs (game_id, updated_at desc);

create or replace function public.gamehub_leaderboard_period(
  p_game_id text default null,
  p_period text default 'today',
  p_limit integer default 50
)
returns table (rank bigint, player text, score bigint, games_played integer, is_you boolean)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      case p_period
        when 'today' then date_trunc('day', now() at time zone 'UTC')
        when 'yesterday' then date_trunc('day', now() at time zone 'UTC') - interval '1 day'
        when 'week' then date_trunc('week', now() at time zone 'UTC')
        when 'month' then date_trunc('month', now() at time zone 'UTC')
        else '-infinity'::timestamp
      end as starts_at,
      case p_period
        when 'yesterday' then date_trunc('day', now() at time zone 'UTC')
        else 'infinity'::timestamp
      end as ends_at
  ),
  run_scores as (
    select
      r.user_id,
      r.game_id,
      case
        when s.required_seconds is not null then floor(r.play_seconds)
        when r.status = 'cleared' then r.level * 100
        else greatest(r.level - 1, 0) * 100
      end::bigint as run_score
    from public.gamehub_runs r
    join public.gamehub_game_settings s on s.game_id = r.game_id
    cross join bounds b
    where r.status <> 'flagged'
      and (p_game_id is null or r.game_id = p_game_id)
      and (r.updated_at at time zone 'UTC') >= b.starts_at
      and (r.updated_at at time zone 'UTC') < b.ends_at
  ),
  best_per_game as (
    select user_id, game_id, max(run_score) as best, count(*)::integer as played
    from run_scores
    where run_score > 0
    group by user_id, game_id
  ),
  totals as (
    select user_id, sum(best)::bigint as total, sum(played)::integer as played
    from best_per_game
    group by user_id
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

grant execute on function public.gamehub_leaderboard_period(text, text, integer) to anon, authenticated;
