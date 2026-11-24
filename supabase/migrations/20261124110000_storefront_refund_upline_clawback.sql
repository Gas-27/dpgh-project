-- Admin refund of an agent/subagent/sub-subagent storefront order that was paid directly through Paystack.
--
-- In one locked transaction this now:
--   1. credits the store owner's recorded base price and takes the full customer amount from the same wallet
--      (net effect: the owner's own profit is reversed),
--   2. claws back the commission every upline seller earned from the same order
--      (sub-subagent order -> subagent wallet + agent commission balance, subagent order -> agent commission balance),
--   3. records one paystack_refunds row (with every NOT NULL column filled) so the same order can never be refunded twice.
-- A failed Paystack call is undone by admin_direct_storefront_refund_revert, which restores every wallet it touched.

create or replace function public.admin_direct_storefront_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o record;
  ex record;
  v_type text;
  v_role text;
  v_owner uuid;
  v_amount numeric;
  v_profit numeric := 0;
  v_credit numeric := 0;
  v_admin_base numeric := 0;
  v_agent_id uuid;
  v_sub_id uuid;
  v_sub_cost numeric;
  v_agent_to_sub numeric;
  v_sub_claw numeric := 0;
  v_agent_claw numeric := 0;
  v_attempt int;
  v_ref text;
  v_refund_id uuid;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor and role::text = 'admin') then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if o.refund_allocation_status is not null
     or coalesce(o.refunded, false)
     or lower(coalesce(o.status, '')) = 'refunded'
     or lower(coalesce(o.order_status, '')) = 'refunded'
     or lower(coalesce(o.fulfillment_status, '')) = 'refunded' then
    return jsonb_build_object('direct', true, 'already_refunded', true, 'amount', coalesce(o.refunded_amount, o.refund_allocation_amount));
  end if;

  if o.sub_subagent_store_id is not null then v_type := 'subsubagent'; v_role := 'sub_subagent'; v_owner := o.sub_subagent_store_id;
  elsif o.subagent_store_id is not null then v_type := 'subagent'; v_role := 'subagent'; v_owner := o.subagent_store_id;
  elsif o.agent_store_id is not null then v_type := 'agent'; v_role := 'agent'; v_owner := o.agent_store_id;
  else return jsonb_build_object('direct', false); end if;

  if coalesce(trim(o.paystack_reference), '') = '' or o.api_user is not null then
    return jsonb_build_object('direct', false);
  end if;

  select * into ex from public.paystack_refunds where order_id = p_order_id and paystack_reference = o.paystack_reference;
  if found and ex.status in ('pending', 'processed') then
    return jsonb_build_object('direct', true, 'already_refunded', true, 'amount', ex.amount);
  end if;

  v_amount := round(coalesce(nullif(o.amount, 0), nullif(o.selling_price, 0), 0), 2);
  if v_amount <= 0 then raise exception 'This order has no valid customer refund amount'; end if;

  v_profit := round(greatest(coalesce(o.profit, o.selling_price - o.base_price, 0), 0), 2);
  if v_profit > v_amount then v_profit := v_amount; end if;
  v_credit := round(v_amount - v_profit, 2);

  select coalesce(agent_price, 0) into v_admin_base from public.data_packages where id = o.package_id;
  v_admin_base := coalesce(v_admin_base, 0);

  if v_type = 'subsubagent' then
    select subagent_store_id, agent_store_id into v_sub_id, v_agent_id from public.sub_subagent_stores where id = v_owner;
    v_sub_cost := coalesce(o.base_price, v_admin_base);
    select base_price into v_agent_to_sub from public.subagent_package_prices
      where package_id = o.package_id and agent_store_id = v_agent_id and base_price is not null
      order by (subagent_store_id = v_sub_id) desc nulls last, created_at desc limit 1;
    v_agent_to_sub := coalesce(v_agent_to_sub, v_admin_base);
    if v_sub_id is not null then v_sub_claw := round(greatest(v_sub_cost - v_agent_to_sub, 0), 2); end if;
    if v_agent_id is not null then v_agent_claw := round(greatest(v_agent_to_sub - v_admin_base, 0), 2); end if;
  elsif v_type = 'subagent' then
    select agent_store_id into v_agent_id from public.subagent_stores where id = v_owner;
    if v_agent_id is not null then
      select sell_price into v_agent_to_sub from public.agent_package_prices
        where agent_store_id = v_agent_id and package_id = o.package_id and sell_price is not null
        order by created_at desc limit 1;
      v_agent_claw := round(greatest(coalesce(v_agent_to_sub, v_admin_base) - v_admin_base, 0), 2);
    end if;
  end if;

  select count(*) into v_attempt from public.wallet_ledger
    where owner_type = v_type and owner_id = v_owner and kind = 'refund_debit'
      and reference like p_order_id::text || ':%';
  v_ref := p_order_id::text || ':' || v_attempt::text;

  if v_credit > 0 then
    perform public.wallet_apply_internal(
      v_type, v_owner, v_credit, 'refund_allocation', v_ref,
      'Admin refund credited at the recorded base price', p_actor, true
    );
  end if;
  perform public.wallet_apply_internal(
    v_type, v_owner, -v_amount, 'refund_debit', v_ref,
    'Customer refund taken from wallet and sent back through Paystack', p_actor, true
  );

  if v_sub_claw > 0 then
    perform public.wallet_apply_internal(
      'subagent', v_sub_id, -v_sub_claw, 'refund_upline_clawback', v_ref,
      'Commission from a refunded sub-subagent order taken back', p_actor, true
    );
  end if;
  if v_agent_claw > 0 then
    perform public.wallet_apply_internal(
      'agent_commission', v_agent_id, -v_agent_claw, 'refund_upline_clawback', v_ref,
      'Commission from a refunded storefront order taken back', p_actor, true
    );
  end if;

  if found and ex.id is not null then
    update public.paystack_refunds
      set actor_user_id = p_actor, actor_role = v_role, storefront_kind = v_role, storefront_id = v_owner,
          purchase_phone = coalesce(o.customer_number, ''), amount = v_amount, wallet_amount = v_amount,
          status = 'pending', reason = 'Admin-initiated Paystack refund', wallet_deduction_status = 'deducted',
          provider_payload = null, paystack_refund_id = null, processed_at = null, updated_at = now()
      where id = ex.id
      returning id into v_refund_id;
  else
    insert into public.paystack_refunds (
      order_id, actor_user_id, actor_role, storefront_kind, storefront_id, purchase_phone,
      paystack_reference, amount, wallet_amount, status, reason, wallet_deduction_status
    ) values (
      p_order_id, p_actor, v_role, v_role, v_owner, coalesce(o.customer_number, ''),
      o.paystack_reference, v_amount, v_amount, 'pending', 'Admin-initiated Paystack refund', 'deducted'
    ) returning id into v_refund_id;
  end if;

  update public.orders
    set refund_allocation_status = 'submitted', refund_allocation_amount = v_amount,
        refund_allocation_owner_type = v_type, refund_allocation_owner_id = v_owner,
        refund_allocation_at = now(), refund_wallet_debit_at = now(),
        status = 'refunded', order_status = 'refunded', fulfillment_status = 'refunded', refunded = true,
        refund_amount = v_amount, refunded_amount = v_amount, refunded_at = now()
    where id = p_order_id;

  return jsonb_build_object(
    'direct', true, 'already_refunded', false, 'refund_id', v_refund_id,
    'amount', v_amount, 'profit', v_profit, 'base_credit', v_credit,
    'subagent_clawback', v_sub_claw, 'agent_clawback', v_agent_claw,
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
  r record;
  v_ref text;
  v_debit numeric;
  v_credit numeric;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor and role::text = 'admin') then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.refund_allocation_status is distinct from 'submitted' then
    return jsonb_build_object('reverted', false);
  end if;

  select reference into v_ref from public.wallet_ledger
    where owner_type = o.refund_allocation_owner_type and owner_id = o.refund_allocation_owner_id
      and kind = 'refund_debit' and reference like p_order_id::text || ':%'
    order by created_at desc, id desc limit 1;
  if v_ref is null then return jsonb_build_object('reverted', false); end if;

  select coalesce(-sum(delta), 0) into v_debit from public.wallet_ledger
    where owner_type = o.refund_allocation_owner_type and owner_id = o.refund_allocation_owner_id
      and kind = 'refund_debit' and reference = v_ref;
  select coalesce(sum(delta), 0) into v_credit from public.wallet_ledger
    where owner_type = o.refund_allocation_owner_type and owner_id = o.refund_allocation_owner_id
      and kind = 'refund_allocation' and reference = v_ref;

  if v_debit > 0 then
    perform public.wallet_apply_internal(
      o.refund_allocation_owner_type, o.refund_allocation_owner_id, v_debit, 'refund_debit_reversal', v_ref,
      'Paystack refund failed; wallet debit restored', p_actor, true
    );
  end if;
  if v_credit > 0 then
    perform public.wallet_apply_internal(
      o.refund_allocation_owner_type, o.refund_allocation_owner_id, -v_credit, 'refund_allocation_reversal', v_ref,
      'Paystack refund failed; base price credit removed', p_actor, true
    );
  end if;

  for r in select owner_type, owner_id, delta from public.wallet_ledger
    where kind = 'refund_upline_clawback' and reference = v_ref
  loop
    perform public.wallet_apply_internal(
      r.owner_type, r.owner_id, -r.delta, 'refund_upline_clawback_reversal', v_ref,
      'Paystack refund failed; upline commission restored', p_actor, true
    );
  end loop;

  update public.orders
    set refund_allocation_status = null, refund_allocation_amount = null,
        refund_allocation_owner_type = null, refund_allocation_owner_id = null,
        refund_allocation_at = null, refund_wallet_debit_at = null,
        status = coalesce(p_prev_status, 'paid'), order_status = p_prev_order_status,
        fulfillment_status = coalesce(p_prev_fulfillment_status, 'pending'), refunded = false,
        refund_amount = null, refunded_amount = null, refunded_at = null
    where id = p_order_id;

  update public.paystack_refunds
    set status = 'failed', wallet_deduction_status = 'restored', updated_at = now()
    where order_id = p_order_id and paystack_reference = o.paystack_reference and status = 'pending';

  return jsonb_build_object('reverted', true, 'restored_debit', v_debit, 'removed_credit', v_credit);
end $$;

revoke all on function public.admin_direct_storefront_refund_revert(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_direct_storefront_refund_revert(uuid, uuid, text, text, text) to service_role;
