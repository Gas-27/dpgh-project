alter table public.spaceship_tld_pricing add column if not exists renewal_customer_price numeric;
update public.spaceship_tld_pricing set renewal_customer_price = coalesce(renewal_customer_price, customer_price);

create or replace function public.renew_domain_for_store(p_domain_purchase_id uuid,p_idempotency_key text)
returns public.domain_purchases language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_purchase public.domain_purchases; v_owner uuid; v_balance numeric; v_price numeric; v_next timestamptz;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_idempotency_key is null or length(trim(p_idempotency_key))<8 then raise exception 'A valid idempotency key is required'; end if;
 select * into v_purchase from public.domain_purchases where id=p_domain_purchase_id for update;
 if not found then raise exception 'Domain purchase not found'; end if;
 if v_purchase.store_kind='agent' then select user_id,wallet_balance into v_owner,v_balance from public.agent_stores where id=v_purchase.store_id for update; elsif v_purchase.store_kind='subagent' then select user_id,wallet_balance into v_owner,v_balance from public.subagent_stores where id=v_purchase.store_id for update; else select user_id,wallet_balance into v_owner,v_balance from public.sub_subagent_stores where id=v_purchase.store_id for update; end if;
 if v_owner is distinct from v_user then raise exception 'This domain does not belong to the signed-in user'; end if;
 select coalesce(renewal_customer_price, customer_price) into v_price from public.spaceship_tld_pricing where lower(tld)=lower(v_purchase.tld) and active=true;
 v_price:=coalesce(v_price,v_purchase.renewal_price,v_purchase.price);
 if v_balance<v_price then raise exception 'Insufficient wallet balance for renewal'; end if;
 v_next:=case when v_purchase.term_ends_at>now() then v_purchase.term_ends_at+interval '1 year' else now()+interval '1 year' end;
 if v_purchase.store_kind='agent' then update public.agent_stores set wallet_balance=wallet_balance-v_price where id=v_purchase.store_id; elsif v_purchase.store_kind='subagent' then update public.subagent_stores set wallet_balance=wallet_balance-v_price where id=v_purchase.store_id; else update public.sub_subagent_stores set wallet_balance=wallet_balance-v_price where id=v_purchase.store_id; end if;
 update public.domain_purchases set term_ends_at=v_next,renewal_due_at=v_next-interval '1 month',renewal_status='current',last_renewed_at=now(),renewal_price=v_price,custom_domain_enabled=true,auto_renew=true,updated_at=now(),registration_metadata=coalesce(registration_metadata,'{}'::jsonb)||jsonb_build_object('last_renewal_idempotency_key',p_idempotency_key) where id=p_domain_purchase_id returning * into v_purchase;
 return v_purchase;
end; $$;

grant execute on function public.renew_domain_for_store(uuid,text) to authenticated;

alter table public.social_boost_orders add column if not exists base_amount numeric, add column if not exists selling_amount numeric, add column if not exists profit_amount numeric, add column if not exists seller_store_kind text, add column if not exists seller_store_id uuid, add column if not exists payment_reference text;
create index if not exists social_boost_orders_seller_store_idx on public.social_boost_orders (seller_store_kind, seller_store_id, created_at desc);
select pg_notify('pgrst','reload schema');
