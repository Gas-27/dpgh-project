-- Private-share fulfilment foundation (Phase 1).
-- Additive only: creates new tables/functions, does not alter any existing table,
-- policy or function. Public-share and data-order flows are untouched.

create or replace function public.private_share_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

-- Backend guard: only services typed private_shared may be configured or hold accounts.
create or replace function public.private_share_require_private_service()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text;
begin
  select service_type into v_type from public.digital_services where id = new.service_id;
  if v_type is distinct from 'private_shared' then
    raise exception 'Service is not a private-share service' using errcode = '23514';
  end if;
  return new;
end; $$;

-- 1. Per-product approval and fulfilment settings (disabled by default).
create table if not exists public.private_share_product_config (
  service_id uuid primary key references public.digital_services(id) on delete restrict,
  enabled boolean not null default false,
  fulfillment_mode text not null default 'admin_assisted' check (fulfillment_mode in ('admin_assisted','supplier_api')),
  entitlement_days integer not null default 30 check (entitlement_days between 1 and 3650),
  default_capacity integer check (default_capacity is null or default_capacity >= 1),
  requires_verification boolean not null default false,
  verification_provider text check (verification_provider is null or verification_provider in ('gmail','microsoft','manual')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_share_config_enabled_requires_approval check (not enabled or approved_at is not null)
);

-- 2. Email identities (independent of services and accounts).
create table if not exists public.private_share_email_identities (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  provider_kind text not null default 'other' check (provider_kind in ('gmail','microsoft','other')),
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists private_share_email_identities_email_uniq on public.private_share_email_identities (email);

-- 3. Service accounts. Capacity is per account; no passwords are stored here.
create table if not exists public.private_share_accounts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.digital_services(id) on delete restrict,
  label text not null,
  capacity integer not null check (capacity >= 1),
  capacity_basis text,
  account_subscription_expires_at timestamptz,
  maintenance_status text not null default 'active' check (maintenance_status in ('active','maintenance','suspended','retired')),
  maintenance_until timestamptz,
  supplier_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, label),
  unique (id, service_id)
);

-- 4. Many-to-many: accounts <-> email identities, with a role.
create table if not exists public.private_share_account_email_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.private_share_accounts(id) on delete cascade,
  email_identity_id uuid not null references public.private_share_email_identities(id) on delete restrict,
  role text not null check (role in ('login','recovery','verification')),
  created_at timestamptz not null default now(),
  unique (account_id, email_identity_id, role)
);
create index if not exists private_share_links_email_idx on public.private_share_account_email_links (email_identity_id);

-- 5. Customer entitlements. Capacity is held by active, expired and revoked rows until an admin releases them.
create table if not exists public.private_share_assignments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null unique references public.private_share_subscriptions(id) on delete restrict,
  service_id uuid not null references public.digital_services(id) on delete restrict,
  account_id uuid,
  customer_id uuid references auth.users(id),
  status text not null default 'pending_fulfillment' check (status in ('pending_fulfillment','active','expired','revoked','released','refunded')),
  entitlement_starts_at timestamptz,
  entitlement_expires_at timestamptz,
  customer_note text,
  admin_note text,
  assigned_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, service_id) references public.private_share_accounts(id, service_id) on delete restrict,
  constraint private_share_assignment_account_required check (account_id is not null or status in ('pending_fulfillment','released','refunded'))
);
create index if not exists private_share_assignments_account_idx on public.private_share_assignments (account_id) where status in ('active','expired','revoked');
create index if not exists private_share_assignments_customer_idx on public.private_share_assignments (customer_id);
create index if not exists private_share_assignments_status_idx on public.private_share_assignments (status, entitlement_expires_at);

-- 6. Verification requests (manual fallback first; mailbox source reserved).
create table if not exists public.private_share_verification_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.private_share_assignments(id) on delete cascade,
  customer_id uuid references auth.users(id),
  status text not null default 'requested' check (status in ('requested','in_progress','completed','failed','expired','cancelled')),
  source text not null default 'manual' check (source in ('manual','mailbox')),
  customer_visible_note text,
  note_expires_at timestamptz,
  handled_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists private_share_verification_open_uniq on public.private_share_verification_requests (assignment_id) where status in ('requested','in_progress');

-- 7. Mailbox integration structure. Inactive until consent, scopes and allowlist exist.
create table if not exists public.private_share_integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gmail','microsoft')),
  email_identity_id uuid not null references public.private_share_email_identities(id) on delete cascade,
  status text not null default 'not_configured' check (status in ('not_configured','pending_consent','active','revoked','error')),
  granted_scopes text[] not null default '{}',
  secret_ref text,
  sender_allowlist text[] not null default '{}',
  consent_recorded_at timestamptz,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, email_identity_id),
  constraint private_share_integration_enable_requires_setup check (
    not enabled or (status = 'active' and consent_recorded_at is not null and cardinality(sender_allowlist) > 0)
  )
);

-- 8. Append-only audit log.
create table if not exists public.private_share_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists private_share_audit_entity_idx on public.private_share_audit_log (entity_type, entity_id, created_at desc);

create or replace function public.private_share_block_audit_changes()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Audit log is append-only' using errcode = '42501'; end; $$;

drop trigger if exists private_share_audit_immutable on public.private_share_audit_log;
create trigger private_share_audit_immutable before update or delete on public.private_share_audit_log
  for each row execute function public.private_share_block_audit_changes();

drop trigger if exists private_share_config_service_guard on public.private_share_product_config;
create trigger private_share_config_service_guard before insert or update of service_id on public.private_share_product_config
  for each row execute function public.private_share_require_private_service();
drop trigger if exists private_share_accounts_service_guard on public.private_share_accounts;
create trigger private_share_accounts_service_guard before insert or update of service_id on public.private_share_accounts
  for each row execute function public.private_share_require_private_service();

do $$
declare t text;
begin
  foreach t in array array['private_share_product_config','private_share_email_identities','private_share_accounts','private_share_assignments','private_share_verification_requests','private_share_integration_connections'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.private_share_touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- RLS: admin read only. All writes go through the functions below; customers read via private_share_my_assignments().
do $$
declare t text;
begin
  foreach t in array array['private_share_product_config','private_share_email_identities','private_share_accounts','private_share_account_email_links','private_share_assignments','private_share_verification_requests','private_share_integration_connections','private_share_audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_wallet_admin()))', t || '_admin_read', t);
  end loop;
end $$;

create or replace function public.private_share_log(p_actor uuid, p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.private_share_audit_log (actor_id, action, entity_type, entity_id, details)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Concurrency-safe, idempotent assignment. Returns not_applicable (and writes nothing) for anything that is not an enabled private-share product.
create or replace function public.private_share_assign(p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.private_share_subscriptions;
  v_cfg public.private_share_product_config;
  v_existing public.private_share_assignments;
  v_assignment public.private_share_assignments;
  v_service_id uuid;
  v_type text;
  v_cand uuid;
  v_capacity integer;
  v_occupied integer;
  v_account_id uuid;
  v_expires timestamptz;
begin
  select * into v_sub from public.private_share_subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'Subscription not found' using errcode = 'P0002'; end if;
  if v_sub.payment_status <> 'paid' then raise exception 'Subscription is not paid' using errcode = '22023'; end if;
  if v_sub.service_id is null or v_sub.service_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('status', 'not_applicable');
  end if;
  v_service_id := v_sub.service_id::uuid;

  select service_type into v_type from public.digital_services where id = v_service_id;
  select * into v_cfg from public.private_share_product_config where service_id = v_service_id;
  if v_type is distinct from 'private_shared' or v_cfg.service_id is null or not v_cfg.enabled then
    return jsonb_build_object('status', 'not_applicable');
  end if;

  select * into v_existing from public.private_share_assignments where subscription_id = v_sub.id;
  if v_existing.id is not null and v_existing.status <> 'pending_fulfillment' then
    return jsonb_build_object('status', v_existing.status, 'assignment_id', v_existing.id, 'already_processed', true);
  end if;

  for v_cand in
    select a.id from public.private_share_accounts a
    where a.service_id = v_service_id
      and a.maintenance_status = 'active'
      and a.account_subscription_expires_at is not null
      and a.account_subscription_expires_at >= now() + make_interval(days => v_cfg.entitlement_days)
    order by a.created_at, a.id
  loop
    select a.capacity into v_capacity from public.private_share_accounts a
    where a.id = v_cand
      and a.maintenance_status = 'active'
      and a.account_subscription_expires_at >= now() + make_interval(days => v_cfg.entitlement_days)
    for update;
    if not found then continue; end if;
    select count(*) into v_occupied from public.private_share_assignments
    where account_id = v_cand and status in ('active','expired','revoked');
    if v_occupied < v_capacity then v_account_id := v_cand; exit; end if;
  end loop;

  if v_account_id is null then
    if v_existing.id is null then
      insert into public.private_share_assignments (subscription_id, service_id, customer_id, status)
      values (v_sub.id, v_service_id, v_sub.customer_id, 'pending_fulfillment')
      returning * into v_assignment;
      perform public.private_share_log(null, 'assignment_pending', 'assignment', v_assignment.id, jsonb_build_object('subscription_id', v_sub.id));
    else
      v_assignment := v_existing;
    end if;
    return jsonb_build_object('status', 'pending_fulfillment', 'assignment_id', v_assignment.id);
  end if;

  v_expires := now() + make_interval(days => v_cfg.entitlement_days);
  if v_existing.id is not null then
    update public.private_share_assignments
    set account_id = v_account_id, status = 'active', entitlement_starts_at = now(), entitlement_expires_at = v_expires, assigned_at = now()
    where id = v_existing.id returning * into v_assignment;
  else
    insert into public.private_share_assignments (subscription_id, service_id, account_id, customer_id, status, entitlement_starts_at, entitlement_expires_at, assigned_at)
    values (v_sub.id, v_service_id, v_account_id, v_sub.customer_id, 'active', now(), v_expires, now())
    returning * into v_assignment;
  end if;
  perform public.private_share_log(null, 'assignment_active', 'assignment', v_assignment.id, jsonb_build_object('account_id', v_account_id, 'expires_at', v_expires));
  return jsonb_build_object('status', 'active', 'assignment_id', v_assignment.id, 'account_id', v_account_id, 'entitlement_expires_at', v_expires);
end; $$;

-- Marks lapsed entitlements expired. Does NOT free capacity; an admin must release.
create or replace function public.private_share_expire_assignments()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  update public.private_share_assignments set status = 'expired'
  where status = 'active' and entitlement_expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

-- Admin-only: revoke an active entitlement, or release an expired/revoked one to free its capacity slot.
create or replace function public.private_share_admin_set_assignment_status(p_assignment_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.private_share_assignments;
begin
  if auth.uid() is null or not public.is_wallet_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_action = 'revoke' then
    update public.private_share_assignments set status = 'revoked', admin_note = left(coalesce(p_note, admin_note), 500)
    where id = p_assignment_id and status = 'active' returning * into v_row;
  elsif p_action = 'release' then
    update public.private_share_assignments set status = 'released', released_at = now(), admin_note = left(coalesce(p_note, admin_note), 500)
    where id = p_assignment_id and status in ('expired','revoked') returning * into v_row;
  else
    raise exception 'Invalid action' using errcode = '22023';
  end if;
  if v_row.id is null then raise exception 'Assignment is not in a state that allows this action' using errcode = '22023'; end if;
  perform public.private_share_log(auth.uid(), 'assignment_' || p_action, 'assignment', v_row.id, jsonb_build_object('note', p_note));
  return jsonb_build_object('assignment_id', v_row.id, 'status', v_row.status);
end; $$;

-- Customer view of their own entitlements. Never returns account, email or mailbox details.
create or replace function public.private_share_my_assignments()
returns table (assignment_id uuid, service_name text, status text, entitlement_starts_at timestamptz, entitlement_expires_at timestamptz, customer_note text, verification_status text, verification_note text)
language sql stable security definer set search_path = '' as $$
  select a.id, s.name, a.status, a.entitlement_starts_at, a.entitlement_expires_at, a.customer_note,
    v.status, case when v.note_expires_at is null or v.note_expires_at > now() then v.customer_visible_note end
  from public.private_share_assignments a
  join public.digital_services s on s.id = a.service_id
  left join lateral (
    select r.status, r.customer_visible_note, r.note_expires_at
    from public.private_share_verification_requests r
    where r.assignment_id = a.id order by r.requested_at desc limit 1
  ) v on true
  where auth.uid() is not null and a.customer_id = auth.uid()
  order by a.created_at desc;
$$;

revoke all on function public.private_share_touch_updated_at() from public, anon, authenticated;
revoke all on function public.private_share_require_private_service() from public, anon, authenticated;
revoke all on function public.private_share_block_audit_changes() from public, anon, authenticated;
revoke all on function public.private_share_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.private_share_assign(uuid) from public, anon, authenticated;
revoke all on function public.private_share_expire_assignments() from public, anon, authenticated;
revoke all on function public.private_share_admin_set_assignment_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.private_share_my_assignments() from public, anon;

grant execute on function public.private_share_log(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.private_share_assign(uuid) to service_role;
grant execute on function public.private_share_expire_assignments() to service_role;
grant execute on function public.private_share_admin_set_assignment_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.private_share_my_assignments() to authenticated, service_role;

comment on table public.private_share_product_config is 'Explicit per-service approval for private-share fulfilment. Disabled by default.';
comment on table public.private_share_assignments is 'Customer entitlements. active/expired/revoked rows occupy account capacity until an admin releases them.';
