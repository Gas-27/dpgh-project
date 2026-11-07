-- API wallets: owners could edit their own api_users row, including the wallet.
-- Only admins (dashboard) and server-side code may change a balance.
create or replace function public.guard_api_wallet_columns()
returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
begin
  if current_user not in ('anon', 'authenticated', 'authenticator') then
    return new;
  end if;
  if public.is_wallet_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce((v_new->>'wallet')::numeric, 0) <> 0 or coalesce((v_new->>'api_wallet')::numeric, 0) <> 0 then
      raise exception 'Wallet balances cannot be set from the client' using errcode = '42501';
    end if;
    return new;
  end if;

  v_old := to_jsonb(old);
  if (v_new->'wallet') is distinct from (v_old->'wallet')
     or (v_new->'api_wallet') is distinct from (v_old->'api_wallet') then
    raise exception 'Wallet balances cannot be changed from the client' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_api_wallet_columns() from public, anon, authenticated;

drop trigger if exists trg_guard_wallet_api_users on public.api_users;
create trigger trg_guard_wallet_api_users before insert or update on public.api_users
  for each row execute function public.guard_api_wallet_columns();

-- Any signed-in user could update any subagent store row. Owners, parent agents and admins
-- already have their own policies.
drop policy if exists subagent_stores_update on public.subagent_stores;
