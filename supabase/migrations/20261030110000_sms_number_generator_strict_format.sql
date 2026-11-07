-- Stricter SMS number generator: always 10 digits (0 + 9), only the approved
-- Ghana prefixes, and numbers that look like real subscriber numbers.
--   MTN:     024, 025, 053, 054, 055, 059
--   Telecel: 020, 050

alter table public.generated_sms_numbers
  drop constraint if exists generated_sms_numbers_phone_format;
alter table public.generated_sms_numbers
  add constraint generated_sms_numbers_phone_format
  check (phone_number ~ '^0(24|25|53|54|55|59|20|50)[0-9]{7}$') not valid;

create or replace function public.generate_sms_numbers(
  p_owner_type text,
  p_owner_id uuid,
  p_count integer,
  p_network text default 'mixed'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := case when p_owner_type = 'sub_subagent' then 'subsubagent' else p_owner_type end;
  v_price numeric;
  v_owner uuid;
  v_batch uuid := gen_random_uuid();
  v_have integer := 0;
  v_added integer;
  v_attempt integer := 0;
  v_row public.wallet_ledger;
  v_numbers jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_type not in ('customer', 'agent', 'subagent', 'subsubagent') then
    raise exception 'Unsupported wallet owner type' using errcode = '22023';
  end if;
  if p_network not in ('mixed', 'mtn', 'telecel') then
    raise exception 'Invalid network' using errcode = '22023';
  end if;
  v_price := case p_count when 250 then 3 when 500 then 6 when 1000 then 12 else null end;
  if v_price is null then raise exception 'Invalid package size' using errcode = '22023'; end if;

  v_owner := public.wallet_resolve_own(v_type, p_owner_id);
  v_row := public.wallet_apply_internal(v_type, v_owner, -v_price, 'sms_numbers', v_batch::text,
    p_count || ' generated SMS numbers', auth.uid());

  while v_have < p_count and v_attempt < 16 loop
    v_attempt := v_attempt + 1;
    with others as materialized (
      select right(regexp_replace(k.customer_number, '\D', '', 'g'), 9) n9 from public.korba_transaction_history k
      union
      select right(regexp_replace(u.recipient_number, '\D', '', 'g'), 9) from public.ussd_transactions u
      union
      select right(regexp_replace(o.customer_number, '\D', '', 'g'), 9) from public.old_extracted_contacts o
    ), raw as (
      select g,
        case when p_network = 'mtn' then 'mtn'
             when p_network = 'telecel' then 'telecel'
             when random() < 0.5 then 'mtn' else 'telecel' end net
      from generate_series(1, (p_count - v_have) * 4 + 80) g
    ), cand as (
      select r.net,
        (case when r.net = 'mtn'
              then (array['24','25','53','54','55','59'])[1 + floor(random() * 6)::int]
              else (array['20','50'])[1 + floor(random() * 2)::int] end)
        || lpad((1000000 + floor(random() * 9000000))::bigint::text, 7, '0') n9
      from raw r
    ), fresh as (
      select distinct on (c.n9) c.n9, c.net
      from cand c
      where ('0' || c.n9) ~ '^0(24|25|53|54|55|59|20|50)[0-9]{7}$'
        -- skip subscriber parts that look made up: long runs, 4-digit sequences, repeated halves
        and right(c.n9, 7) !~ '(\d)\1{3}'
        and right(c.n9, 7) !~ '(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)'
        and right(c.n9, 7) !~ '^(\d{2})\1{2}'
        and right(c.n9, 7) !~ '^(\d{3})\1'
        and right(c.n9, 7) !~ '(000|999)'
        and not exists (
          select 1 from public.orders o
          where right(regexp_replace(o.customer_number, '\D', '', 'g'), 9) = c.n9)
        and not exists (select 1 from others x where x.n9 = c.n9)
        and not exists (select 1 from public.generated_sms_numbers gn where gn.number9 = c.n9)
      limit (p_count - v_have)
    )
    insert into public.generated_sms_numbers (number9, phone_number, network, owner_type, owner_id, owner_user_id, batch_id)
    select f.n9, '0' || f.n9, f.net, v_type, v_owner, auth.uid(), v_batch from fresh f
    on conflict (number9) do nothing;
    get diagnostics v_added = row_count;
    v_have := v_have + v_added;
  end loop;

  if v_have < p_count then
    raise exception 'Could not generate enough fresh numbers. Your wallet was not charged.' using errcode = 'P0001';
  end if;

  select jsonb_agg(phone_number) into v_numbers from public.generated_sms_numbers where batch_id = v_batch;
  return jsonb_build_object('batch_id', v_batch, 'count', v_have, 'price', v_price,
    'balance_after', v_row.balance_after, 'numbers', v_numbers);
end;
$$;

revoke all on function public.generate_sms_numbers(text, uuid, integer, text) from public, anon;
grant execute on function public.generate_sms_numbers(text, uuid, integer, text) to authenticated;
