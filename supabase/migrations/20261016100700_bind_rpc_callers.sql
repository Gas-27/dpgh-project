-- Bind caller-supplied user ids to the authenticated session and remove anonymous access.

CREATE OR REPLACE FUNCTION public.cancel_waiting_order(p_order_id uuid, p_actor_user_id uuid, p_actor_role text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare o public.orders%rowtype; store_id uuid; store_table text; amount numeric; begin if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or auth.uid() <> p_actor_user_id) then raise exception 'Not authorized'; end if; select * into o from public.orders where id=p_order_id for update; if not found then raise exception 'Order not found'; end if; if lower(coalesce(o.network,'')) not in ('mtn','mtn express','mtn_express') then raise exception 'Only MTN and MTN Express waiting orders can be cancelled'; end if; if lower(coalesce(o.order_status,o.fulfillment_status,o.status,'')) not in ('waiting','number verifying','number_verifying','in-queue','queued','pending') then raise exception 'Only waiting or number-verifying orders can be cancelled'; end if; if o.created_at > now() - interval '48 hours' then raise exception 'This order can only be cancelled after 48 hours'; end if; if o.refunded is true or coalesce(o.refunded_amount,0) > 0 then raise exception 'This order has already been refunded'; end if; if p_actor_role='agent' then store_id:=o.agent_store_id; store_table:='agent_stores'; elsif p_actor_role='subagent' then store_id:=o.subagent_store_id; store_table:='subagent_stores'; elsif p_actor_role in ('sub_subagent','subsubagent') then store_id:=o.sub_subagent_store_id; store_table:='sub_subagent_stores'; else raise exception 'Invalid actor role'; end if; if store_id is null then raise exception 'Store ownership could not be determined'; end if; if not exists (select 1 from public.agent_stores where id=store_id and user_id=p_actor_user_id) and not exists (select 1 from public.subagent_stores where id=store_id and user_id=p_actor_user_id) and not exists (select 1 from public.sub_subagent_stores where id=store_id and user_id=p_actor_user_id) then raise exception 'You are not allowed to cancel this order'; end if; amount:=coalesce(o.selling_price,o.amount,0); if amount <= 0 then raise exception 'Order has no refundable amount'; end if; if store_table='agent_stores' then update public.agent_stores set wallet_balance=coalesce(wallet_balance,0)+amount where id=store_id; elsif store_table='subagent_stores' then update public.subagent_stores set wallet_balance=coalesce(wallet_balance,0)+amount where id=store_id; else update public.sub_subagent_stores set wallet_balance=coalesce(wallet_balance,0)+amount where id=store_id; end if; update public.orders set status='refunded', order_status='cancelled', fulfillment_status='cancelled', refunded=true, refunded_amount=amount, refund_amount=amount, refunded_at=now(), refund_date=now(), refund_destination='wallet', updated_at=now(), api_response=coalesce(api_response,'{}'::jsonb) || jsonb_build_object('cancelled_by_role',p_actor_role,'cancellation_reason',coalesce(p_reason,'Waiting order cancelled after 48 hours')) where id=p_order_id; return jsonb_build_object('success',true,'order_id',p_order_id,'amount',amount,'store_id',store_id); end; $function$
;

CREATE OR REPLACE FUNCTION public.get_sms_wallet(p_user_id uuid, p_owner_type text DEFAULT 'customer'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_balance numeric := 0;
begin if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or auth.uid() <> p_user_id) and not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Not authorized'; end if;   if p_owner_type = 'agent' then select coalesce(wallet_balance,0) into v_balance from public.agent_stores where user_id=p_user_id order by created_at desc limit 1;
  elsif p_owner_type = 'subagent' then select coalesce(wallet_balance,0) into v_balance from public.subagent_stores where user_id=p_user_id order by created_at desc limit 1;
  elsif p_owner_type = 'subsubagent' then select coalesce(wallet_balance,0) into v_balance from public.sub_subagent_stores where user_id=p_user_id order by created_at desc limit 1;
  else select coalesce(wallet_balance,0) into v_balance from public.customers where user_id=p_user_id order by created_at desc limit 1;
  end if;
  return coalesce(v_balance,0);
end; $function$
;

revoke execute on function public.cancel_waiting_order(uuid, uuid, text, text) from public, anon;
grant execute on function public.cancel_waiting_order(uuid, uuid, text, text) to authenticated, service_role;
revoke execute on function public.get_sms_wallet(uuid, text) from public, anon;
grant execute on function public.get_sms_wallet(uuid, text) to authenticated, service_role;
