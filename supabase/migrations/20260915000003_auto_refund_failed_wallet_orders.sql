create or replace function public.auto_refund_failed_wallet_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric := greatest(coalesce(new.amount, 0), 0);
  v_refunded boolean := false;
begin
  if lower(coalesce(new.order_status, '')) not in ('failed', 'failure')
     and lower(coalesce(new.fulfillment_status, '')) not in ('failed', 'failure')
     and lower(coalesce(new.status, '')) not in ('failed', 'failure') then
    return new;
  end if;

  if coalesce(old.refunded, false) or lower(coalesce(old.status, '')) = 'refunded'
     or lower(coalesce(old.order_status, '')) = 'refunded' then
    return new;
  end if;

  if lower(coalesce(new.payment_method, '')) <> 'wallet' or v_amount <= 0 then
    return new;
  end if;

  if new.source = 'api' and new.api_user is not null then
    update public.api_users
    set wallet = coalesce(wallet, 0) + v_amount
    where id::text = new.api_user or user_id::text = new.api_user;
    v_refunded := found;
  elsif new.sub_subagent_store_id is not null then
    update public.sub_subagent_stores
    set wallet_balance = coalesce(wallet_balance, 0) + v_amount
    where id = new.sub_subagent_store_id;
    v_refunded := found;
  elsif new.subagent_store_id is not null then
    update public.subagent_stores
    set wallet_balance = coalesce(wallet_balance, 0) + v_amount
    where id = new.subagent_store_id;
    v_refunded := found;
  elsif new.agent_store_id is not null then
    update public.agent_stores
    set wallet_balance = coalesce(wallet_balance, 0) + v_amount
    where id = new.agent_store_id;
    v_refunded := found;
  elsif new.customer_id is not null then
    update public.customers
    set wallet_balance = coalesce(wallet_balance, 0) + v_amount
    where id = new.customer_id or user_id = new.customer_id;
    v_refunded := found;
  elsif new.user_id is not null then
    update public.customers
    set wallet_balance = coalesce(wallet_balance, 0) + v_amount
    where user_id = new.user_id;
    v_refunded := found;
  end if;

  if v_refunded then
    new.refunded := true;
    new.refunded_amount := v_amount;
    new.refund_amount := v_amount;
    new.refunded_at := coalesce(new.refunded_at, now());
    new.refund_date := coalesce(new.refund_date, now());
    new.refund_destination := 'wallet';
    new.status := 'refunded';
    new.order_status := 'refunded';
    new.fulfillment_status := 'refunded';
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists auto_refund_failed_wallet_orders on public.orders;
create trigger auto_refund_failed_wallet_orders
before update of status, order_status, fulfillment_status on public.orders
for each row
when (
  lower(coalesce(new.status, '')) in ('failed', 'failure')
  or lower(coalesce(new.order_status, '')) in ('failed', 'failure')
  or lower(coalesce(new.fulfillment_status, '')) in ('failed', 'failure')
)
execute function public.auto_refund_failed_wallet_order();

revoke all on function public.auto_refund_failed_wallet_order() from public, anon, authenticated;
grant execute on function public.auto_refund_failed_wallet_order() to service_role;
