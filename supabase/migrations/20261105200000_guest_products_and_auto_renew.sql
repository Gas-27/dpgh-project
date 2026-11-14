-- Auto renew for paid product plans (on by default)
alter table public.store_product_entitlements add column if not exists auto_renew boolean not null default true;

-- Guest ("Pair your product") listings
alter table public.store_products add column if not exists is_guest boolean not null default false;
alter table public.store_products add column if not exists guest_plan text;
alter table public.store_products add column if not exists guest_expires_at timestamptz;
alter table public.store_products add column if not exists guest_payment_reference text;
alter table public.store_products drop constraint if exists store_products_guest_plan_check;
alter table public.store_products add constraint store_products_guest_plan_check check (guest_plan is null or guest_plan in ('weekly', 'monthly'));
create index if not exists store_products_guest_expiry_idx on public.store_products (guest_expires_at) where is_guest and status = 'active';

-- Manual plan purchases switch auto renew back on
create or replace function public.purchase_store_product_plan(p_store_kind text, p_store_id uuid, p_plan text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_wallet_owner uuid;
  v_price numeric;
  v_limit integer;
  v_days integer;
  v_expires timestamptz;
  v_row public.wallet_ledger;
begin
  if p_plan = 'weekly' then v_price := 5; v_limit := 5; v_days := 7;
  elsif p_plan = 'monthly' then v_price := 20; v_limit := 30; v_days := 30;
  else raise exception 'Invalid plan' using errcode = '22023';
  end if;
  if p_store_kind not in ('customer', 'agent', 'subagent', 'subsubagent') then
    raise exception 'Invalid store type' using errcode = '22023';
  end if;

  v_wallet_owner := public.wallet_resolve_own(p_store_kind, p_store_id);
  v_row := public.wallet_apply_internal(p_store_kind, v_wallet_owner, -v_price, 'product_plan', gen_random_uuid()::text, p_plan || ' product plan', auth.uid());
  v_expires := now() + make_interval(days => v_days);

  insert into public.store_product_entitlements (store_id, store_kind, paid_post_limit, paid_post_expires_at, plan_type, auto_renew, updated_at)
  values (p_store_id, p_store_kind, v_limit, v_expires, p_plan, true, now())
  on conflict (store_id) do update
    set store_kind = excluded.store_kind,
        paid_post_limit = excluded.paid_post_limit,
        paid_post_expires_at = excluded.paid_post_expires_at,
        plan_type = excluded.plan_type,
        auto_renew = true,
        updated_at = now();

  return jsonb_build_object('ledger_id', v_row.id, 'balance_after', v_row.balance_after, 'expires_at', v_expires);
end;
$function$;

-- Guests may upload images under guests/ only
drop policy if exists "Guests upload product images" on storage.objects;
create policy "Guests upload product images"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'public-store-products' and (storage.foldername(name))[1] = 'guests');

-- Create an unpaid guest listing (stays hidden until payment is confirmed)
create or replace function public.create_guest_store_product(
  p_store_kind text, p_store_id uuid, p_title text, p_description text, p_price numeric,
  p_region text, p_image_urls jsonb, p_whatsapp text, p_plan text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_id uuid;
  v_number text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g');
begin
  if p_store_kind not in ('agent', 'subagent', 'subsubagent') then raise exception 'Invalid store'; end if;
  if p_store_kind = 'agent' then select exists (select 1 from public.agent_stores where id = p_store_id) into v_exists;
  elsif p_store_kind = 'subagent' then select exists (select 1 from public.subagent_stores where id = p_store_id) into v_exists;
  else select exists (select 1 from public.sub_subagent_stores where id = p_store_id) into v_exists;
  end if;
  if not v_exists then raise exception 'Store not found'; end if;
  if p_plan not in ('weekly', 'monthly') then raise exception 'Choose a plan'; end if;
  if length(trim(coalesce(p_title, ''))) < 2 or length(p_title) > 120 then raise exception 'Enter a product name'; end if;
  if length(coalesce(p_description, '')) > 2000 then raise exception 'Description is too long'; end if;
  if p_price is null or p_price <= 0 or p_price > 1000000 then raise exception 'Enter a valid price'; end if;
  if length(v_number) < 9 or length(v_number) > 15 then raise exception 'Enter a valid WhatsApp number'; end if;
  if jsonb_typeof(p_image_urls) <> 'array' or jsonb_array_length(p_image_urls) < 1 or jsonb_array_length(p_image_urls) > 4 then
    raise exception 'Add between 1 and 4 images';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_image_urls) u
    where u not like 'https://%/storage/v1/object/public/public-store-products/guests/%'
  ) then raise exception 'Invalid image'; end if;

  insert into public.store_products (store_id, store_kind, title, description, price, region, image_urls, payment_mode, whatsapp_payment_number, status, available, is_guest, guest_plan)
  values (p_store_id, p_store_kind, trim(p_title), trim(coalesce(p_description, '')), p_price, nullif(trim(coalesce(p_region, '')), ''), p_image_urls, 'whatsapp', v_number, 'inactive', false, true, p_plan)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.create_guest_store_product(text, uuid, text, text, numeric, text, jsonb, text, text) to anon, authenticated;

-- Called by the payment webhook (service role) once Paystack confirms payment
create or replace function public.activate_guest_store_product(p_product_id uuid, p_reference text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.store_products;
  v_price numeric;
  v_days integer;
begin
  select * into r from public.store_products where id = p_product_id and is_guest for update;
  if not found then raise exception 'Guest product not found'; end if;
  if r.guest_payment_reference is not null then
    return jsonb_build_object('status', 'already_active', 'expires_at', r.guest_expires_at);
  end if;
  if r.guest_plan = 'weekly' then v_price := 2; v_days := 7;
  elsif r.guest_plan = 'monthly' then v_price := 5; v_days := 30;
  else raise exception 'Invalid plan';
  end if;
  if coalesce(p_amount, 0) + 0.01 < v_price then raise exception 'Payment amount too low'; end if;
  update public.store_products
    set status = 'active', available = true, guest_payment_reference = p_reference,
        guest_expires_at = now() + make_interval(days => v_days), updated_at = now()
    where id = p_product_id;
  return jsonb_build_object('status', 'activated', 'expires_at', now() + make_interval(days => v_days));
end $$;

revoke all on function public.activate_guest_store_product(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.activate_guest_store_product(uuid, text, numeric) to service_role;

-- Hides guest listings once their paid week or month is over
create or replace function public.expire_guest_store_products()
returns void
language sql
security definer
set search_path = public
as $$
  update public.store_products set status = 'expired', available = false, updated_at = now()
  where is_guest and status = 'active' and guest_expires_at is not null and guest_expires_at < now();
$$;
grant execute on function public.expire_guest_store_products() to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-guest-store-products', '*/15 * * * *', 'select public.expire_guest_store_products()');
  end if;
end $$;
