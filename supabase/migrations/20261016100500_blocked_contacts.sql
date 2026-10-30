-- Blocked contacts: add a phone number to public.blocked_contacts (Supabase Table Editor > Insert row)
-- and that number can no longer buy anything (data, airtime, cheap data, AFA, services, store products,
-- top-ups, API purchases), register, or be saved on a profile. Enforced in the database so no edge
-- function, dashboard or API route can bypass it. Existing accounts using the number are banned from
-- logging in and their wallets are put on hold.

create or replace function public.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 9 then null
    else right(regexp_replace(p_phone, '\D', '', 'g'), 9)
  end
$$;

create table if not exists public.blocked_contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  phone_key text not null,
  reason text,
  active boolean not null default true,
  blocked_at timestamptz not null default now(),
  blocked_by uuid default auth.uid()
);

create unique index if not exists blocked_contacts_phone_key_uq on public.blocked_contacts (phone_key);

alter table public.blocked_contacts enable row level security;
revoke all on public.blocked_contacts from anon, authenticated;
grant select, insert, update, delete on public.blocked_contacts to authenticated;

drop policy if exists blocked_contacts_admin_all on public.blocked_contacts;
create policy blocked_contacts_admin_all on public.blocked_contacts
  for all to authenticated
  using (public.is_wallet_admin())
  with check (public.is_wallet_admin());

create or replace function public.is_phone_blocked(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocked_contacts b
    where b.active and b.phone_key = public.phone_key(p_phone)
  )
$$;

revoke all on function public.is_phone_blocked(text) from public, anon, authenticated;
grant execute on function public.is_phone_blocked(text) to service_role;

-- Ban logins and hold wallets for existing accounts that use a blocked number.
create or replace function public.apply_contact_block(p_key text, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_ids uuid[];
begin
  select coalesce(array_agg(distinct uid), '{}') into v_user_ids from (
    select p.id as uid from public.profiles p where public.phone_key(p.phone) = p_key
    union select c.user_id from public.customers c where public.phone_key(c.phone_number) = p_key and c.user_id is not null
    union select a.user_id from public.agent_stores a where public.phone_key(a.phone_number) = p_key and a.user_id is not null
  ) s;

  if array_length(v_user_ids, 1) is not null then
    update auth.users set banned_until = '2999-12-31'::timestamptz where id = any(v_user_ids);
    delete from auth.sessions where user_id = any(v_user_ids);
  end if;

  insert into public.wallet_holds (owner_type, owner_id, user_id, reason)
  select 'customer', c.id, c.user_id, 'Blocked contact ' || p_phone
  from public.customers c where public.phone_key(c.phone_number) = p_key
  on conflict do nothing;

  insert into public.wallet_holds (owner_type, owner_id, user_id, reason)
  select 'agent', a.id, a.user_id, 'Blocked contact ' || p_phone
  from public.agent_stores a where public.phone_key(a.phone_number) = p_key
  on conflict do nothing;
end;
$$;

revoke all on function public.apply_contact_block(text, text) from public, anon, authenticated;

create or replace function public.blocked_contacts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.phone_key := public.phone_key(new.phone);
  if new.phone_key is null then
    raise exception 'Enter a valid phone number (at least 9 digits)';
  end if;
  return new;
end;
$$;

create or replace function public.blocked_contacts_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active then
    perform public.apply_contact_block(new.phone_key, new.phone);
  end if;
  return new;
end;
$$;

drop trigger if exists blocked_contacts_before_write on public.blocked_contacts;
create trigger blocked_contacts_before_write
  before insert or update of phone on public.blocked_contacts
  for each row execute function public.blocked_contacts_before_write();

drop trigger if exists blocked_contacts_after_write on public.blocked_contacts;
create trigger blocked_contacts_after_write
  after insert or update of active, phone on public.blocked_contacts
  for each row execute function public.blocked_contacts_after_write();

-- Reject writes carrying a blocked number. On UPDATE only a changed phone is checked, so orders that
-- already exist can still be completed, refunded or marked failed.
create or replace function public.reject_blocked_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_col text;
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_value text;
begin
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
  end if;

  foreach v_col in array tg_argv loop
    v_value := v_new ->> v_col;
    continue when v_value is null or v_value = '';
    continue when tg_op = 'UPDATE' and (v_old ->> v_col) is not distinct from v_value;
    if public.is_phone_blocked(v_value) then
      raise exception 'This number is blocked from using this service' using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('orders',                    'customer_number'),
      ('digital_service_orders',    'customer_phone'),
      ('store_product_orders',      'buyer_phone'),
      ('partner_api_purchases',     'recipient'),
      ('afa_registrations',         'customer_phone'),
      ('private_share_subscriptions','customer_phone,whatsapp_number'),
      ('free_data_claims',          'phone_number'),
      ('spin_wheel_payments',       'phone'),
      ('spin_wheel_plays',          'phone'),
      ('payments',                  'phone'),
      ('order_number_submissions',  'phone_number'),
      ('customers',                 'phone_number'),
      ('profiles',                  'phone')
    ) as v(tbl, cols)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists reject_blocked_phone on public.%I', t.tbl);
      execute format(
        'create trigger reject_blocked_phone before insert or update on public.%I for each row execute function public.reject_blocked_phone(%s)',
        t.tbl,
        (select string_agg(quote_literal(c), ',') from unnest(string_to_array(t.cols, ',')) c)
      );
    end if;
  end loop;
end $$;
