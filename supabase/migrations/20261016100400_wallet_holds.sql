-- A held wallet cannot be spent, transferred or paid out by anyone: browsers, security-definer
-- wallet functions or edge functions using the service role. Only a signed-in admin can move it
-- (e.g. to zero it out) or release the hold.

create table if not exists public.wallet_holds (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('customer', 'agent', 'subagent', 'subsubagent', 'api_user')),
  owner_id uuid not null,
  user_id uuid,
  reason text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid
);

create unique index if not exists wallet_holds_active_owner
  on public.wallet_holds (owner_type, owner_id) where released_at is null;

alter table public.wallet_holds enable row level security;
revoke all on public.wallet_holds from anon, authenticated;
grant select, insert, update on public.wallet_holds to authenticated;

drop policy if exists wallet_holds_admin_all on public.wallet_holds;
create policy wallet_holds_admin_all on public.wallet_holds
  for all to authenticated
  using (public.is_wallet_admin())
  with check (public.is_wallet_admin());

create or replace function public.enforce_wallet_hold()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner_type text;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_col text;
  v_decreased boolean := false;
begin
  v_owner_type := case tg_table_name
    when 'customers' then 'customer'
    when 'agent_stores' then 'agent'
    when 'subagent_stores' then 'subagent'
    when 'sub_subagent_stores' then 'subsubagent'
    when 'api_users' then 'api_user'
  end;

  foreach v_col in array array['wallet_balance', 'subagent_commission_balance', 'wallet', 'api_wallet'] loop
    if v_new ? v_col
       and coalesce((v_new->>v_col)::numeric, 0) < coalesce((v_old->>v_col)::numeric, 0) then
      v_decreased := true;
    end if;
  end loop;

  if not v_decreased then
    return new;
  end if;

  if exists (
    select 1 from public.wallet_holds h
    where h.owner_type = v_owner_type and h.owner_id = old.id and h.released_at is null
  ) and not public.is_wallet_admin() then
    raise exception 'This wallet is on hold. Contact support.' using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_wallet_hold() from public, anon, authenticated;

drop trigger if exists trg_wallet_hold_customers on public.customers;
create trigger trg_wallet_hold_customers before update on public.customers
  for each row execute function public.enforce_wallet_hold();

drop trigger if exists trg_wallet_hold_agent_stores on public.agent_stores;
create trigger trg_wallet_hold_agent_stores before update on public.agent_stores
  for each row execute function public.enforce_wallet_hold();

drop trigger if exists trg_wallet_hold_subagent_stores on public.subagent_stores;
create trigger trg_wallet_hold_subagent_stores before update on public.subagent_stores
  for each row execute function public.enforce_wallet_hold();

drop trigger if exists trg_wallet_hold_sub_subagent_stores on public.sub_subagent_stores;
create trigger trg_wallet_hold_sub_subagent_stores before update on public.sub_subagent_stores
  for each row execute function public.enforce_wallet_hold();

drop trigger if exists trg_wallet_hold_api_users on public.api_users;
create trigger trg_wallet_hold_api_users before update on public.api_users
  for each row execute function public.enforce_wallet_hold();
