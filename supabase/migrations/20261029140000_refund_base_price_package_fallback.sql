-- Orders stored with base_price = 0 could never be refunded from the admin dashboard.
-- When the order carries no base price, fall back to the admin price of its package:
-- api_price for API orders, price for every other order. For orders that do have a
-- base_price it always equals these package columns, so the fallback matches the
-- price the admin set.
create or replace function public.admin_allocate_order_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o record;
  v_type text;
  v_owner uuid;
  v_amount numeric;
  v_ledger public.wallet_ledger;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor and role::text = 'admin') then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if o.refund_allocation_status in ('allocated','debited','submitted','completed')
     or coalesce(o.refunded, false)
     or lower(coalesce(o.status, '')) = 'refunded'
     or lower(coalesce(o.fulfillment_status, '')) = 'refunded' then
    if lower(coalesce(o.status, '')) <> 'refunded' then
      update public.orders
        set status = 'refunded', order_status = 'refunded', fulfillment_status = 'refunded', refunded = true,
            refund_amount = coalesce(o.refund_amount, o.refund_allocation_amount),
            refunded_amount = coalesce(o.refunded_amount, o.refund_allocation_amount),
            refunded_at = coalesce(o.refunded_at, now())
        where id = p_order_id;
    end if;
    return jsonb_build_object('status', coalesce(o.refund_allocation_status, 'completed'), 'amount', coalesce(o.refund_allocation_amount, o.refunded_amount), 'owner_type', o.refund_allocation_owner_type, 'owner_id', o.refund_allocation_owner_id, 'already_allocated', true);
  end if;

  v_amount := round(coalesce(o.base_price, 0), 2);
  if v_amount <= 0 and o.package_id is not null then
    select round(coalesce(case when o.api_user is not null then p.api_price else p.price end, 0), 2)
      into v_amount
      from public.data_packages p
      where p.id = o.package_id;
    v_amount := coalesce(v_amount, 0);
  end if;
  if v_amount <= 0 then raise exception 'Order has no recorded admin base price'; end if;

  if o.api_user is not null then
    if not public.api_sms_refund(o.api_user::uuid, v_amount) then
      raise exception 'API wallet refund could not be credited';
    end if;
    update public.orders
      set refund_allocation_status = 'completed', refund_allocation_amount = v_amount,
          refund_allocation_owner_type = 'api', refund_allocation_owner_id = o.api_user::uuid, refund_allocation_at = now(),
          status = 'refunded', order_status = 'refunded', fulfillment_status = 'refunded', refunded = true,
          refund_amount = v_amount, refunded_amount = v_amount, refunded_at = now()
      where id = p_order_id;
    return jsonb_build_object('status', 'completed', 'amount', v_amount, 'owner_type', 'api', 'owner_id', o.api_user::uuid, 'already_allocated', false);
  end if;

  v_owner := coalesce(
    o.agent_store_id,
    o.root_agent_store_id,
    (select s.agent_store_id from public.subagent_stores s where s.id = o.subagent_store_id),
    (select ss.agent_store_id from public.sub_subagent_stores ss where ss.id = o.sub_subagent_store_id)
  );
  if v_owner is not null then
    v_type := 'agent';
  elsif o.customer_id is not null then
    v_type := 'customer';
    v_owner := o.customer_id;
  else
    raise exception 'Order has no wallet owner';
  end if;

  v_ledger := public.wallet_apply_internal(v_type, v_owner, v_amount, 'refund_allocation', p_order_id::text, 'Admin refund at recorded base price', p_actor);

  update public.orders
    set refund_allocation_status = 'allocated', refund_allocation_amount = v_amount,
        refund_allocation_owner_type = v_type, refund_allocation_owner_id = v_owner, refund_allocation_at = now(),
        status = 'refunded', order_status = 'refunded', fulfillment_status = 'refunded', refunded = true,
        refund_amount = v_amount, refunded_amount = v_amount, refunded_at = now()
    where id = p_order_id;

  return jsonb_build_object('status', 'allocated', 'amount', v_amount, 'owner_type', v_type, 'owner_id', v_owner, 'ledger_id', v_ledger.id, 'already_allocated', false);
end $$;

revoke all on function public.admin_allocate_order_refund(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_allocate_order_refund(uuid, uuid) to service_role;
