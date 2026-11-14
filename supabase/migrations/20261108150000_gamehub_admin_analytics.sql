-- Accurate Game Hub analytics for admins: real reward claims (GB from the actual MTN order),
-- every paid spend (wallet lives, wallet items, store chance packs) and plays, per game and period.

create or replace function public.gamehub_admin_analytics(
  p_game_id text default null,
  p_period text default 'today'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_today timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_result jsonb;
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  v_start := case p_period
    when 'today' then v_today
    when 'yesterday' then v_today - interval '1 day'
    when 'week' then date_trunc('week', now() at time zone 'UTC') at time zone 'UTC'
    when 'month' then date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'
    else '-infinity'::timestamptz
  end;
  v_end := case p_period when 'yesterday' then v_today else 'infinity'::timestamptz end;

  with claims as (
    select c.id, c.created_at, c.game_id, c.user_id, c.phone, c.order_id,
           o.status as order_status,
           coalesce(o.size_gb, gs.reward_gb, 0)::numeric as gb
    from public.gamehub_claims c
    left join public.orders o on o.id = c.order_id
    left join public.gamehub_game_settings gs on gs.game_id = c.game_id
    where c.created_at >= v_start and c.created_at < v_end
      and (p_game_id is null or c.game_id = p_game_id)
  ),
  spend_all as (
    select l.created_at, l.actor_id as user_id,
           case l.kind
             when 'gamehub_life' then coalesce((select r.game_id from public.gamehub_runs r where r.id::text = split_part(l.reference, ':', 1)), 'unknown')
             when 'gamehub_item' then split_part(l.reference, ':', 1)
             else 'archery'
           end as game_id,
           case l.kind when 'gamehub_life' then 'life' else 'item' end as spend_type,
           (-l.delta)::numeric as amount,
           l.note
    from public.wallet_ledger l
    where l.kind in ('gamehub_life', 'gamehub_item', 'gamehub_archery_item')
      and l.delta < 0
      and l.created_at >= v_start and l.created_at < v_end
    union all
    select co.created_at, co.user_id, co.game_id, 'chance', coalesce(o.amount, 0)::numeric,
           'Store chance pack (' || co.chances || ' chance' || case when co.chances > 1 then 's' else '' end || ', ' || co.gb || ' GB)'
    from public.gamehub_chance_orders co
    join public.orders o on o.id = co.order_id
    where co.applied
      and co.created_at >= v_start and co.created_at < v_end
  ),
  spend as (
    select * from spend_all where p_game_id is null or game_id = p_game_id
  ),
  runs_f as (
    select r.game_id, r.user_id, r.status, r.claimed
    from public.gamehub_runs r
    where r.status <> 'flagged'
      and r.updated_at >= v_start and r.updated_at < v_end
      and (p_game_id is null or r.game_id = p_game_id)
  ),
  ids as (
    select gs.game_id from public.gamehub_game_settings gs where p_game_id is null or gs.game_id = p_game_id
    union select game_id from claims
    union select game_id from spend
    union select game_id from runs_f
  ),
  games as (
    select i.game_id,
      coalesce((select gs.title from public.gamehub_game_settings gs where gs.game_id = i.game_id), i.game_id) as title,
      (select count(*) from runs_f r where r.game_id = i.game_id) as plays,
      (select count(distinct r.user_id) from runs_f r where r.game_id = i.game_id) as players,
      (select count(*) from runs_f r where r.game_id = i.game_id and r.status = 'cleared' and not r.claimed) as pending_claims,
      (select count(*) from claims c where c.game_id = i.game_id) as winners,
      (select coalesce(sum(c.gb), 0) from claims c where c.game_id = i.game_id) as gb,
      (select coalesce(sum(s.amount) filter (where s.spend_type = 'life'), 0) from spend s where s.game_id = i.game_id) as spend_lives,
      (select coalesce(sum(s.amount) filter (where s.spend_type = 'item'), 0) from spend s where s.game_id = i.game_id) as spend_items,
      (select coalesce(sum(s.amount) filter (where s.spend_type = 'chance'), 0) from spend s where s.game_id = i.game_id) as spend_chances,
      (select coalesce(sum(s.amount), 0) from spend s where s.game_id = i.game_id) as spend_total,
      (select count(*) from spend s where s.game_id = i.game_id) as purchases,
      (select count(distinct s.user_id) from spend s where s.game_id = i.game_id) as paying_players
    from ids i
  )
  select jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'winners', (select count(*) from claims),
      'gb_total', (select coalesce(sum(gb), 0) from claims),
      'gb_delivered', (select coalesce(sum(gb), 0) from claims where order_status in ('delivered', 'completed')),
      'gb_pending', (select coalesce(sum(gb), 0) from claims where coalesce(order_status, '') not in ('delivered', 'completed')),
      'plays', (select count(*) from runs_f),
      'players', (select count(distinct user_id) from runs_f),
      'pending_claims', (select count(*) from runs_f where status = 'cleared' and not claimed),
      'spend_total', (select coalesce(sum(amount), 0) from spend),
      'spend_lives', (select coalesce(sum(amount) filter (where spend_type = 'life'), 0) from spend),
      'spend_items', (select coalesce(sum(amount) filter (where spend_type = 'item'), 0) from spend),
      'spend_chances', (select coalesce(sum(amount) filter (where spend_type = 'chance'), 0) from spend),
      'purchases', (select count(*) from spend),
      'paying_players', (select count(distinct user_id) from spend),
      'wallet_rewards_paid', (select coalesce(sum(delta), 0) from public.wallet_ledger where kind = 'gamehub_reward' and delta > 0 and created_at >= v_start and created_at < v_end)
    ),
    'games', coalesce((select jsonb_agg(to_jsonb(g) order by g.winners desc, g.spend_total desc, g.plays desc) from games g), '[]'::jsonb),
    'winners', coalesce((
      select jsonb_agg(w order by w.created_at desc) from (
        select c.id, c.created_at, c.game_id, c.user_id, u.email::text as email, c.phone, c.gb, c.order_id, c.order_status,
          coalesce(
            (select a.store_name from public.agent_stores a where a.user_id = c.user_id limit 1),
            (select sa.store_name from public.subagent_stores sa where sa.user_id = c.user_id limit 1),
            (select ss.store_name from public.sub_subagent_stores ss where ss.user_id = c.user_id limit 1)
          ) as store_name,
          case
            when exists (select 1 from public.agent_stores a where a.user_id = c.user_id)
              then (select a.topup_reference from public.agent_stores a where a.user_id = c.user_id and a.topup_reference is not null limit 1)
            when exists (select 1 from public.subagent_stores sa where sa.user_id = c.user_id)
              then (select sa.topup_reference from public.subagent_stores sa where sa.user_id = c.user_id and sa.topup_reference is not null limit 1)
            when exists (select 1 from public.sub_subagent_stores ss where ss.user_id = c.user_id)
              then (select ss.topup_reference from public.sub_subagent_stores ss where ss.user_id = c.user_id and ss.topup_reference is not null limit 1)
            else (select cu.topup_reference from public.customers cu where cu.user_id = c.user_id and cu.topup_reference is not null limit 1)
          end as topup_reference
        from claims c
        left join auth.users u on u.id = c.user_id
        order by c.created_at desc
        limit 1000
      ) w
    ), '[]'::jsonb),
    'spend', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select s.created_at, s.game_id, s.user_id, u.email::text as email, s.spend_type, s.amount, s.note
        from spend s
        left join auth.users u on u.id = s.user_id
        order by s.created_at desc
        limit 1000
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.gamehub_admin_analytics(text, text) from public, anon;
grant execute on function public.gamehub_admin_analytics(text, text) to authenticated;
