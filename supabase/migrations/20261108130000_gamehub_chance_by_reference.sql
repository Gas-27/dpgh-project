-- Store-front chances: match the paid data order to the chance order by Paystack reference.
-- The order must belong to the signed-in player, be at least as large as the chance pack,
-- be created after the chance order, and never be reused for another chance.

create or replace function public.gamehub_apply_chance_by_reference(p_chance_order_id uuid, p_reference text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.gamehub_chance_orders; r public.gamehub_runs; o record;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  select * into c from public.gamehub_chance_orders where id = p_chance_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Chance order not found'; end if;
  if c.applied then
    select * into r from public.gamehub_runs where id = c.run_id;
    return jsonb_build_object('ok', true, 'run', public.gamehub_run_json(r), 'game_id', c.game_id);
  end if;
  if p_reference is null or length(p_reference) < 8 then
    raise exception 'Payment reference missing';
  end if;

  select id, status, size_gb into o from public.orders
    where paystack_reference = p_reference
      and (customer_id = auth.uid() or user_id = auth.uid())
      and created_at >= c.created_at - interval '1 minute'
      and size_gb >= c.gb
      and not exists (select 1 from public.gamehub_chance_orders x where x.order_id = orders.id)
    order by created_at desc limit 1;

  if not found or o.status not in ('completed', 'processing', 'paid', 'pending_processing') then
    raise exception 'Payment for this chance has not been confirmed yet';
  end if;

  update public.gamehub_runs set lives = lives + c.chances, updated_at = now()
    where id = c.run_id and status = 'active' returning * into r;
  if not found then raise exception 'Game session is no longer active'; end if;
  update public.gamehub_chance_orders set applied = true, order_id = o.id where id = c.id;
  return jsonb_build_object('ok', true, 'run', public.gamehub_run_json(r), 'game_id', c.game_id);
end $$;

revoke all on function public.gamehub_apply_chance_by_reference(uuid, text) from public, anon;
grant execute on function public.gamehub_apply_chance_by_reference(uuid, text) to authenticated;

-- Direct order-id application is replaced by the reference-bound version above.
revoke execute on function public.gamehub_apply_chance_order(uuid, uuid) from authenticated;
