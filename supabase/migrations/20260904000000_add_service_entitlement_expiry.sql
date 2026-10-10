alter table public.digital_service_orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists access_expires_at timestamptz;

update public.digital_service_orders
set access_expires_at = coalesce(access_granted_at, created_at) + interval '7 days'
where access_expires_at is null;

create index if not exists digital_service_orders_customer_access_idx
  on public.digital_service_orders (customer_id, service_id, customer_phone, access_expires_at);
