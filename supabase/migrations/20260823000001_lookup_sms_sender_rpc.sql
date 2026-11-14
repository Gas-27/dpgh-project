create or replace function public.lookup_sms_sender_ids(p_phone_number text)
returns table (id uuid, sender_id text, status text, is_global boolean, user_id uuid, phone_number text)
language sql
security definer
set search_path = public
as $$
  select s.id, s.sender_id, s.status, s.is_global, s.user_id, s.phone_number
  from public.sms_sender_ids s
  where regexp_replace(coalesce(s.phone_number, ''), '\D', '', 'g') = regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g')
  order by s.created_at desc;
$$;

revoke all on function public.lookup_sms_sender_ids(text) from public;
grant execute on function public.lookup_sms_sender_ids(text) to anon, authenticated;
