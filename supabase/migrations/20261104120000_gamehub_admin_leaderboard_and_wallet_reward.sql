-- Admin view of the Game Hub leaderboard (full email, top-up reference, store name, wallets)
-- and a way for admins to reward a player's wallet straight from it.

create or replace function public.gamehub_admin_leaderboard(
  p_game_id text default null,
  p_period text default 'today',
  p_limit integer default 100
)
returns table (
  rank bigint,
  user_id uuid,
  email text,
  score bigint,
  games_played integer,
  topup_reference text,
  store_name text,
  wallets jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  return query
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
    select rs.user_id, rs.game_id, max(rs.run_score) as best, count(*)::integer as played
    from run_scores rs
    where rs.run_score > 0
    group by rs.user_id, rs.game_id
  ),
  totals as (
    select bp.user_id, sum(bp.best)::bigint as total, sum(bp.played)::integer as played
    from best_per_game bp
    group by bp.user_id
  ),
  ranked as (
    select t.user_id, t.total, t.played,
      row_number() over (order by t.total desc, t.user_id) as rnk
    from totals t
    order by t.total desc, t.user_id
    limit greatest(1, least(coalesce(p_limit, 100), 200))
  )
  select
    rk.rnk,
    rk.user_id,
    u.email::text,
    rk.total,
    rk.played,
    coalesce(
      (select c.topup_reference from public.customers c where c.user_id = rk.user_id and c.topup_reference is not null limit 1),
      (select a.topup_reference from public.agent_stores a where a.user_id = rk.user_id and a.topup_reference is not null limit 1),
      (select sa.topup_reference from public.subagent_stores sa where sa.user_id = rk.user_id and sa.topup_reference is not null limit 1),
      (select ss.topup_reference from public.sub_subagent_stores ss where ss.user_id = rk.user_id and ss.topup_reference is not null limit 1)
    ),
    coalesce(
      (select a.store_name from public.agent_stores a where a.user_id = rk.user_id limit 1),
      (select sa.store_name from public.subagent_stores sa where sa.user_id = rk.user_id limit 1),
      (select ss.store_name from public.sub_subagent_stores ss where ss.user_id = rk.user_id limit 1)
    ),
    (
      select coalesce(jsonb_agg(w), '[]'::jsonb) from (
        select jsonb_build_object('type', 'customer', 'label', 'Customer wallet', 'balance', coalesce(c.wallet_balance, 0)) as w
        from public.customers c where c.user_id = rk.user_id
        union all
        select jsonb_build_object('type', 'agent', 'label', 'Agent store wallet' || coalesce(' (' || a.store_name || ')', ''), 'balance', coalesce(a.wallet_balance, 0))
        from public.agent_stores a where a.user_id = rk.user_id
        union all
        select jsonb_build_object('type', 'subagent', 'label', 'Sub-agent wallet' || coalesce(' (' || sa.store_name || ')', ''), 'balance', coalesce(sa.wallet_balance, 0))
        from public.subagent_stores sa where sa.user_id = rk.user_id
        union all
        select jsonb_build_object('type', 'subsubagent', 'label', 'Sub-sub-agent wallet' || coalesce(' (' || ss.store_name || ')', ''), 'balance', coalesce(ss.wallet_balance, 0))
        from public.sub_subagent_stores ss where ss.user_id = rk.user_id
      ) x
    )
  from ranked rk
  join auth.users u on u.id = rk.user_id
  order by rk.rnk;
end;
$$;

revoke all on function public.gamehub_admin_leaderboard(text, text, integer) from public, anon;
grant execute on function public.gamehub_admin_leaderboard(text, text, integer) to authenticated;

create or replace function public.gamehub_admin_reward_wallet(
  p_user_id uuid,
  p_wallet_type text,
  p_amount numeric,
  p_note text default null,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_amount numeric := round(p_amount, 2);
  v_row public.wallet_ledger;
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if v_amount is null or v_amount < 0.5 or v_amount > 5000 then
    raise exception 'Reward must be between GHS 0.50 and GHS 5,000' using errcode = '22023';
  end if;

  if p_wallet_type = 'customer' then
    select id into v_owner_id from public.customers where user_id = p_user_id limit 1;
  elsif p_wallet_type = 'agent' then
    select id into v_owner_id from public.agent_stores where user_id = p_user_id limit 1;
  elsif p_wallet_type = 'subagent' then
    select id into v_owner_id from public.subagent_stores where user_id = p_user_id limit 1;
  elsif p_wallet_type = 'subsubagent' then
    select id into v_owner_id from public.sub_subagent_stores where user_id = p_user_id limit 1;
  else
    raise exception 'Invalid wallet type' using errcode = '22023';
  end if;
  if v_owner_id is null then
    raise exception 'This player has no wallet of that type' using errcode = 'P0002';
  end if;

  v_row := public.wallet_apply_internal(
    p_wallet_type, v_owner_id, v_amount, 'gamehub_reward',
    coalesce(nullif(trim(p_reference), ''), gen_random_uuid()::text),
    coalesce(nullif(trim(p_note), ''), 'JustBuy Games leaderboard reward'),
    auth.uid()
  );
  return jsonb_build_object('ledger_id', v_row.id, 'balance_before', v_row.balance_before, 'balance_after', v_row.balance_after);
end;
$$;

revoke all on function public.gamehub_admin_reward_wallet(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.gamehub_admin_reward_wallet(uuid, text, numeric, text, text) to authenticated;
