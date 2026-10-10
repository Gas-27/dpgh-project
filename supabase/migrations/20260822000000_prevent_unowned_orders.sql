-- Keep the two order identity columns synchronized for authenticated purchases.
-- Both columns reference auth.users(id) in this project.
create or replace function public.sync_order_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.customer_id is null and new.user_id is not null then
    new.customer_id := new.user_id;
  elsif new.user_id is null and new.customer_id is not null then
    new.user_id := new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_sync_identity on public.orders;
create trigger orders_sync_identity
before insert or update of user_id, customer_id on public.orders
for each row execute function public.sync_order_identity();

-- Repair only records where the existing authenticated user ID is unambiguous.
update public.orders
set customer_id = user_id
where customer_id is null
  and user_id is not null;
