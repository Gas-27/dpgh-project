-- Public feed of admin wallet rewards shown on the Game Hub leaderboard (player emails masked).

create table if not exists public.gamehub_admin_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  wallet_type text not null,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists gamehub_admin_rewards_created_idx on public.gamehub_admin_rewards (created_at desc);

alter table public.gamehub_admin_rewards enable row level security;
revoke all on public.gamehub_admin_rewards from public, anon, authenticated;

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
  v_note text := left(coalesce(nullif(trim(p_note), ''), 'JustBuy Games leaderboard reward'), 200);
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
    v_note,
    auth.uid()
  );

  insert into public.gamehub_admin_rewards (user_id, admin_id, wallet_type, amount, note)
  values (p_user_id, auth.uid(), p_wallet_type, v_amount, v_note);

  return jsonb_build_object('ledger_id', v_row.id, 'balance_before', v_row.balance_before, 'balance_after', v_row.balance_after);
end;
$$;

revoke all on function public.gamehub_admin_reward_wallet(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.gamehub_admin_reward_wallet(uuid, text, numeric, text, text) to authenticated;

create or replace function public.gamehub_public_rewards(p_limit integer default 20)
returns table (id uuid, player text, amount numeric, note text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    left(split_part(u.email, '@', 1), 2) || '***@' || left(split_part(u.email, '@', 2), 1) || '***',
    r.amount,
    r.note,
    r.created_at
  from public.gamehub_admin_rewards r
  join auth.users u on u.id = r.user_id
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.gamehub_public_rewards(integer) from public;
grant execute on function public.gamehub_public_rewards(integer) to anon, authenticated;
