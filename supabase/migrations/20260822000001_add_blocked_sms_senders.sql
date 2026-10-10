create table if not exists public.sms_blocked_sender_ids (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index if not exists sms_blocked_sender_ids_normalized_idx
  on public.sms_blocked_sender_ids (upper(regexp_replace(sender_id, '\s+', ' ', 'g')));

alter table public.sms_blocked_sender_ids enable row level security;

create or replace function public.normalize_sms_sender_id(p_sender_id text)
returns text language sql immutable as $$
  select upper(trim(regexp_replace(coalesce(p_sender_id, ''), '\s+', ' ', 'g')))
$$;

create or replace function public.is_sms_sender_blocked(p_sender_id text)
returns boolean language sql stable security invoker as $$
  select exists (
    select 1 from public.sms_blocked_sender_ids
    where public.normalize_sms_sender_id(sender_id) = public.normalize_sms_sender_id(p_sender_id)
  )
$$;

create or replace function public.admin_list_blocked_sms_senders()
returns setof public.sms_blocked_sender_ids language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  return query select * from public.sms_blocked_sender_ids order by created_at desc;
end;
$$;

create or replace function public.admin_add_blocked_sms_sender(p_sender_id text, p_reason text default null)
returns public.sms_blocked_sender_ids language plpgsql security definer set search_path = public as $$
declare result public.sms_blocked_sender_ids;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'Admin access required'; end if;
  insert into public.sms_blocked_sender_ids(sender_id, reason, created_by)
  values (public.normalize_sms_sender_id(p_sender_id), nullif(trim(p_reason), ''), auth.uid())
  returning * into result;
  return result;
end;
$$;

create or replace function public.admin_delete_blocked_sms_sender(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'Admin access required'; end if;
  delete from public.sms_blocked_sender_ids where id = p_id;
end;
$$;

revoke all on function public.admin_list_blocked_sms_senders() from public;
revoke all on function public.admin_add_blocked_sms_sender(text,text) from public;
revoke all on function public.admin_delete_blocked_sms_sender(uuid) from public;
grant execute on function public.admin_list_blocked_sms_senders() to authenticated;
grant execute on function public.admin_add_blocked_sms_sender(text,text) to authenticated;
grant execute on function public.admin_delete_blocked_sms_sender(uuid) to authenticated;
