-- Treat a null account expiry as no expiry. Such accounts must still provide usable capacity.
create or replace function public.private_share_has_available_seat(p_service_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.private_share_accounts a
    where a.service_id = p_service_id
      and a.maintenance_status = 'active'
      and (a.account_subscription_expires_at is null or a.account_subscription_expires_at > now())
      and (
        select count(*)
        from public.private_share_assignments assignment
        where assignment.account_id = a.id
          and assignment.status in ('active', 'pending_fulfillment')
      ) < a.capacity
  );
$$;

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
  if v_sub.service_id is null or v_sub.service_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('status', 'not_applicable'); end if;
  v_service_id := v_sub.service_id::uuid;
  select service_type into v_type from public.digital_services where id = v_service_id;
  select * into v_cfg from public.private_share_product_config where service_id = v_service_id;
  if v_type is distinct from 'private_shared' or v_cfg.service_id is null or not v_cfg.enabled then return jsonb_build_object('status', 'not_applicable'); end if;
  select * into v_existing from public.private_share_assignments where subscription_id = v_sub.id;
  if v_existing.id is not null and v_existing.status <> 'pending_fulfillment' then return jsonb_build_object('status', v_existing.status, 'assignment_id', v_existing.id, 'already_processed', true); end if;
  for v_cand in select a.id from public.private_share_accounts a where a.service_id = v_service_id and a.maintenance_status = 'active' and (a.account_subscription_expires_at is null or a.account_subscription_expires_at >= now() + make_interval(days => v_cfg.entitlement_days)) order by a.created_at, a.id loop
    select a.capacity into v_capacity from public.private_share_accounts a where a.id = v_cand and a.maintenance_status = 'active' and (a.account_subscription_expires_at is null or a.account_subscription_expires_at >= now() + make_interval(days => v_cfg.entitlement_days)) for update;
    if not found then continue; end if;
    select count(*) into v_occupied from public.private_share_assignments where account_id = v_cand and status in ('active','pending_fulfillment');
    if v_occupied < v_capacity then v_account_id := v_cand; exit; end if;
  end loop;
  if v_account_id is null then
    if v_existing.id is null then insert into public.private_share_assignments (subscription_id, service_id, customer_id, status) values (v_sub.id, v_service_id, v_sub.customer_id, 'pending_fulfillment') returning * into v_assignment; else v_assignment := v_existing; end if;
    return jsonb_build_object('status', 'pending_fulfillment', 'assignment_id', v_assignment.id);
  end if;
  v_expires := now() + make_interval(days => v_cfg.entitlement_days);
  if v_existing.id is not null then update public.private_share_assignments set account_id = v_account_id, status = 'active', entitlement_starts_at = now(), entitlement_expires_at = v_expires, assigned_at = now() where id = v_existing.id returning * into v_assignment; else insert into public.private_share_assignments (subscription_id, service_id, account_id, customer_id, status, entitlement_starts_at, entitlement_expires_at, assigned_at) values (v_sub.id, v_service_id, v_account_id, v_sub.customer_id, 'active', now(), v_expires, now()) returning * into v_assignment; end if;
  perform public.private_share_log(null, 'assignment_active', 'assignment', v_assignment.id, jsonb_build_object('account_id', v_account_id, 'expires_at', v_expires));
  return jsonb_build_object('status', 'active', 'assignment_id', v_assignment.id, 'account_id', v_account_id, 'entitlement_expires_at', v_expires);
end; $$;
