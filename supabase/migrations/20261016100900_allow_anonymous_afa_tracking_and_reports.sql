create or replace function public.search_afa_registration(p_phone text)
returns table (
  id uuid,
  customer_name text,
  customer_phone text,
  region text,
  crop text,
  registration_status text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select r.id, r.customer_name, r.customer_phone, r.region, r.crop,
         r.registration_status, r.created_at
  from public.afa_registrations r
  where regexp_replace(coalesce(r.customer_phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 9
  order by r.created_at desc
  limit 5;
$$;

create or replace function public.lookup_afa_registration_by_reference(p_reference text)
returns table (id uuid, registration_status text, customer_phone text)
language sql
security definer
set search_path = ''
as $$
  select r.id, r.registration_status, r.customer_phone
  from public.afa_registrations r
  where r.paystack_reference = p_reference
  limit 1;
$$;

create or replace function public.submit_afa_registration_report(
  p_registration_id uuid,
  p_phone text,
  p_name text,
  p_dialed_1848 boolean,
  p_notes text,
  p_screenshot_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_phone text;
  v_name text;
begin
  if not coalesce(p_dialed_1848, false) then
    raise exception 'Dial confirmation is required';
  end if;
  if length(trim(coalesce(p_notes, ''))) > 2000 then
    raise exception 'Report notes are too long';
  end if;
  if p_screenshot_url is not null and length(p_screenshot_url) > 2048 then
    raise exception 'Screenshot URL is too long';
  end if;

  select r.customer_phone, r.customer_name into v_phone, v_name
  from public.afa_registrations r
  where r.id = p_registration_id
    and regexp_replace(coalesce(r.customer_phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  if v_phone is null then
    raise exception 'Registration not found';
  end if;

  insert into public.afa_registration_reports
    (customer_phone, customer_name, registration_id, dialed_1848, notes, status)
  values
    (v_phone, coalesce(v_name, p_name), p_registration_id, true,
      nullif(concat_ws(E'\n', nullif(trim(p_notes), ''), case when p_screenshot_url is not null then 'Screenshot: ' || p_screenshot_url end), ''),
      'pending')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.search_afa_registration(text) from public;
revoke all on function public.lookup_afa_registration_by_reference(text) from public;
revoke all on function public.submit_afa_registration_report(uuid, text, text, boolean, text, text) from public;
grant execute on function public.search_afa_registration(text) to anon, authenticated;
grant execute on function public.lookup_afa_registration_by_reference(text) to anon, authenticated;
grant execute on function public.submit_afa_registration_report(uuid, text, text, boolean, text, text) to anon, authenticated;

revoke insert on public.afa_registration_reports from anon, authenticated;
