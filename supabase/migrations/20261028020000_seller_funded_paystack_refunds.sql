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
  if lower(coalesce(o.payment_method,'')) <> 'paystack' then raise exception 'Only Paystack orders can use this refund allocation'; end if;
  if o.refund_allocation_status in ('allocated','debited','submitted','completed') then
    return jsonb_build_object('status',o.refund_allocation_status,'amount',o.refund_allocation_amount,'owner_type',o.refund_allocation_owner_type,'owner_id',o.refund_allocation_owner_id,'already_allocated',true);
  end if;
  v_amount := round(coalesce(o.base_price,0),2);
  if v_amount <= 0 then raise exception 'Order has no recorded admin base price'; end if;
  if o.agent_store_id is not null then v_type := 'agent'; v_owner := o.agent_store_id;
  elsif o.subagent_store_id is not null then v_type := 'subagent'; v_owner := o.subagent_store_id;
  elsif o.sub_subagent_store_id is not null then v_type := 'subsubagent'; v_owner := o.sub_subagent_store_id;
  else raise exception 'Order has no seller storefront owner'; end if;
  v_ledger := public.wallet_apply_internal(v_type,v_owner,v_amount,'refund_allocation',p_order_id::text,'Admin refund allocation for Paystack order',p_actor);
  update public.orders set refund_allocation_status='allocated',refund_allocation_amount=v_amount,refund_allocation_owner_type=v_type,refund_allocation_owner_id=v_owner,refund_allocation_at=now() where id=p_order_id;
  return jsonb_build_object('status','allocated','amount',v_amount,'owner_type',v_type,'owner_id',v_owner,'ledger_id',v_ledger.id,'already_allocated',false);
end $$;
revoke all on function public.admin_allocate_order_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_allocate_order_refund(uuid,uuid) to service_role;

create or replace function public.seller_debit_order_refund(p_order_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o record; v_ledger public.wallet_ledger; v_owner uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if o.refund_allocation_status is null then raise exception 'Admin must allocate the seller refund first'; end if;
  if o.refund_allocation_status in ('debited','submitted','completed') then return jsonb_build_object('status',o.refund_allocation_status,'amount',o.refund_allocation_amount,'already_debited',true); end if;
  if public.wallet_owner_user(o.refund_allocation_owner_type,o.refund_allocation_owner_id) <> p_actor then raise exception 'Only the owning seller can initiate this refund' using errcode='42501'; end if;
  v_owner := o.refund_allocation_owner_id;
  v_ledger := public.wallet_apply_internal(o.refund_allocation_owner_type,v_owner,-o.refund_allocation_amount,'refund_debit',p_order_id::text,'Paystack customer refund debit',p_actor);
  update public.orders set refund_allocation_status='debited',refund_wallet_debit_at=now() where id=p_order_id;
  return jsonb_build_object('status','debited','amount',o.refund_allocation_amount,'ledger_id',v_ledger.id,'already_debited',false);
end $$;
revoke all on function public.seller_debit_order_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function public.seller_debit_order_refund(uuid,uuid) to service_role;
