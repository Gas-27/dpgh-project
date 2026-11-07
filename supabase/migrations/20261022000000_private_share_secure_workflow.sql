-- Secure, additive private-share workflow extensions.
-- Reuses existing private-share tables and keeps provider secrets out of public columns.

alter table public.private_share_accounts
  add column if not exists login_identifier text,
  add column if not exists customer_instructions text,
  add column if not exists credentials_secret_ref text,
  add column if not exists verification_required boolean not null default false;

create index if not exists private_share_assignments_customer_active_idx
  on public.private_share_assignments (customer_id, status, entitlement_expires_at);

create table if not exists public.private_share_verification_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.private_share_verification_requests(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists private_share_verification_events_request_idx
  on public.private_share_verification_request_events (request_id, created_at desc);
alter table public.private_share_verification_request_events enable row level security;
revoke all on public.private_share_verification_request_events from public, anon, authenticated;
grant select on public.private_share_verification_request_events to authenticated;
drop policy if exists private_share_verification_events_admin_read on public.private_share_verification_request_events;
create policy private_share_verification_events_admin_read on public.private_share_verification_request_events
  for select to authenticated using ((select public.is_wallet_admin()));

drop function if exists public.private_share_my_assignments();

create or replace function public.private_share_my_assignments()
returns table (
  assignment_id uuid,
  service_name text,
  status text,
  entitlement_starts_at timestamptz,
  entitlement_expires_at timestamptz,
  customer_note text,
  login_identifier text,
  customer_instructions text,
  verification_required boolean,
  verification_status text,
  verification_note text
)
language sql stable security definer set search_path = '' as $$
  select a.id, s.name, a.status, a.entitlement_starts_at, a.entitlement_expires_at,
    a.customer_note, ac.login_identifier, ac.customer_instructions,
    (coalesce(ac.verification_required, false) or coalesce(cfg.requires_verification, false)),
    v.status, case when v.note_expires_at is null or v.note_expires_at > now() then v.customer_visible_note end
  from public.private_share_assignments a
  join public.digital_services s on s.id = a.service_id
  left join public.private_share_accounts ac on ac.id = a.account_id
  left join public.private_share_product_config cfg on cfg.service_id = a.service_id
  left join lateral (
    select r.status, r.customer_visible_note, r.note_expires_at
    from public.private_share_verification_requests r
    where r.assignment_id = a.id order by r.requested_at desc limit 1
  ) v on true
  where auth.uid() is not null and a.customer_id = auth.uid()
  order by a.created_at desc;
$$;

create or replace function public.private_share_customer_request_code(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_asg public.private_share_assignments;
  v_req public.private_share_verification_requests;
  v_required boolean;
  v_recent integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_asg from public.private_share_assignments where id = p_assignment_id and customer_id = v_uid;
  if not found or v_asg.status <> 'active' or v_asg.entitlement_expires_at <= now() then
    raise exception 'No active access for this subscription' using errcode = '22023';
  end if;
  select coalesce(ac.verification_required, false) or coalesce(cfg.requires_verification, false)
    into v_required
  from public.private_share_accounts ac
  left join public.private_share_product_config cfg on cfg.service_id = ac.service_id
  where ac.id = v_asg.account_id;
  if not coalesce(v_required, false) then return jsonb_build_object('status', 'not_required'); end if;
  if not exists (
    select 1 from public.private_share_account_email_links l
    join public.private_share_email_identities e on e.id = l.email_identity_id and e.active
    where l.account_id = v_asg.account_id and l.role = 'verification'
  ) then raise exception 'Verification email is not configured for this account' using errcode = '22023'; end if;
  update public.private_share_verification_requests set status = 'expired'
    where assignment_id = p_assignment_id and status in ('requested','in_progress') and requested_at < now() - interval '10 minutes';
  select * into v_req from public.private_share_verification_requests
    where assignment_id = p_assignment_id and status in ('requested','in_progress') order by requested_at desc limit 1;
  if v_req.id is null then
    select count(*) into v_recent from public.private_share_verification_requests
      where assignment_id = p_assignment_id and source = 'mailbox' and requested_at > now() - interval '1 hour';
    if v_recent >= 8 then raise exception 'Too many code requests. Please try again later.' using errcode = '54000'; end if;
    insert into public.private_share_verification_requests (assignment_id, customer_id, status, source)
      values (p_assignment_id, v_uid, 'requested', 'mailbox') returning * into v_req;
    insert into public.private_share_verification_request_events (request_id, actor_id, event_type)
      values (v_req.id, v_uid, 'requested');
  end if;
  return jsonb_build_object('status', 'pending', 'request_id', v_req.id, 'requested_at', v_req.requested_at,
    'expires_at', v_req.requested_at + interval '10 minutes');
end; $$;

create or replace function public.private_share_customer_poll_code(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_req public.private_share_verification_requests; v_asg public.private_share_assignments;
  v_code text; v_expires timestamptz; v_matches integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_req from public.private_share_verification_requests where id = p_request_id and customer_id = v_uid;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into v_asg from public.private_share_assignments where id = v_req.assignment_id;
  if v_asg.status <> 'active' or v_asg.entitlement_expires_at <= now() then return jsonb_build_object('status', 'unavailable'); end if;
  if v_req.status = 'completed' and v_req.customer_visible_note ~ '^[0-9]{4,8}$' and v_req.note_expires_at > now() then
    return jsonb_build_object('status', 'ready', 'code', v_req.customer_visible_note, 'expires_at', v_req.note_expires_at);
  end if;
  if v_req.status not in ('requested','in_progress') then return jsonb_build_object('status', 'expired'); end if;
  if v_req.requested_at < now() - interval '10 minutes' then
    update public.private_share_verification_requests set status = 'expired' where id = v_req.id;
    insert into public.private_share_verification_request_events (request_id, actor_id, event_type) values (v_req.id, v_uid, 'expired');
    return jsonb_build_object('status', 'expired');
  end if;
  select count(*) into v_matches
  from public.private_share_verification_codes c
  join public.private_share_account_email_links l on l.email_identity_id = c.email_identity_id
    and l.account_id = v_asg.account_id and l.role = 'verification'
  where c.expires_at > now() and c.received_at >= v_req.requested_at - interval '30 seconds';
  if v_matches > 1 then
    update public.private_share_verification_requests set status = 'failed', customer_visible_note = 'Administrator review required'
      where id = v_req.id;
    insert into public.private_share_verification_request_events (request_id, actor_id, event_type, details)
      values (v_req.id, null, 'ambiguous_match', jsonb_build_object('matches', v_matches));
    return jsonb_build_object('status', 'awaiting_administrator');
  end if;
  select c.code, c.expires_at into v_code, v_expires
  from public.private_share_verification_codes c
  join public.private_share_account_email_links l on l.email_identity_id = c.email_identity_id
    and l.account_id = v_asg.account_id and l.role = 'verification'
  where c.expires_at > now() and c.received_at >= v_req.requested_at - interval '30 seconds'
  order by c.received_at desc limit 1;
  if v_code is not null then
    update public.private_share_verification_requests set status = 'completed', customer_visible_note = v_code,
      note_expires_at = v_expires, completed_at = now() where id = v_req.id;
    insert into public.private_share_verification_request_events (request_id, actor_id, event_type) values (v_req.id, v_uid, 'code_delivered');
    return jsonb_build_object('status', 'ready', 'code', v_code, 'expires_at', v_expires);
  end if;
  return jsonb_build_object('status', 'waiting', 'expires_at', v_req.requested_at + interval '10 minutes');
end; $$;

revoke all on function public.private_share_my_assignments() from public, anon;
grant execute on function public.private_share_my_assignments() to authenticated, service_role;
revoke all on function public.private_share_customer_request_code(uuid) from public, anon;
grant execute on function public.private_share_customer_request_code(uuid) to authenticated, service_role;
revoke all on function public.private_share_customer_poll_code(uuid) from public, anon;
grant execute on function public.private_share_customer_poll_code(uuid) to authenticated, service_role;
