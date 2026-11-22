-- Admin refunds of storefront Paystack orders go straight back to the customer through Paystack.
-- The storefront owner's recorded profit on the order is deducted from their wallet.
-- Orders that are not storefront Paystack orders keep using admin_allocate_order_refund.

create or replace function public.admin_direct_storefront_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o record;
  v_type text;
  v_owner uuid;
  v_amount numeric;
  v_profit numeric := 0;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor and role::text = 'admin') then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if o.refund_allocation_status is not null
     or coalesce(o.refunded, false)
     or lower(coalesce(o.status, '')) = 'refunded'
     or lower(coalesce(o.fulfillment_status, '')) = 'refunded' then
    return jsonb_build_object('direct', true, 'already_refunded', true, 'amount', coalesce(o.refunded_amount, o.refund_allocation_amount));
  end if;

  if o.sub_subagent_store_id is not null then v_type := 'subsubagent'; v_owner := o.sub_subagent_store_id;
  elsif o.subagent_store_id is not null then v_type := 'subagent'; v_owner := o.subagent_store_id;
  elsif o.agent_store_id is not null then v_type := 'agent'; v_owner := o.agent_store_id;
  else return jsonb_build_object('direct', false); end if;

  if coalesce(trim(o.paystack_reference), '') = '' then
    return jsonb_build_object('direct', false);
  end if;

  v_amount := round(coalesce(nullif(o.amount, 0), nullif(o.selling_price, 0), 0), 2);
  if v_amount <= 0 then raise exception 'This order has no valid customer refund amount'; end if;

  v_profit := round(greatest(coalesce(o.profit, o.selling_price - o.base_price, 0), 0), 2);
  if v_profit > v_amount then v_profit := v_amount; end if;

  if v_profit > 0 then
    perform public.wallet_apply_internal(
      v_type, v_owner, -v_profit, 'refund_profit_reversal', p_order_id::text,
      'Profit reversed because admin refunded the customer through Paystack',
      p_actor, true
    );
  end if;

  update public.orders
    set refund_allocation_status = 'submitted', refund_allocation_amount = v_amount,
        refund_allocation_owner_type = v_type, refund_allocation_owner_id = v_owner,
        refund_allocation_at = now(), refund_wallet_debit_at = now(),
        status = 'refunded', order_status = 'refunded', fulfillment_status = 'refunded', refunded = true,
        refund_amount = v_amount, refunded_amount = v_amount, refunded_at = now()
    where id = p_order_id;

  return jsonb_build_object(
    'direct', true, 'already_refunded', false,
    'amount', v_amount, 'profit', v_profit,
    'owner_type', v_type, 'owner_id', v_owner,
    'paystack_reference', o.paystack_reference,
    'prev_status', o.status, 'prev_order_status', o.order_status, 'prev_fulfillment_status', o.fulfillment_status
  );
end $$;

revoke all on function public.admin_direct_storefront_refund(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_direct_storefront_refund(uuid, uuid) to service_role;

create or replace function public.admin_direct_storefront_refund_revert(
  p_order_id uuid, p_actor uuid, p_prev_status text, p_prev_order_status text, p_prev_fulfillment_status text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o record;
  v_profit numeric;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor and role::text = 'admin') then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.refund_allocation_status is distinct from 'submitted' then
    return jsonb_build_object('reverted', false);
  end if;

  select coalesce(-sum(delta), 0) into v_profit
    from public.wallet_ledger
    where owner_type = o.refund_allocation_owner_type and owner_id = o.refund_allocation_owner_id
      and kind = 'refund_profit_reversal' and reference = p_order_id::text;

  if v_profit > 0 then
    perform public.wallet_apply_internal(
      o.refund_allocation_owner_type, o.refund_allocation_owner_id, v_profit, 'refund_profit_restore', p_order_id::text,
      'Paystack refund failed; profit restored', p_actor, true
    );
  end if;

  update public.orders
    set refund_allocation_status = null, refund_allocation_amount = null,
        refund_allocation_owner_type = null, refund_allocation_owner_id = null,
        refund_allocation_at = null, refund_wallet_debit_at = null,
        status = coalesce(p_prev_status, 'paid'), order_status = p_prev_order_status,
        fulfillment_status = coalesce(p_prev_fulfillment_status, 'pending'), refunded = false,
        refund_amount = null, refunded_amount = null, refunded_at = null
    where id = p_order_id;

  return jsonb_build_object('reverted', true, 'restored_profit', v_profit);
end $$;

revoke all on function public.admin_direct_storefront_refund_revert(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_direct_storefront_refund_revert(uuid, uuid, text, text, text) to service_role;
