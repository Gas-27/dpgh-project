create table if not exists public.social_boost_profit_credits (
  id uuid primary key default gen_random_uuid(),
  payment_reference text unique not null,
  store_kind text not null check (store_kind in ('agent', 'subagent', 'subsubagent')),
  store_id uuid not null,
  profit_amount numeric(14,2) not null check (profit_amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.social_boost_profit_credits enable row level security;

create or replace function public.credit_social_boost_profit(
  p_reference text,
  p_store_kind text,
  p_store_id uuid,
  p_profit_amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_reference), '') is null then
    raise exception 'Payment reference is required';
  end if;

  if p_profit_amount is null or p_profit_amount < 0 then
    raise exception 'Profit amount must be non-negative';
  end if;

  if p_store_kind is null or p_store_id is null then
    return false;
  end if;

  insert into public.social_boost_profit_credits (
    payment_reference,
    store_kind,
    store_id,
    profit_amount
  ) values (
    p_reference,
    p_store_kind,
    p_store_id,
    round(p_profit_amount, 2)
  ) on conflict (payment_reference) do nothing;

  if not found then
    return true;
  end if;

  if p_store_kind = 'agent' then
    update public.agent_stores
    set wallet_balance = coalesce(wallet_balance, 0) + round(p_profit_amount, 2)
    where id = p_store_id;
  elsif p_store_kind = 'subagent' then
    update public.subagent_stores
    set wallet_balance = coalesce(wallet_balance, 0) + round(p_profit_amount, 2)
    where id = p_store_id;
  elsif p_store_kind = 'subsubagent' then
    update public.sub_subagent_stores
    set wallet_balance = coalesce(wallet_balance, 0) + round(p_profit_amount, 2)
    where id = p_store_id;
  else
    raise exception 'Invalid Social Boost store kind';
  end if;

  if not found then
    raise exception 'Social Boost store was not found';
  end if;

  return true;
end;
$$;

grant execute on function public.credit_social_boost_profit(text, text, uuid, numeric) to service_role;
revoke execute on function public.credit_social_boost_profit(text, text, uuid, numeric) from anon, authenticated;

select pg_notify('pgrst', 'reload schema');
