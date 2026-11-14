-- Browsers (anon / authenticated roles) can never write a balance column.
-- Only server-side code can: the security-definer wallet functions (run as the function owner)
-- and edge functions using the service role.

create or replace function public.guard_wallet_balance_columns()
returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
begin
  if current_user not in ('anon', 'authenticated', 'authenticator') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce((v_new->>'wallet_balance')::numeric, 0) <> 0
       or coalesce((v_new->>'subagent_commission_balance')::numeric, 0) <> 0 then
      raise exception 'Wallet balances cannot be set from the client' using errcode = '42501';
    end if;
    return new;
  end if;

  v_old := to_jsonb(old);
  if (v_new->'wallet_balance') is distinct from (v_old->'wallet_balance')
     or (v_new->'subagent_commission_balance') is distinct from (v_old->'subagent_commission_balance') then
    raise exception 'Wallet balances cannot be changed from the client' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_wallet_balance_columns() from public, anon, authenticated;

drop trigger if exists trg_guard_wallet_customers on public.customers;
create trigger trg_guard_wallet_customers before insert or update on public.customers
  for each row execute function public.guard_wallet_balance_columns();

drop trigger if exists trg_guard_wallet_agent_stores on public.agent_stores;
create trigger trg_guard_wallet_agent_stores before insert or update on public.agent_stores
  for each row execute function public.guard_wallet_balance_columns();

drop trigger if exists trg_guard_wallet_subagent_stores on public.subagent_stores;
create trigger trg_guard_wallet_subagent_stores before insert or update on public.subagent_stores
  for each row execute function public.guard_wallet_balance_columns();

drop trigger if exists trg_guard_wallet_sub_subagent_stores on public.sub_subagent_stores;
create trigger trg_guard_wallet_sub_subagent_stores before insert or update on public.sub_subagent_stores
  for each row execute function public.guard_wallet_balance_columns();
