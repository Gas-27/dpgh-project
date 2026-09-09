alter table public.domain_purchases add column if not exists store_kind text not null default 'agent' check (store_kind in ('agent','subagent','subsubagent')), add column if not exists store_id uuid, add column if not exists assigned_domain text, add column if not exists assigned_at timestamptz, add column if not exists admin_notes text;
alter table public.agent_stores add column if not exists custom_domain text, add column if not exists custom_domain_status text not null default 'not_configured';
alter table public.subagent_stores add column if not exists custom_domain text, add column if not exists custom_domain_status text not null default 'not_configured';
alter table public.sub_subagent_stores add column if not exists custom_domain text, add column if not exists custom_domain_status text not null default 'not_configured';
create unique index if not exists domain_purchases_domain_unique on public.domain_purchases (lower(domain));
create unique index if not exists domain_purchases_assigned_domain_unique on public.domain_purchases (lower(assigned_domain)) where assigned_domain is not null;
create or replace function public.check_spin_eligibility(p_phone text, p_mode text, p_period text, p_minimum_count integer default 0, p_minimum_amount numeric default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_since timestamptz := case when p_period='week' then date_trunc('week',now()) else date_trunc('day',now()) end; v_count integer; v_amount numeric;
begin
 select count(*)::integer, coalesce(sum(coalesce(amount,selling_price,0)),0) into v_count,v_amount from public.orders where regexp_replace(customer_number,'\\D','','g')=regexp_replace(p_phone,'\\D','','g') and created_at>=v_since and coalesce(refunded,false)=false and (lower(coalesce(status,'')) in ('completed','delivered','success') or lower(coalesce(order_status,'')) in ('completed','delivered','success'));
 return jsonb_build_object('eligible', case when p_mode='order_count' then v_count>=greatest(p_minimum_count,0) when p_mode='order_amount' then v_amount>=greatest(p_minimum_amount,0) else true end,'order_count',v_count,'order_amount',v_amount,'period',p_period);
end; $$;

alter table public.domain_purchases add column if not exists purchased_at timestamptz, add column if not exists term_ends_at timestamptz, add column if not exists renewal_due_at timestamptz, add column if not exists reminder_sent_at timestamptz, add column if not exists auto_renew boolean not null default true, add column if not exists renewal_status text not null default 'current', add column if not exists last_renewed_at timestamptz, add column if not exists renewal_price numeric, add column if not exists custom_domain_enabled boolean not null default false;
update public.domain_purchases set purchased_at=coalesce(purchased_at,assigned_at,created_at), term_ends_at=coalesce(term_ends_at,coalesce(assigned_at,created_at)+interval '1 year'), renewal_due_at=coalesce(renewal_due_at,coalesce(assigned_at,created_at)+interval '11 months'), renewal_price=coalesce(renewal_price,price) where purchased_at is null or term_ends_at is null or renewal_due_at is null or renewal_price is null;

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
 v_price:=coalesce(v_purchase.renewal_price,v_purchase.price); if v_balance<v_price then raise exception 'Insufficient wallet balance for renewal'; end if;
 v_next:=case when v_purchase.term_ends_at>now() then v_purchase.term_ends_at+interval '1 year' else now()+interval '1 year' end;
 if v_purchase.store_kind='agent' then update public.agent_stores set wallet_balance=wallet_balance-v_price where id=v_purchase.store_id; elsif v_purchase.store_kind='subagent' then update public.subagent_stores set wallet_balance=wallet_balance-v_price where id=v_purchase.store_id; else update public.sub_subagent_stores set wallet_balance=wallet_balance-v_price where id=v_purchase.store_id; end if;
 update public.domain_purchases set term_ends_at=v_next,renewal_due_at=v_next-interval '1 month',renewal_status='current',last_renewed_at=now(),renewal_price=v_price,custom_domain_enabled=true,auto_renew=true,updated_at=now(),registration_metadata=coalesce(registration_metadata,'{}'::jsonb)||jsonb_build_object('last_renewal_idempotency_key',p_idempotency_key) where id=p_domain_purchase_id returning * into v_purchase;
 return v_purchase;
end; $$;
grant execute on function public.renew_domain_for_store(uuid,text) to authenticated;

create or replace function public.purchase_domain_for_store(p_domain text, p_store_kind text, p_store_id uuid, p_idempotency_key text, p_registration_metadata jsonb default '{}'::jsonb)
returns public.domain_purchases language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid(); v_tld text; v_price numeric; v_purchase public.domain_purchases; v_owner uuid; v_balance numeric; v_domain text := lower(trim(p_domain));
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_store_id is null then raise exception 'Store could not be identified. Refresh the dashboard and try again.'; end if;
 if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then raise exception 'A valid idempotency key is required'; end if;
 select * into v_purchase from public.domain_purchases where idempotency_key=p_idempotency_key; if found then return v_purchase; end if;
 if p_store_kind not in ('agent','subagent','subsubagent') then raise exception 'Invalid store type'; end if;
 if p_store_kind='agent' then select user_id,wallet_balance into v_owner,v_balance from public.agent_stores where id=p_store_id for update;
 elsif p_store_kind='subagent' then select user_id,wallet_balance into v_owner,v_balance from public.subagent_stores where id=p_store_id for update;
 else select user_id,wallet_balance into v_owner,v_balance from public.sub_subagent_stores where id=p_store_id for update; end if;
 if v_owner is null then raise exception 'Store was not found'; end if;
 if v_owner is distinct from v_user then raise exception 'This store does not belong to the signed-in user'; end if;
 select lower('.'||split_part(v_domain,'.',2)),customer_price into v_tld,v_price from public.spaceship_tld_pricing where lower(tld)=lower('.'||split_part(v_domain,'.',2)) and active=true;
 if v_price is null then raise exception 'No active price exists for this domain extension'; end if;
 if v_balance < v_price then raise exception 'Insufficient wallet balance'; end if;
 if p_store_kind='agent' then update public.agent_stores set wallet_balance=wallet_balance-v_price where id=p_store_id and wallet_balance>=v_price;
 elsif p_store_kind='subagent' then update public.subagent_stores set wallet_balance=wallet_balance-v_price where id=p_store_id and wallet_balance>=v_price;
 else update public.sub_subagent_stores set wallet_balance=wallet_balance-v_price where id=p_store_id and wallet_balance>=v_price; end if;
 if not found then raise exception 'Wallet balance changed. Refresh and try again.'; end if;
 insert into public.domain_purchases (buyer_user_id,agent_store_id,store_kind,store_id,domain,tld,price,status,idempotency_key,registration_metadata,auto_renew,renewal_price) values (v_user,p_store_id,p_store_kind,p_store_id,v_domain,v_tld,v_price,'pending',p_idempotency_key,coalesce(p_registration_metadata,'{}'::jsonb),true,v_price) returning * into v_purchase;
 return v_purchase;
end; $$;
