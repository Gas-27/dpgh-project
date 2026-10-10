create table if not exists public.subscription_settings (
  id boolean primary key default true check (id),
  whatsapp_number text not null default '+233274467682',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.subscription_settings (id, whatsapp_number) values (true, '+233274467682') on conflict (id) do nothing;

create table if not exists public.private_share_subscriptions (
  id uuid primary key default gen_random_uuid(),
  payment_reference text not null unique,
  customer_id uuid references auth.users(id),
  customer_name text,
  customer_email text,
  customer_phone text,
  service_id text,
  service_name text not null,
  service_link text,
  amount numeric(12,2) not null default 0,
  fee_amount numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  seller_store_kind text check (seller_store_kind in ('agent','subagent','subsubagent')),
  seller_store_id uuid,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  confirmation_status text not null default 'pending' check (confirmation_status in ('pending','confirmed','rejected')),
  paid_at timestamptz,
  whatsapp_number text,
  whatsapp_url text,
  whatsapp_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists private_share_subscriptions_reference_idx on public.private_share_subscriptions (payment_reference);
create index if not exists private_share_subscriptions_customer_idx on public.private_share_subscriptions (customer_id);
create index if not exists private_share_subscriptions_created_idx on public.private_share_subscriptions (created_at desc);

alter table public.subscription_settings enable row level security;
alter table public.private_share_subscriptions enable row level security;

drop policy if exists subscription_settings_admin_read on public.subscription_settings;
create policy subscription_settings_admin_read on public.subscription_settings for select to authenticated using (true);
drop policy if exists subscriptions_admin_read on public.private_share_subscriptions;
create policy subscriptions_admin_read on public.private_share_subscriptions for select to authenticated using (true);

create or replace function public.credit_private_share_subscription(
  p_reference text,
  p_amount numeric,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_service_id text,
  p_service_name text,
  p_service_link text,
  p_seller_store_kind text,
  p_seller_store_id uuid,
  p_fee_amount numeric,
  p_provider_payload jsonb
) returns public.private_share_subscriptions
language plpgsql security definer set search_path = public
as $$
declare v_subscription public.private_share_subscriptions; v_whatsapp text; v_message text; v_url text;
begin
  select whatsapp_number into v_whatsapp from public.subscription_settings where id = true;
  v_whatsapp := coalesce(v_whatsapp, '+233274467682');
  select * into v_subscription from public.private_share_subscriptions where payment_reference = p_reference for update;
  if found and v_subscription.payment_status = 'paid' then return v_subscription; end if;
  v_message := format('Private-share subscription payment confirmed.%sService: %s%sAmount: GHS %s%sPayment reference: %s%sCustomer: %s%sPhone: %s%sPaid at: %s', E'\n', p_service_name, E'\nLink: ' || coalesce(p_service_link, 'N/A'), to_char(p_amount, 'FM999999990.00'), E'\n', p_reference, E'\n', coalesce(p_customer_name, 'N/A'), E'\n', coalesce(p_customer_phone, 'N/A'), E'\n', to_char(now(), 'YYYY-MM-DD HH24:MI:SS TZ'));
  v_url := 'https://wa.me/' || regexp_replace(v_whatsapp, '\\D', '', 'g') || '?text=' || replace(replace(replace(v_message, '%', '%25'), ' ', '%20'), E'\n', '%0A');
  insert into public.private_share_subscriptions (payment_reference, customer_id, customer_name, customer_email, customer_phone, service_id, service_name, service_link, amount, fee_amount, selling_price, seller_store_kind, seller_store_id, payment_status, paid_at, whatsapp_number, whatsapp_url, whatsapp_message, provider_payload)
  values (p_reference, p_customer_id, p_customer_name, p_customer_email, p_customer_phone, p_service_id, p_service_name, p_service_link, p_amount, coalesce(p_fee_amount,0), p_amount, p_seller_store_kind, p_seller_store_id, 'paid', now(), v_whatsapp, v_url, v_message, coalesce(p_provider_payload,'{}'::jsonb))
  on conflict (payment_reference) do update set payment_status='paid', paid_at=coalesce(private_share_subscriptions.paid_at, now()), provider_payload=excluded.provider_payload, whatsapp_number=excluded.whatsapp_number, whatsapp_url=excluded.whatsapp_url, whatsapp_message=excluded.whatsapp_message, updated_at=now()
  returning * into v_subscription;
  return v_subscription;
end; $$;
revoke all on function public.credit_private_share_subscription(text,numeric,uuid,text,text,text,text,text,text,text,uuid,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.credit_private_share_subscription(text,numeric,uuid,text,text,text,text,text,text,text,uuid,numeric,jsonb) to service_role;

create or replace function public.set_subscription_settings(p_whatsapp_number text)
returns public.subscription_settings language plpgsql security invoker set search_path = public
as $$ declare v_row public.subscription_settings; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_whatsapp_number !~ '^\\+?[0-9]{10,15}$' then raise exception 'Enter a valid WhatsApp number'; end if;
  update public.subscription_settings set whatsapp_number=trim(p_whatsapp_number), updated_by=auth.uid(), updated_at=now() where id=true returning * into v_row; return v_row;
end; $$;
grant execute on function public.set_subscription_settings(text) to authenticated;

comment on table public.private_share_subscriptions is 'Verified private-share subscription payments and WhatsApp tracking records';
comment on table public.subscription_settings is 'Admin-controlled subscription WhatsApp destination';
