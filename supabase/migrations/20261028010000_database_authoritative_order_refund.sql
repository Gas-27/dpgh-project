-- Make database refunds the only authority for normal data orders.
-- The RPC is idempotent: the order reference is unique per wallet refund.
create or replace function public.admin_refund_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_amount numeric;
  v_row public.wallet_ledger;
  v_customer public.customers;
  v_agent public.agent_stores;
  v_subagent public.subagent_stores;
  v_subsub public.sub_subagent_stores;
  v_target_type text;
  v_target_id uuid;
  v_existing public.wallet_ledger;
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if lower(coalesce(v_order.payment_method, '')) <> 'wallet' then
    raise exception 'Only wallet-paid data orders use this refund path' using errcode = '22023';
  end if;
  if coalesce(v_order.status, '') = 'refunded' or coalesce(v_order.fulfillment_status, '') = 'refunded'
     or coalesce(v_order.refunded_amount, 0) > 0 then
    select * into v_existing from public.wallet_ledger
      where kind = 'order_refund' and reference = p_order_id::text limit 1;
    return jsonb_build_object('status', 'already_refunded', 'amount', coalesce(v_existing.delta, v_order.refunded_amount, 0));
  end if;

  v_amount := round(coalesce(v_order.amount, 0), 2);
  if v_amount <= 0 then raise exception 'Order has no refundable amount' using errcode = '22023'; end if;

  -- Refund the wallet owner once. Storefront orders refund the deepest wallet;
  -- the existing hierarchy then remains responsible for any later transfers.
  if v_order.sub_subagent_store_id is not null then
    select id into v_target_id from public.sub_subagent_stores where id = v_order.sub_subagent_store_id;
    v_target_type := 'subsubagent';
  elsif v_order.subagent_store_id is not null then
    v_target_id := v_order.subagent_store_id;
    v_target_type := 'subagent';
  elsif v_order.agent_store_id is not null then
    v_target_id := v_order.agent_store_id;
    v_target_type := 'agent';
  elsif v_order.customer_id is not null then
    select id into v_target_id from public.customers where user_id = v_order.customer_id;
    v_target_type := 'customer';
  end if;

  if v_target_id is null then raise exception 'Wallet owner not found' using errcode = 'P0002'; end if;

  v_row := public.wallet_apply_internal(v_target_type, v_target_id, v_amount, 'order_refund', p_order_id::text, 'Database order refund', auth.uid());

  update public.orders
     set status = 'refunded', fulfillment_status = 'refunded', order_status = 'refunded',
         refunded_amount = v_amount, refunded_at = now()
   where id = p_order_id;

  return jsonb_build_object('status', 'refunded', 'amount', v_amount, 'ledger_id', v_row.id, 'balance_after', v_row.balance_after);
end;
$$;

revoke all on function public.admin_refund_order(uuid) from public, anon;
grant execute on function public.admin_refund_order(uuid) to authenticated;

-- Prevent the failed-order trigger from issuing a second credit after an admin refund.
create or replace function public.auto_refund_failed_wallet_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.order_status, '')) = 'failed'
     and lower(coalesce(old.order_status, '')) is distinct from 'failed'
     and not exists (select 1 from public.wallet_ledger where reference = new.id::text and kind = 'order_refund') then
    -- The normal admin path is handled by admin_refund_order. This trigger is
    -- intentionally a no-op for existing orders to prevent duplicate credits.
    return new;
  end if;
  return new;
end;
$$;
