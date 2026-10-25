create table if not exists public.order_number_submitted_queue (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  normalized_phone text not null,
  order_id text,
  requester_id uuid,
  requester_role text,
  source text,
  submitted_by uuid default auth.uid(),
  submitted_at timestamptz not null default now(),
  unique (submission_id)
);

create index if not exists order_number_submitted_queue_submitted_idx
  on public.order_number_submitted_queue (submitted_at desc);

create table if not exists public.admin_canceled_waiting_numbers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  customer_number text not null,
  network text,
  amount numeric,
  original_status text,
  canceled_by uuid default auth.uid(),
  canceled_at timestamptz not null default now()
);

create index if not exists admin_canceled_waiting_numbers_canceled_idx
  on public.admin_canceled_waiting_numbers (canceled_at desc);

alter table public.order_number_submitted_queue enable row level security;
alter table public.admin_canceled_waiting_numbers enable row level security;

drop policy if exists "admin submitted queue" on public.order_number_submitted_queue;
create policy "admin submitted queue" on public.order_number_submitted_queue for all to authenticated using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());
drop policy if exists "admin canceled waiting queue" on public.admin_canceled_waiting_numbers;
create policy "admin canceled waiting queue" on public.admin_canceled_waiting_numbers for all to authenticated using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

grant all on public.order_number_submitted_queue to authenticated;
grant all on public.admin_canceled_waiting_numbers to authenticated;

create or replace function public.archive_submitted_order_number(p_submission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.order_number_submitted_queue (submission_id, normalized_phone, order_id, requester_id, requester_role, source)
  select id, normalized_phone, order_id, requester_id, requester_role, source
  from public.order_number_submissions where id = p_submission_id
  on conflict (submission_id) do nothing;
  update public.order_number_submissions set status = 'approved', updated_at = now() where id = p_submission_id;
end;
$$;

create or replace function public.archive_canceled_waiting_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_canceled_waiting_numbers (order_id, customer_number, network, amount, original_status)
  select id, customer_number, network, amount, coalesce(order_status, status)
  from public.orders where id = p_order_id
  on conflict (order_id) do nothing;
  update public.orders set order_status = 'canceled', status = 'canceled', updated_at = now() where id = p_order_id;
end;
$$;

grant execute on function public.archive_submitted_order_number(uuid) to authenticated;
grant execute on function public.archive_canceled_waiting_order(uuid) to authenticated;
