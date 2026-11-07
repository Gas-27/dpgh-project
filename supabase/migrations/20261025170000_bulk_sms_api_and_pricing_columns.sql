alter table public.app_settings
  add column if not exists global_product_advertising_fee numeric not null default 0,
  add column if not exists serious_vendor_monthly_fee numeric not null default 0,
  add column if not exists serious_vendor_product_limit numeric not null default 0,
  add column if not exists sms_api_recipient_price numeric not null default 0,
  add column if not exists sms_api_page_price numeric not null default 0;

alter table public.sms_messages
  add column if not exists api_user_id uuid references public.api_users(id) on delete set null,
  add column if not exists source text not null default 'dashboard',
  add column if not exists idempotency_key text;

create unique index if not exists sms_messages_api_idempotency_idx
  on public.sms_messages (api_user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.sms_sender_ids
  add column if not exists source text not null default 'dashboard';

create or replace function public.api_sms_charge(p_api_user_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then return false; end if;
  update public.api_users
     set api_wallet = coalesce(api_wallet, 0) - p_amount, api_wallet_updated_at = now(), updated_at = now()
   where id = p_api_user_id and active is not false and coalesce(api_wallet, 0) >= p_amount;
  return found;
end; $$;

create or replace function public.api_sms_refund(p_api_user_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then return false; end if;
  update public.api_users
     set api_wallet = coalesce(api_wallet, 0) + p_amount, api_wallet_updated_at = now(), updated_at = now()
   where id = p_api_user_id;
  return found;
end; $$;

revoke execute on function public.api_sms_charge(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.api_sms_refund(uuid, numeric) from public, anon, authenticated;
grant execute on function public.api_sms_charge(uuid, numeric) to service_role;
grant execute on function public.api_sms_refund(uuid, numeric) to service_role;

drop function if exists public.admin_list_sms_sender_ids();
create function public.admin_list_sms_sender_ids()
returns table(id uuid, sender_id text, status text, is_global boolean, user_id uuid, user_email text, created_at timestamptz, reviewed_at timestamptz, phone_number text, source text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not has_role(auth.uid(), 'admin'::text) then raise exception 'admin access required'; end if;
  return query
    select s.id, s.sender_id, s.status, s.is_global, s.user_id, u.email::text, s.created_at, s.reviewed_at, s.phone_number, s.source
    from public.sms_sender_ids s
    left join auth.users u on u.id = s.user_id
    order by (s.status = 'pending') desc, s.created_at desc;
end; $$;

revoke execute on function public.admin_list_sms_sender_ids() from public, anon;
grant execute on function public.admin_list_sms_sender_ids() to authenticated;
