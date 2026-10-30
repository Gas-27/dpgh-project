-- Guest-safe verification code flow. Storefront checkout has no customer account, so access is proven by the
-- Paystack payment reference. These functions are callable only by the service role (via /api/private-share/code).

create or replace function public.private_share_guest_request_code(p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_asg public.private_share_assignments;
  v_req public.private_share_verification_requests;
  v_recent integer;
begin
  select a.* into v_asg
  from public.private_share_assignments a
  join public.private_share_subscriptions s on s.id = a.subscription_id
  where s.payment_reference = p_reference and s.payment_status = 'paid'
  order by a.created_at desc limit 1;
  if not found or v_asg.status <> 'active' or v_asg.entitlement_expires_at <= now() then
    raise exception 'No active access for this subscription' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.private_share_account_email_links l
    join public.private_share_email_identities e on e.id = l.email_identity_id and e.active
    where l.account_id = v_asg.account_id and l.role = 'verification'
  ) then raise exception 'Verification email is not configured for this account' using errcode = '22023'; end if;

  update public.private_share_verification_requests set status = 'expired'
    where assignment_id = v_asg.id and status in ('requested','in_progress') and requested_at < now() - interval '10 minutes';
  select * into v_req from public.private_share_verification_requests
    where assignment_id = v_asg.id and status in ('requested','in_progress') order by requested_at desc limit 1;
  if v_req.id is null then
    select count(*) into v_recent from public.private_share_verification_requests
      where assignment_id = v_asg.id and requested_at > now() - interval '1 hour';
    if v_recent >= 20 then raise exception 'Too many code requests. Please try again later.' using errcode = '54000'; end if;
    insert into public.private_share_verification_requests (assignment_id, customer_id, status, source)
      values (v_asg.id, null, 'requested', 'mailbox') returning * into v_req;
    insert into public.private_share_verification_request_events (request_id, actor_id, event_type)
      values (v_req.id, null, 'requested');
  end if;
  return jsonb_build_object('status', 'pending', 'request_id', v_req.id, 'requested_at', v_req.requested_at,
    'expires_at', v_req.requested_at + interval '10 minutes');
end; $$;

create or replace function public.private_share_guest_poll_code(p_request_id uuid, p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_req public.private_share_verification_requests;
  v_asg public.private_share_assignments;
  v_code text; v_expires timestamptz;
begin
  select r.* into v_req
  from public.private_share_verification_requests r
  join public.private_share_assignments a on a.id = r.assignment_id
  join public.private_share_subscriptions s on s.id = a.subscription_id
  where r.id = p_request_id and s.payment_reference = p_reference;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into v_asg from public.private_share_assignments where id = v_req.assignment_id;
  if v_asg.status <> 'active' or v_asg.entitlement_expires_at <= now() then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select c.code, c.expires_at into v_code, v_expires
  from public.private_share_verification_codes c
  join public.private_share_account_email_links l on l.email_identity_id = c.email_identity_id
    and l.account_id = v_asg.account_id and l.role = 'verification'
  where c.expires_at > now() and c.received_at >= v_req.requested_at - interval '10 minutes'
  order by c.received_at desc limit 1;

  if v_code is not null then
    if v_req.status in ('requested','in_progress') then
      update public.private_share_verification_requests set status = 'completed', customer_visible_note = v_code,
        note_expires_at = v_expires, completed_at = now() where id = v_req.id;
      insert into public.private_share_verification_request_events (request_id, actor_id, event_type)
        values (v_req.id, null, 'code_delivered');
    end if;
    return jsonb_build_object('status', 'ready', 'code', v_code, 'expires_at', v_expires);
  end if;

  if v_req.status not in ('requested','in_progress') or v_req.requested_at < now() - interval '10 minutes' then
    if v_req.status in ('requested','in_progress') then
      update public.private_share_verification_requests set status = 'expired' where id = v_req.id;
    end if;
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object('status', 'waiting', 'expires_at', v_req.requested_at + interval '10 minutes');
end; $$;

revoke all on function public.private_share_guest_request_code(text) from public, anon, authenticated;
grant execute on function public.private_share_guest_request_code(text) to service_role;
revoke all on function public.private_share_guest_poll_code(uuid, text) from public, anon, authenticated;
grant execute on function public.private_share_guest_poll_code(uuid, text) to service_role;
