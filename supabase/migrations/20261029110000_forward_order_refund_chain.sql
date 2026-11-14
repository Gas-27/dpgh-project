-- Admin refunds credit the agent wallet. For subagent and subsubagent orders the money is then
-- forwarded one level at a time (agent -> subagent -> subsubagent) by the wallet's owner.
-- The wallet that ends up holding the money belongs to the order's own storefront seller, who then
-- refunds the customer through Paystack. Every move is a unique ledger entry so a retry never repeats it.
create or replace function public.forward_order_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o record;
  v_final text;
  v_next_type text;
  v_next_id uuid;
  v_amount numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.refund_allocation_status is null then
    raise exception 'Admin must refund this order before it can be passed down or refunded to the customer';
  end if;
  if o.refund_allocation_status in ('debited', 'submitted', 'completed') then
    return jsonb_build_object('forwarded', false, 'holder_type', o.refund_allocation_owner_type, 'holder_id', o.refund_allocation_owner_id);
  end if;

  v_final := case
    when o.sub_subagent_store_id is not null then 'subsubagent'
    when o.subagent_store_id is not null then 'subagent'
    else 'agent'
  end;

  if o.refund_allocation_owner_type = v_final then
    return jsonb_build_object('forwarded', false, 'holder_type', o.refund_allocation_owner_type, 'holder_id', o.refund_allocation_owner_id);
  end if;

  if public.wallet_owner_user(o.refund_allocation_owner_type, o.refund_allocation_owner_id) is distinct from p_actor then
    raise exception 'The refund is currently held by another seller in the chain' using errcode = '42501';
  end if;

  if o.refund_allocation_owner_type = 'agent' then
    v_next_type := 'subagent';
    v_next_id := coalesce(
      o.subagent_store_id,
      (select ss.subagent_store_id from public.sub_subagent_stores ss where ss.id = o.sub_subagent_store_id)
    );
  elsif o.refund_allocation_owner_type = 'subagent' then
    v_next_type := 'subsubagent';
    v_next_id := o.sub_subagent_store_id;
  end if;
  if v_next_id is null then raise exception 'Could not find the next seller in the chain'; end if;

  v_amount := round(coalesce(o.refund_allocation_amount, 0), 2);
  if v_amount <= 0 then raise exception 'Order has no allocated refund amount'; end if;

  perform public.wallet_apply_internal(o.refund_allocation_owner_type, o.refund_allocation_owner_id, -v_amount, 'refund_forward_out', p_order_id::text || ':' || o.refund_allocation_owner_type, 'Refund passed down to ' || v_next_type, p_actor);
  perform public.wallet_apply_internal(v_next_type, v_next_id, v_amount, 'refund_forward_in', p_order_id::text || ':' || v_next_type, 'Refund received from ' || o.refund_allocation_owner_type, p_actor);

  update public.orders
    set refund_allocation_owner_type = v_next_type, refund_allocation_owner_id = v_next_id
    where id = p_order_id;

  return jsonb_build_object('forwarded', true, 'amount', v_amount, 'holder_type', v_next_type, 'holder_id', v_next_id, 'final_type', v_final);
end $$;

revoke all on function public.forward_order_refund(uuid, uuid) from public, anon, authenticated;
grant execute on function public.forward_order_refund(uuid, uuid) to service_role;

-- Only the wallet that currently holds the refund may debit it; parents no longer act on a downstream seller's behalf.
create or replace function public.seller_debit_order_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o record; v_ledger public.wallet_ledger; v_debit numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.refund_allocation_status is null then raise exception 'Admin must refund this order first'; end if;
  if o.refund_allocation_status in ('debited', 'submitted', 'completed') then
    return jsonb_build_object('status', o.refund_allocation_status, 'amount', o.refund_allocation_amount, 'already_debited', true);
  end if;
  if public.wallet_owner_user(o.refund_allocation_owner_type, o.refund_allocation_owner_id) is distinct from p_actor then
    raise exception 'Only the seller holding this refund can initiate it' using errcode = '42501';
  end if;
  v_debit := round(coalesce(o.amount, o.selling_price, o.base_price, 0), 2);
  if v_debit <= 0 then raise exception 'Order has no valid customer refund amount'; end if;
  v_ledger := public.wallet_apply_internal(o.refund_allocation_owner_type, o.refund_allocation_owner_id, -v_debit, 'refund_debit', p_order_id::text, 'Paystack customer refund including seller profit reversal', p_actor);
  update public.orders set refund_allocation_status = 'debited', refund_wallet_debit_at = now() where id = p_order_id;
  return jsonb_build_object('status', 'debited', 'amount', v_debit, 'base_price', o.refund_allocation_amount, 'ledger_id', v_ledger.id, 'already_debited', false);
end $$;
revoke all on function public.seller_debit_order_refund(uuid, uuid) from public, anon, authenticated;
grant execute on function public.seller_debit_order_refund(uuid, uuid) to service_role;
