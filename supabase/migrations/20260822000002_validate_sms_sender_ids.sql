-- Enforce sender ID guidelines and locked sender IDs at the database level so the
-- rules cannot be bypassed by any client or storefront.
create or replace function public.validate_sms_sender_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := public.normalize_sms_sender_id(new.sender_id);

  if length(normalized) < 3 or length(normalized) > 11 then
    raise exception 'Sender ID must be 3-11 characters including spaces';
  end if;

  if normalized !~ '^[A-Z0-9 ]+$' then
    raise exception 'Sender ID cannot contain special characters';
  end if;

  if replace(normalized, ' ', '') ~ '^[0-9]+$' then
    raise exception 'Sender ID cannot be only numbers';
  end if;

  if public.is_sms_sender_blocked(normalized) then
    raise exception 'This sender ID is locked and cannot be used';
  end if;

  new.sender_id := normalized;
  return new;
end;
$$;

drop trigger if exists sms_sender_ids_validate on public.sms_sender_ids;

create trigger sms_sender_ids_validate
before insert or update of sender_id on public.sms_sender_ids
for each row execute function public.validate_sms_sender_id();
