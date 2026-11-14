-- Give back a wallet debit when the order it was meant for was never created.
-- Refused if any order with that id exists, so it cannot be used to undo a real purchase.
create or replace function public.wallet_refund_failed_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_debit public.wallet_ledger; v_row public.wallet_ledger;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_debit from public.wallet_ledger
    where reference = p_order_id::text and delta < 0
      and kind in ('data_purchase','bulk_data_purchase') and actor_id = auth.uid()
    order by created_at desc limit 1;
  if not found then raise exception 'No wallet debit found for this order' using errcode = 'P0002'; end if;
  if v_debit.created_at < now() - interval '15 minutes' then
    raise exception 'Refund window has passed' using errcode = '42501';
  end if;
  if exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'An order exists for this payment' using errcode = '42501';
  end if;
  v_row := public.wallet_apply_internal(v_debit.owner_type, v_debit.owner_id, -v_debit.delta,
    'refund_failed_order', p_order_id::text, 'Order was not created', auth.uid());
  return jsonb_build_object('ledger_id', v_row.id, 'balance_after', v_row.balance_after);
end;
$$;
revoke all on function public.wallet_refund_failed_order(uuid) from public, anon;
grant execute on function public.wallet_refund_failed_order(uuid) to authenticated;

-- A wallet order counts as paid only if its debit exists, covers the order and was not refunded.
create or replace function public.order_has_wallet_debit(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    join public.wallet_ledger l on l.reference = o.id::text and l.delta < 0
      and l.kind in ('data_purchase','bulk_data_purchase')
    where o.id = p_order_id
      and -l.delta >= coalesce(o.amount, 0) - 0.01
      and not exists (select 1 from public.wallet_ledger r where r.reference = o.id::text and r.kind in ('refund_failed_order','refund'))
  )
$$;
revoke all on function public.order_has_wallet_debit(uuid) from public, anon, authenticated;
grant execute on function public.order_has_wallet_debit(uuid) to service_role;
