alter table public.private_share_product_config drop constraint if exists private_share_product_config_verification_provider_check;
alter table public.private_share_product_config add constraint private_share_product_config_verification_provider_check check (verification_provider is null or verification_provider in ('forwarding','manual','gmail','microsoft'));

alter table public.private_share_integration_connections drop constraint if exists private_share_integration_connections_provider_check;
alter table public.private_share_integration_connections add constraint private_share_integration_connections_provider_check check (provider in ('forwarding','gmail','microsoft'));

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
  if p_verification_provider not in ('forwarding', 'manual') and p_verification_provider is not null then
    raise exception 'Use the universal forwarding relay or manual verification' using errcode = '22023';
  end if;
  if p_requires_verification and p_verification_provider is null then
    raise exception 'A verification method is required' using errcode = '22023';
  end if;
  select enabled into v_prev from public.private_share_product_config where service_id = p_service_id;
  insert into public.private_share_product_config (
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
    approved_by = case when excluded.enabled and not public.private_share_product_config.enabled then v_admin else public.private_share_product_config.approved_by end,
    approved_at = case when excluded.enabled and not public.private_share_product_config.enabled then now() else public.private_share_product_config.approved_at end
  returning * into v_row;
  perform public.private_share_log(v_admin, case when p_enabled then 'product_enabled' else 'product_updated' end,
    'product', p_service_id, jsonb_build_object('was_enabled', coalesce(v_prev, false), 'enabled', p_enabled,
      'fulfillment_mode', p_fulfillment_mode, 'entitlement_days', p_entitlement_days, 'verification_provider', p_verification_provider));
  return jsonb_build_object('service_id', v_row.service_id, 'enabled', v_row.enabled);
end; $$;

create or replace function public.private_share_admin_set_integration_config(
  p_email_identity_id uuid, p_provider text, p_sender_allowlist text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_list text[];
  v_row public.private_share_integration_connections;
begin
  if p_provider not in ('forwarding', 'gmail', 'microsoft') then
    raise exception 'Unsupported email provider' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct lower(btrim(x))), '{}') into v_list
  from unnest(coalesce(p_sender_allowlist, '{}')) x where btrim(x) <> '' and length(x) <= 254;
  if cardinality(v_list) > 20 then raise exception 'At most 20 allowed senders' using errcode = '22023'; end if;
  insert into public.private_share_integration_connections (provider, email_identity_id, sender_allowlist)
  values (p_provider, p_email_identity_id, v_list)
  on conflict (provider, email_identity_id) do update set sender_allowlist = excluded.sender_allowlist
  returning * into v_row;
  perform public.private_share_log(v_admin, 'integration_config_saved', 'integration', v_row.id,
    jsonb_build_object('provider', p_provider, 'allowed_senders', cardinality(v_list), 'enabled', v_row.enabled));
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'enabled', v_row.enabled);
end; $$;

revoke all on function public.private_share_admin_set_product(uuid, boolean, text, integer, integer, boolean, text, text) from public, anon, authenticated;
grant execute on function public.private_share_admin_set_product(uuid, boolean, text, integer, integer, boolean, text, text) to authenticated, service_role;
revoke all on function public.private_share_admin_set_integration_config(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.private_share_admin_set_integration_config(uuid, text, text[]) to authenticated, service_role;
