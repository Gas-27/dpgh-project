-- Phase 2: admin-gated write RPCs for the private-share fulfilment tables created in Phase 1.
-- Additive only: no existing table, policy or function is altered.
-- Clients have no direct write grants on these tables; every write goes through these functions.

create or replace function public.private_share_require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_wallet_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return v_uid;
end; $$;

create or replace function public.private_share_admin_set_product(
  p_service_id uuid,
  p_enabled boolean,
  p_fulfillment_mode text default 'admin_assisted',
  p_entitlement_days integer default 30,
  p_default_capacity integer default null,
  p_requires_verification boolean default false,
  p_verification_provider text default null,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_prev boolean;
  v_row public.private_share_product_config;
begin
  if p_enabled and p_fulfillment_mode = 'supplier_api' then
    raise exception 'Supplier API fulfilment is not available yet' using errcode = '22023';
  end if;
  if p_verification_provider in ('gmail', 'microsoft') then
    raise exception 'Mailbox verification is not available yet; use manual' using errcode = '22023';
  end if;

  select enabled into v_prev from public.private_share_product_config where service_id = p_service_id;

  insert into public.private_share_product_config as c (
    service_id, enabled, fulfillment_mode, entitlement_days, default_capacity,
    requires_verification, verification_provider, approved_by, approved_at, notes
  ) values (
    p_service_id, p_enabled, p_fulfillment_mode, p_entitlement_days, p_default_capacity,
    p_requires_verification, p_verification_provider,
    case when p_enabled then v_admin end, case when p_enabled then now() end,
    left(p_notes, 1000)
  )
  on conflict (service_id) do update set
    enabled = excluded.enabled,
    fulfillment_mode = excluded.fulfillment_mode,
    entitlement_days = excluded.entitlement_days,
    default_capacity = excluded.default_capacity,
    requires_verification = excluded.requires_verification,
    verification_provider = excluded.verification_provider,
    notes = excluded.notes,
    approved_by = case when excluded.enabled and not c.enabled then v_admin else c.approved_by end,
    approved_at = case when excluded.enabled and not c.enabled then now() else c.approved_at end
  returning * into v_row;

  perform public.private_share_log(v_admin, case when p_enabled then 'product_enabled' else 'product_updated' end,
    'product', p_service_id, jsonb_build_object('was_enabled', coalesce(v_prev, false), 'enabled', p_enabled,
      'fulfillment_mode', p_fulfillment_mode, 'entitlement_days', p_entitlement_days));
  return jsonb_build_object('service_id', v_row.service_id, 'enabled', v_row.enabled);
end; $$;

create or replace function public.private_share_admin_upsert_email(
  p_id uuid, p_email text, p_provider_kind text default 'other', p_label text default null, p_active boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row public.private_share_email_identities;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.private_share_email_identities (email, provider_kind, label, active)
    values (v_email, p_provider_kind, left(p_label, 120), coalesce(p_active, true)) returning * into v_row;
  else
    update public.private_share_email_identities
    set email = v_email, provider_kind = p_provider_kind, label = left(p_label, 120), active = coalesce(p_active, true)
    where id = p_id returning * into v_row;
    if v_row.id is null then raise exception 'Email identity not found' using errcode = 'P0002'; end if;
  end if;
  perform public.private_share_log(v_admin, case when p_id is null then 'email_created' else 'email_updated' end,
    'email_identity', v_row.id, jsonb_build_object('provider_kind', v_row.provider_kind, 'active', v_row.active));
  return jsonb_build_object('id', v_row.id);
end; $$;

create or replace function public.private_share_admin_upsert_account(
  p_id uuid,
  p_service_id uuid,
  p_label text,
  p_capacity integer,
  p_capacity_basis text default null,
  p_subscription_expires_at timestamptz default null,
  p_maintenance_status text default 'active',
  p_maintenance_until timestamptz default null,
  p_supplier_ref text default null,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_row public.private_share_accounts;
  v_occupied integer;
begin
  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'Account label is required' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.private_share_accounts (service_id, label, capacity, capacity_basis, account_subscription_expires_at,
      maintenance_status, maintenance_until, supplier_ref, notes)
    values (p_service_id, left(btrim(p_label), 120), p_capacity, left(p_capacity_basis, 500), p_subscription_expires_at,
      p_maintenance_status, p_maintenance_until, left(p_supplier_ref, 120), left(p_notes, 1000))
    returning * into v_row;
  else
    perform 1 from public.private_share_accounts where id = p_id for update;
    if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
    select count(*) into v_occupied from public.private_share_assignments
    where account_id = p_id and status in ('active', 'expired', 'revoked');
    if p_capacity < v_occupied then
      raise exception 'Capacity cannot be lower than occupied seats (%)', v_occupied using errcode = '22023';
    end if;
    update public.private_share_accounts
    set label = left(btrim(p_label), 120), capacity = p_capacity, capacity_basis = left(p_capacity_basis, 500),
        account_subscription_expires_at = p_subscription_expires_at, maintenance_status = p_maintenance_status,
        maintenance_until = p_maintenance_until, supplier_ref = left(p_supplier_ref, 120), notes = left(p_notes, 1000)
    where id = p_id returning * into v_row;
  end if;
  perform public.private_share_log(v_admin, case when p_id is null then 'account_created' else 'account_updated' end,
    'account', v_row.id, jsonb_build_object('capacity', v_row.capacity, 'maintenance_status', v_row.maintenance_status,
      'subscription_expires_at', v_row.account_subscription_expires_at));
  return jsonb_build_object('id', v_row.id);
end; $$;

create or replace function public.private_share_admin_link_email(p_account_id uuid, p_email_identity_id uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_id uuid;
begin
  insert into public.private_share_account_email_links (account_id, email_identity_id, role)
  values (p_account_id, p_email_identity_id, p_role)
  on conflict (account_id, email_identity_id, role) do nothing
  returning id into v_id;
  if v_id is not null then
    perform public.private_share_log(v_admin, 'email_linked', 'account', p_account_id,
      jsonb_build_object('email_identity_id', p_email_identity_id, 'role', p_role));
  end if;
  return jsonb_build_object('id', v_id, 'created', v_id is not null);
end; $$;

create or replace function public.private_share_admin_unlink_email(p_link_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_row public.private_share_account_email_links;
begin
  delete from public.private_share_account_email_links where id = p_link_id returning * into v_row;
  if v_row.id is null then raise exception 'Link not found' using errcode = 'P0002'; end if;
  perform public.private_share_log(v_admin, 'email_unlinked', 'account', v_row.account_id,
    jsonb_build_object('email_identity_id', v_row.email_identity_id, 'role', v_row.role));
  return jsonb_build_object('id', v_row.id);
end; $$;

create or replace function public.private_share_admin_set_customer_note(p_assignment_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_row public.private_share_assignments;
begin
  update public.private_share_assignments set customer_note = nullif(left(btrim(coalesce(p_note, '')), 1000), '')
  where id = p_assignment_id returning * into v_row;
  if v_row.id is null then raise exception 'Assignment not found' using errcode = 'P0002'; end if;
  perform public.private_share_log(v_admin, 'customer_note_set', 'assignment', v_row.id, '{}'::jsonb);
  return jsonb_build_object('id', v_row.id);
end; $$;

create or replace function public.private_share_admin_update_verification(
  p_request_id uuid, p_status text, p_note text default null, p_note_expires_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_row public.private_share_verification_requests;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_expires timestamptz;
begin
  if p_status not in ('in_progress', 'completed', 'failed', 'cancelled') then
    raise exception 'Invalid verification status' using errcode = '22023';
  end if;
  v_expires := case when v_note is null then null
    else least(coalesce(p_note_expires_at, now() + interval '1 hour'), now() + interval '24 hours') end;
  update public.private_share_verification_requests
  set status = p_status, customer_visible_note = v_note, note_expires_at = v_expires, handled_by = v_admin,
      completed_at = case when p_status = 'in_progress' then null else now() end
  where id = p_request_id returning * into v_row;
  if v_row.id is null then raise exception 'Verification request not found' using errcode = 'P0002'; end if;
  perform public.private_share_log(v_admin, 'verification_' || p_status, 'verification_request', v_row.id,
    jsonb_build_object('source', v_row.source, 'note_provided', v_note is not null));
  return jsonb_build_object('id', v_row.id, 'status', v_row.status);
end; $$;

create or replace function public.private_share_admin_set_integration_config(
  p_email_identity_id uuid, p_provider text, p_sender_allowlist text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_list text[];
  v_row public.private_share_integration_connections;
begin
  select coalesce(array_agg(distinct lower(btrim(x))), '{}') into v_list
  from unnest(coalesce(p_sender_allowlist, '{}')) x where btrim(x) <> '' and length(x) <= 254;
  if cardinality(v_list) > 20 then
    raise exception 'At most 20 allowed senders' using errcode = '22023';
  end if;
  insert into public.private_share_integration_connections (provider, email_identity_id, sender_allowlist)
  values (p_provider, p_email_identity_id, v_list)
  on conflict (provider, email_identity_id) do update set sender_allowlist = excluded.sender_allowlist
  returning * into v_row;
  perform public.private_share_log(v_admin, 'integration_config_saved', 'integration', v_row.id,
    jsonb_build_object('provider', p_provider, 'allowed_senders', cardinality(v_list), 'enabled', v_row.enabled));
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'enabled', v_row.enabled);
end; $$;

revoke all on function public.private_share_require_admin() from public, anon, authenticated;
revoke all on function public.private_share_admin_set_product(uuid, boolean, text, integer, integer, boolean, text, text) from public, anon, authenticated;
revoke all on function public.private_share_admin_upsert_email(uuid, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.private_share_admin_upsert_account(uuid, uuid, text, integer, text, timestamptz, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.private_share_admin_link_email(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.private_share_admin_unlink_email(uuid) from public, anon, authenticated;
revoke all on function public.private_share_admin_set_customer_note(uuid, text) from public, anon, authenticated;
revoke all on function public.private_share_admin_update_verification(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.private_share_admin_set_integration_config(uuid, text, text[]) from public, anon, authenticated;

grant execute on function public.private_share_admin_set_product(uuid, boolean, text, integer, integer, boolean, text, text) to authenticated, service_role;
grant execute on function public.private_share_admin_upsert_email(uuid, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.private_share_admin_upsert_account(uuid, uuid, text, integer, text, timestamptz, text, timestamptz, text, text) to authenticated, service_role;
grant execute on function public.private_share_admin_link_email(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.private_share_admin_unlink_email(uuid) to authenticated, service_role;
grant execute on function public.private_share_admin_set_customer_note(uuid, text) to authenticated, service_role;
grant execute on function public.private_share_admin_update_verification(uuid, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.private_share_admin_set_integration_config(uuid, text, text[]) to authenticated, service_role;
