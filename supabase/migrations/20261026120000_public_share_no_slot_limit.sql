create or replace function public.create_wallet_service_purchase(
  p_service_id uuid, p_phone text, p_pin_hash text, p_owner_type text, p_owner_id uuid, p_amount numeric
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_price numeric;
  v_service_name text;
  v_service_type text;
  v_order_id uuid;
  v_credential_id uuid;
  v_owner uuid;
  v_ledger public.wallet_ledger;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_phone !~ '^[0-9]{10}$' or p_pin_hash is null or length(p_pin_hash) <> 64 then
    raise exception 'Invalid wallet purchase details' using errcode = '22023';
  end if;

  select coalesce(s.price, 0), s.name, s.service_type into v_price, v_service_name, v_service_type
  from public.digital_services s where s.id = p_service_id and s.active = true;
  if v_price is null then raise exception 'Service is unavailable' using errcode = 'P0002'; end if;
  if v_price <= 0 then raise exception 'Service is unavailable' using errcode = 'P0002'; end if;

  v_owner := public.wallet_resolve_own(p_owner_type, p_owner_id);

  if v_service_type <> 'public_shared' then
    select c.id into v_credential_id
    from public.digital_service_credentials c
    where c.service_id = p_service_id and c.active = true and c.assigned_order_id is null
    order by c.slot_number for update skip locked limit 1;
    if v_credential_id is null then raise exception 'No service access slot is available' using errcode = 'P0001'; end if;
  end if;

  v_order_id := gen_random_uuid();
  v_ledger := public.wallet_apply_internal(p_owner_type, v_owner, -v_price, 'service_purchase', v_order_id::text, v_service_name, auth.uid());

  insert into public.digital_service_orders (id, service_id, credential_id, customer_phone, access_pin_hash, payment_status, access_granted_at, customer_id)
  values (v_order_id, p_service_id, v_credential_id, p_phone, p_pin_hash, 'paid', now(), case when p_owner_type = 'customer' then auth.uid() else null end);

  if v_service_type <> 'public_shared' then
    update public.digital_service_credentials
    set assigned_order_id = v_order_id, assigned_phone = p_phone, assigned_pin_hash = p_pin_hash, assigned_at = now(), updated_at = now()
    where id = v_credential_id;
  end if;

  insert into public.korba_transaction_history (wallet_owner_type, wallet_owner_id, product_type, network_code, package_code, customer_number, amount, transaction_id, provider_reference, status, source)
  values (lower(replace(p_owner_type, '_', '')), v_owner, 'subscription', v_service_name, v_service_name, p_phone, v_price, v_order_id::text, v_order_id::text, 'completed', 'dashboard');

  return jsonb_build_object('order_id', v_order_id, 'credential_id', v_credential_id, 'amount', v_price);
end;
$$;
revoke all on function public.create_wallet_service_purchase(uuid, text, text, text, uuid, numeric) from public, anon;
grant execute on function public.create_wallet_service_purchase(uuid, text, text, text, uuid, numeric) to authenticated;
