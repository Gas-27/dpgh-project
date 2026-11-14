alter table public.app_settings add column if not exists withdrawal_controls jsonb not null default '{}'::jsonb;

create or replace function public.get_withdrawal_controls()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select withdrawal_controls from public.app_settings where id = 1), '{}'::jsonb);
$$;
revoke all on function public.get_withdrawal_controls() from public;
grant execute on function public.get_withdrawal_controls() to anon, authenticated, service_role;

create or replace function public.admin_set_withdrawal_controls(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text; v_clean jsonb := '{}'::jsonb;
begin
  if not public.is_wallet_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  foreach v_role in array array['agent','subagent','sub_subagent'] loop
    v_clean := v_clean || jsonb_build_object(v_role, jsonb_build_object(
      'paused', coalesce((p -> v_role ->> 'paused')::boolean, false),
      'message', left(coalesce(p -> v_role ->> 'message', ''), 500)));
  end loop;
  insert into public.app_settings (id, withdrawal_controls, updated_at) values (1, v_clean, now())
  on conflict (id) do update set withdrawal_controls = excluded.withdrawal_controls, updated_at = now();
  return v_clean;
end $$;
revoke all on function public.admin_set_withdrawal_controls(jsonb) from public, anon;
grant execute on function public.admin_set_withdrawal_controls(jsonb) to authenticated;

create or replace function public.withdrawal_pause_message(p_type text)
returns text language sql stable security definer set search_path = public as $$
  select case when coalesce((c -> p_type ->> 'paused')::boolean, false)
    then coalesce(nullif(btrim(c -> p_type ->> 'message'), ''), 'Withdrawals are temporarily unavailable. Please try again later.')
    else null end
  from (select coalesce((select withdrawal_controls from public.app_settings where id = 1), '{}'::jsonb) c) s;
$$;
revoke all on function public.withdrawal_pause_message(text) from public, anon;
grant execute on function public.withdrawal_pause_message(text) to authenticated, service_role;

-- payout_debit_wallet now begins with:
--   v_pause := public.withdrawal_pause_message(p_type);
--   if v_pause is not null then raise exception 'WITHDRAWALS_PAUSED: %', v_pause using errcode = 'P0001'; end if;
-- (rest of the function unchanged)

notify pgrst, 'reload schema';
