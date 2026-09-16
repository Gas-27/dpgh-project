create or replace function public.submit_sms_sender_id(p_sender_id text, p_phone_number text default null)
returns public.sms_sender_ids
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.sms_sender_ids;
  normalized text;
  normalized_phone text;
begin
  normalized := public.normalize_sms_sender_id(p_sender_id);
  normalized_phone := nullif(regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g'), '');

  if length(normalized) < 3 or length(normalized) > 11 then raise exception 'Sender ID must be 3-11 characters including spaces'; end if;
  if normalized !~ '^[A-Z0-9 ]+$' then raise exception 'Sender ID cannot contain special characters'; end if;
  if replace(normalized, ' ', '') ~ '^[0-9]+$' then raise exception 'Sender ID cannot be only numbers'; end if;
  if normalized_phone is null or normalized_phone !~ '^(0|233)[2-5][0-9]{8}$' then raise exception 'A valid Ghana phone number is required'; end if;
  if public.is_sms_sender_blocked(normalized) then raise exception 'This sender ID is locked and cannot be used'; end if;
  if exists (select 1 from public.sms_sender_ids where public.normalize_sms_sender_id(sender_id) = normalized) then raise exception 'This sender ID already exists'; end if;

  insert into public.sms_sender_ids (user_id, sender_id, phone_number, status, is_global)
  values (auth.uid(), normalized, normalized_phone, 'pending', false)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.submit_sms_sender_id(text, text) from public;
grant execute on function public.submit_sms_sender_id(text, text) to anon, authenticated;
