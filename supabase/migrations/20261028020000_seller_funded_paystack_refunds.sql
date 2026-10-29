alter table public.orders
  add column if not exists refund_allocation_status text,
  add column if not exists refund_allocation_amount numeric(14,2),
  add column if not exists refund_allocation_owner_type text,
  add column if not exists refund_allocation_owner_id uuid,
  add column if not exists refund_allocation_at timestamptz,
  add column if not exists refund_wallet_debit_at timestamptz;

create or replace function public.admin_allocate_order_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o record; v_type text; v_owner uuid; v_amount numeric; v_ledger public.wallet_ledger;
begin
  if not exists (select 1 from public.user_roles where user_id=p_actor and role::text='admin') then raise exception 'Admin authorization required' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if lower(coalesce(o.payment_method,'')) <> 'paystack' and o.api_user is null and lower(coalesce(o.source,'')) <> 'api' and lower(coalesce(o.payment_method,'')) <> 'api_wallet' then raise exception 'Only Paystack or API orders can use this refund allocation'; end if;
  if o.refund_allocation_status in ('allocated','debited','submitted','completed') then
    return jsonb_build_object('status',o.refund_allocation_status,'amount',o.refund_allocation_amount,'owner_type',o.refund_allocation_owner_type,'owner_id',o.refund_allocation_owner_id,'already_allocated',true);
  end if;
  v_amount := round(coalesce(o.base_price,0),2);
  if v_amount <= 0 then raise exception 'Order has no recorded admin base price'; end if;
  if o.api_user is not null then
    if not public.api_sms_refund(o.api_user::uuid, v_amount) then raise exception 'API wallet refund could not be credited'; end if;
    update public.orders set refund_allocation_status='completed', refund_allocation_amount=v_amount, refund_allocation_owner_type='api', refund_allocation_owner_id=o.api_user::uuid, refund_allocation_at=now(), status='refunded', fulfillment_status='refunded' where id=p_order_id;
    return jsonb_build_object('status','completed','amount',v_amount,'owner_type','api','owner_id',o.api_user::uuid,'already_allocated',false);
  elsif o.sub_subagent_store_id is not null then v_type := 'subsubagent'; v_owner := o.sub_subagent_store_id;
  elsif o.subagent_store_id is not null then v_type := 'subagent'; v_owner := o.subagent_store_id;
  elsif o.agent_store_id is not null then v_type := 'agent'; v_owner := o.agent_store_id;
  else raise exception 'Order has no seller storefront owner'; end if;
  v_ledger := public.wallet_apply_internal(v_type,v_owner,v_amount,'refund_allocation',p_order_id::text,'Admin refund allocation for Paystack order',p_actor);
  update public.orders set refund_allocation_status='allocated',refund_allocation_amount=v_amount,refund_allocation_owner_type=v_type,refund_allocation_owner_id=v_owner,refund_allocation_at=now() where id=p_order_id;
  return jsonb_build_object('status','allocated','amount',v_amount,'owner_type',v_type,'owner_id',v_owner,'ledger_id',v_ledger.id,'already_allocated',false);
end $$;
revoke all on function public.admin_allocate_order_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_allocate_order_refund(uuid,uuid) to service_role;

create or replace function public.seller_debit_order_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o record; v_ledger public.wallet_ledger; v_owner uuid; v_debit numeric;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if o.refund_allocation_status is null then raise exception 'Admin must allocate the seller refund first'; end if;
  if o.refund_allocation_status in ('debited','submitted','completed') then return jsonb_build_object('status',o.refund_allocation_status,'amount',o.refund_allocation_amount,'already_debited',true); end if;
  if public.wallet_owner_user(o.refund_allocation_owner_type,o.refund_allocation_owner_id) <> p_actor
    and not (o.refund_allocation_owner_type='subagent' and exists (select 1 from public.subagent_stores s join public.agent_stores a on a.id=s.agent_store_id where s.id=o.refund_allocation_owner_id and a.user_id=p_actor))
    and not (o.refund_allocation_owner_type='subsubagent' and exists (select 1 from public.sub_subagent_stores ss join public.subagent_stores s on s.id=ss.subagent_store_id join public.agent_stores a on a.id=ss.agent_store_id where ss.id=o.refund_allocation_owner_id and (s.user_id=p_actor or a.user_id=p_actor)))
  then raise exception 'Only the owning seller or its parent agent can initiate this refund' using errcode='42501'; end if;
  v_owner := o.refund_allocation_owner_id;
  v_debit := round(coalesce(o.amount,o.selling_price,o.base_price,0),2);
  if v_debit <= 0 then raise exception 'Order has no valid customer refund amount'; end if;
  v_ledger := public.wallet_apply_internal(o.refund_allocation_owner_type,v_owner,-v_debit,'refund_debit',p_order_id::text,'Paystack customer refund including seller profit reversal',p_actor);
  update public.orders set refund_allocation_status='debited',refund_wallet_debit_at=now() where id=p_order_id;
  return jsonb_build_object('status','debited','amount',v_debit,'base_price',o.refund_allocation_amount,'ledger_id',v_ledger.id,'already_debited',false);
end $$;
revoke all on function public.seller_debit_order_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function public.seller_debit_order_refund(uuid,uuid) to service_role;
