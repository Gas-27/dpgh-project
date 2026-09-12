-- Direct hierarchy email visibility and safe historical order repair.
create table if not exists public.order_identity_review (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_email text,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.order_identity_review enable row level security;
create unique index if not exists order_identity_review_open_order_idx
  on public.order_identity_review(order_id) where resolved_at is null;

create or replace function public.admin_repair_order_identities()
returns integer
language plpgsql security definer set search_path = public as $$
declare repaired integer;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  with candidates as (
    select o.id, p.email, c.user_id,
           count(*) over (partition by lower(p.email)) as matches
    from public.orders o
    join public.payments p on p.reference = o.paystack_reference
    join public.customers c on lower(c.email) = lower(p.email)
    where o.customer_id is null
      and c.user_id is not null
  ), repaired_rows as (
    update public.orders o
    set customer_id = c.user_id, user_id = c.user_id
    from candidates c
    where c.id = o.id and c.matches = 1
    returning o.id
  )
  select count(*) into repaired from repaired_rows;

  insert into public.order_identity_review(order_id, payment_email, reason)
  select o.id, p.email,
    case when count(c.user_id) = 0 then 'No matching customer account'
         else 'Payment email matched multiple customer accounts' end
  from public.orders o
  join public.payments p on p.reference = o.paystack_reference
  left join public.customers c on lower(c.email) = lower(p.email) and c.user_id is not null
  where o.customer_id is null
  group by o.id, p.email
  having count(c.user_id) <> 1
  on conflict do nothing;

  return repaired;
end;
$$;

create or replace function public.get_direct_descendant_emails(p_user_id uuid)
returns table (user_id uuid, email text, role text)
language sql security definer set search_path = public as $$
  select s.user_id, p.email, 'subagent'
  from public.subagent_stores s
  join public.profiles p on p.id = s.user_id
  join public.agent_stores a on a.id = s.agent_store_id
  where a.user_id = p_user_id
  union all
  select ss.user_id, p.email, 'sub_subagent'
  from public.sub_subagent_stores ss
  join public.profiles p on p.id = ss.user_id
  join public.subagent_stores s on s.id = ss.subagent_store_id
  join public.agent_stores a on a.id = s.agent_store_id
  where a.user_id = p_user_id;
$$;

revoke all on function public.admin_repair_order_identities() from public;
grant execute on function public.admin_repair_order_identities() to authenticated;
revoke all on function public.get_direct_descendant_emails(uuid) from public;
grant execute on function public.get_direct_descendant_emails(uuid) to authenticated;

-- Keep both ownership columns synchronized for new authenticated orders.
create or replace function public.sync_order_identity()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.customer_id is null and new.user_id is not null then new.customer_id := new.user_id;
  elsif new.user_id is null and new.customer_id is not null then new.user_id := new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_sync_identity on public.orders;
create trigger orders_sync_identity before insert or update of user_id, customer_id on public.orders
for each row execute function public.sync_order_identity();

update public.orders set customer_id = user_id where customer_id is null and user_id is not null;

revoke all on function public.admin_add_blocked_sms_sender(text,text) from public;
grant execute on function public.admin_add_blocked_sms_sender(text,text) to authenticated;
