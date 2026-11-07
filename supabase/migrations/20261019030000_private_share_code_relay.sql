-- Private-share verification-code relay.
-- Forwarded verification emails are parsed by an Edge Function, stored briefly, and shown to the
-- customer who holds an active seat on the account, only after they ask for a code.
-- Additive only: new tables and functions, no existing table, policy or function is altered.

create table if not exists public.private_share_code_senders (
  domain text primary key check (domain = lower(btrim(domain)) and domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$'),
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.private_share_code_senders (domain, label) values
  ('netflix.com', 'Netflix'),
  ('disneyplus.com', 'Disney+'),
  ('spotify.com', 'Spotify'),
  ('primevideo.com', 'Prime Video'),
  ('amazon.com', 'Amazon'),
  ('max.com', 'Max'),
  ('hbomax.com', 'HBO Max')
on conflict (domain) do nothing;

create table if not exists public.private_share_inbound_settings (
  id boolean primary key default true check (id),
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  rotated_at timestamptz not null default now()
);
insert into public.private_share_inbound_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.private_share_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email_identity_id uuid not null references public.private_share_email_identities(id) on delete cascade,
  sender_domain text not null,
  code text not null check (code ~ '^[0-9]{4,8}$'),
  received_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email_identity_id, code, received_at)
);
create index if not exists private_share_codes_lookup_idx on public.private_share_verification_codes (email_identity_id, received_at desc);

alter table public.private_share_code_senders enable row level security;
alter table public.private_share_inbound_settings enable row level security;
alter table public.private_share_verification_codes enable row level security;

revoke all on public.private_share_code_senders from public, anon, authenticated;
revoke all on public.private_share_inbound_settings from public, anon, authenticated;
revoke all on public.private_share_verification_codes from public, anon, authenticated;
grant select on public.private_share_code_senders to authenticated;
grant select, insert, update, delete on public.private_share_code_senders, public.private_share_inbound_settings, public.private_share_verification_codes to service_role;

drop policy if exists private_share_code_senders_admin_read on public.private_share_code_senders;
create policy private_share_code_senders_admin_read on public.private_share_code_senders
  for select to authenticated using ((select public.is_wallet_admin()));

-- Called only by the inbound-email Edge Function (service role). Stores a code when the mailbox is known and the sender is allowlisted.
create or replace function public.private_share_ingest_code(p_mailbox text, p_sender text, p_code text, p_received_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_mailbox, '')));
  v_identity uuid;
  v_domain text;
  v_allowed boolean;
  v_received timestamptz;
begin
  if p_code is null or p_code !~ '^[0-9]{4,8}$' then
    return jsonb_build_object('stored', false, 'reason', 'invalid_code');
  end if;

  select id into v_identity from public.private_share_email_identities where email = v_email and active;
  if v_identity is null then
    return jsonb_build_object('stored', false, 'reason', 'unknown_mailbox');
  end if;

  v_domain := lower(substring(coalesce(p_sender, '') from '@([A-Za-z0-9.-]+)'));
  if v_domain is null then
    return jsonb_build_object('stored', false, 'reason', 'sender_not_allowed');
  end if;
  select exists (
    select 1 from public.private_share_code_senders s
    where s.active and (v_domain = s.domain or right(v_domain, length(s.domain) + 1) = '.' || s.domain)
  ) into v_allowed;
  if not v_allowed then
    return jsonb_build_object('stored', false, 'reason', 'sender_not_allowed');
  end if;

  v_received := least(coalesce(p_received_at, now()), now());
  if v_received < now() - interval '15 minutes' then
    return jsonb_build_object('stored', false, 'reason', 'too_old');
  end if;

  insert into public.private_share_verification_codes (email_identity_id, sender_domain, code, received_at, expires_at)
  values (v_identity, v_domain, p_code, v_received, v_received + interval '15 minutes')
  on conflict (email_identity_id, code, received_at) do nothing;

  delete from public.private_share_verification_codes where received_at < now() - interval '1 day';

  perform public.private_share_log(null, 'code_received', 'email_identity', v_identity, jsonb_build_object('sender_domain', v_domain));
  return jsonb_build_object('stored', true);
end; $$;

-- Admin: webhook secret and sender allowlist.
create or replace function public.private_share_admin_get_inbound_settings()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.private_share_inbound_settings;
begin
  perform public.private_share_require_admin();
  select * into v_row from public.private_share_inbound_settings where id = true;
  return jsonb_build_object('secret', v_row.secret, 'rotated_at', v_row.rotated_at);
end; $$;

create or replace function public.private_share_admin_rotate_inbound_secret()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_row public.private_share_inbound_settings;
begin
  update public.private_share_inbound_settings
  set secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), rotated_at = now()
  where id = true returning * into v_row;
  perform public.private_share_log(v_admin, 'inbound_secret_rotated', 'integration', null, '{}'::jsonb);
  return jsonb_build_object('secret', v_row.secret, 'rotated_at', v_row.rotated_at);
end; $$;

create or replace function public.private_share_admin_set_code_sender(p_domain text, p_active boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_domain text := lower(btrim(coalesce(p_domain, '')));
begin
  if v_domain !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' then
    raise exception 'Enter a sender domain such as netflix.com' using errcode = '22023';
  end if;
  insert into public.private_share_code_senders (domain, active) values (v_domain, coalesce(p_active, true))
  on conflict (domain) do update set active = excluded.active;
  perform public.private_share_log(v_admin, 'code_sender_saved', 'integration', null, jsonb_build_object('domain', v_domain, 'active', coalesce(p_active, true)));
  return jsonb_build_object('domain', v_domain, 'active', coalesce(p_active, true));
end; $$;

-- Customer: which of my active assignments can show automatic codes.
create or replace function public.private_share_my_code_enabled()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select a.id
  from public.private_share_assignments a
  join public.private_share_accounts ac on ac.id = a.account_id
  where auth.uid() is not null
    and a.customer_id = auth.uid()
    and a.status = 'active'
    and a.entitlement_expires_at > now()
    and ac.maintenance_status = 'active'
    and exists (
      select 1 from public.private_share_account_email_links l
      join public.private_share_email_identities e on e.id = l.email_identity_id
      where l.account_id = ac.id and l.role = 'verification' and e.active
    );
$$;

-- Customer: start a code request. A code is only shown if it arrives after this request.
create or replace function public.private_share_customer_request_code(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_asg public.private_share_assignments;
  v_req public.private_share_verification_requests;
  v_recent integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into v_asg from public.private_share_assignments where id = p_assignment_id and customer_id = v_uid;
  if not found or v_asg.status <> 'active' or v_asg.entitlement_expires_at <= now() then
    raise exception 'No active access for this subscription' using errcode = '22023';
  end if;
  if not exists (select 1 from public.private_share_my_code_enabled() x where x = p_assignment_id) then
    raise exception 'Automatic codes are not set up for this account yet. Please contact support.' using errcode = '22023';
  end if;

  update public.private_share_verification_requests set status = 'expired'
  where assignment_id = p_assignment_id and status in ('requested', 'in_progress') and requested_at < now() - interval '10 minutes';

  select * into v_req from public.private_share_verification_requests
  where assignment_id = p_assignment_id and status in ('requested', 'in_progress')
  order by requested_at desc limit 1;

  if v_req.id is null then
    select count(*) into v_recent from public.private_share_verification_requests
    where assignment_id = p_assignment_id and source = 'mailbox' and requested_at > now() - interval '1 hour';
    if v_recent >= 8 then
      raise exception 'Too many code requests. Please try again later.' using errcode = '54000';
    end if;
    insert into public.private_share_verification_requests (assignment_id, customer_id, status, source)
    values (p_assignment_id, v_uid, 'requested', 'mailbox') returning * into v_req;
    perform public.private_share_log(v_uid, 'code_requested', 'assignment', p_assignment_id, '{}'::jsonb);
  end if;

  return jsonb_build_object('request_id', v_req.id, 'requested_at', v_req.requested_at, 'expires_at', v_req.requested_at + interval '10 minutes');
end; $$;

-- Customer: check whether a code has arrived for my request.
create or replace function public.private_share_customer_poll_code(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_req public.private_share_verification_requests;
  v_asg public.private_share_assignments;
  v_code text;
  v_expires timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into v_req from public.private_share_verification_requests where id = p_request_id and customer_id = v_uid;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;

  select * into v_asg from public.private_share_assignments where id = v_req.assignment_id;
  if v_asg.status <> 'active' or v_asg.entitlement_expires_at <= now() then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_req.status = 'completed' and v_req.customer_visible_note ~ '^[0-9]{4,8}$' and v_req.note_expires_at > now() then
    return jsonb_build_object('status', 'ready', 'code', v_req.customer_visible_note, 'expires_at', v_req.note_expires_at);
  end if;
  if v_req.status not in ('requested', 'in_progress') then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_req.requested_at < now() - interval '10 minutes' then
    update public.private_share_verification_requests set status = 'expired' where id = v_req.id;
    return jsonb_build_object('status', 'expired');
  end if;

  select c.code, c.expires_at into v_code, v_expires
  from public.private_share_verification_codes c
  join public.private_share_account_email_links l
    on l.email_identity_id = c.email_identity_id and l.account_id = v_asg.account_id and l.role = 'verification'
  where c.expires_at > now() and c.received_at >= v_req.requested_at - interval '30 seconds'
  order by c.received_at desc limit 1;

  if v_code is not null then
    update public.private_share_verification_requests
    set status = 'completed', customer_visible_note = v_code, note_expires_at = v_expires, completed_at = now()
    where id = v_req.id;
    perform public.private_share_log(v_uid, 'code_delivered', 'assignment', v_asg.id, '{}'::jsonb);
    return jsonb_build_object('status', 'ready', 'code', v_code, 'expires_at', v_expires);
  end if;

  return jsonb_build_object('status', 'waiting', 'expires_at', v_req.requested_at + interval '10 minutes');
end; $$;

revoke all on function public.private_share_ingest_code(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.private_share_admin_get_inbound_settings() from public, anon, authenticated;
revoke all on function public.private_share_admin_rotate_inbound_secret() from public, anon, authenticated;
revoke all on function public.private_share_admin_set_code_sender(text, boolean) from public, anon, authenticated;
revoke all on function public.private_share_my_code_enabled() from public, anon, authenticated;
revoke all on function public.private_share_customer_request_code(uuid) from public, anon, authenticated;
revoke all on function public.private_share_customer_poll_code(uuid) from public, anon, authenticated;

grant execute on function public.private_share_ingest_code(text, text, text, timestamptz) to service_role;
grant execute on function public.private_share_admin_get_inbound_settings() to authenticated, service_role;
grant execute on function public.private_share_admin_rotate_inbound_secret() to authenticated, service_role;
grant execute on function public.private_share_admin_set_code_sender(text, boolean) to authenticated, service_role;
grant execute on function public.private_share_my_code_enabled() to authenticated, service_role;
grant execute on function public.private_share_customer_request_code(uuid) to authenticated, service_role;
grant execute on function public.private_share_customer_poll_code(uuid) to authenticated, service_role;
