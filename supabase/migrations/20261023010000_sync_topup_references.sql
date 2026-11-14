create or replace function public.sync_api_user_topup_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.identity_id is not null then
    if coalesce(new.is_agent, false) then
      select s.topup_reference into new.topup_reference
      from public.agent_stores s
      where s.user_id = new.identity_id
      order by s.created_at asc
      limit 1;
    else
      select c.topup_reference into new.topup_reference
      from public.customers c
      where c.user_id = new.identity_id
      order by c.created_at asc
      limit 1;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_api_user_topup_reference() from public;

drop trigger if exists trg_sync_api_user_topup_reference on public.api_users;
create trigger trg_sync_api_user_topup_reference
before insert or update of identity_id, is_agent on public.api_users
for each row execute function public.sync_api_user_topup_reference();

create or replace function public.propagate_store_topup_reference_to_api_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.api_users
  set topup_reference = new.topup_reference,
      updated_at = now()
  where identity_id = new.user_id and is_agent = true;
  return new;
end;
$$;

revoke all on function public.propagate_store_topup_reference_to_api_user() from public;

drop trigger if exists trg_propagate_store_topup_reference on public.agent_stores;
create trigger trg_propagate_store_topup_reference
after insert or update of topup_reference on public.agent_stores
for each row execute function public.propagate_store_topup_reference_to_api_user();

create or replace function public.propagate_customer_topup_reference_to_api_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.api_users
  set topup_reference = new.topup_reference,
      updated_at = now()
  where identity_id = new.user_id and coalesce(is_agent, false) = false;
  return new;
end;
$$;

revoke all on function public.propagate_customer_topup_reference_to_api_user() from public;

drop trigger if exists trg_propagate_customer_topup_reference on public.customers;
create trigger trg_propagate_customer_topup_reference
after insert or update of topup_reference on public.customers
for each row execute function public.propagate_customer_topup_reference_to_api_user();

update public.api_users u
set topup_reference = coalesce(s.topup_reference, c.topup_reference),
    updated_at = now()
from public.customers c
left join public.agent_stores s on s.user_id = u.identity_id
where c.user_id = u.identity_id
  and coalesce(u.is_agent, false) = false
  and u.topup_reference is distinct from c.topup_reference;

update public.api_users u
set topup_reference = s.topup_reference,
    updated_at = now()
from public.agent_stores s
where s.user_id = u.identity_id
  and u.is_agent = true
  and u.topup_reference is distinct from s.topup_reference;
