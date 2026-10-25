-- Trigger-only functions never need EXECUTE for API roles (privileges are checked at CREATE TRIGGER time only).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- Unused function that exposed descendant emails without authentication.
revoke execute on function public.get_direct_descendant_emails(uuid) from public, anon, authenticated;

-- Functions that must only be callable by signed-in users.
revoke execute on function public.private_share_admin_set_account_credentials(uuid, text, text) from public, anon;
revoke execute on function public.private_share_admin_set_account_password(uuid, text) from public, anon;
revoke execute on function public.get_korba_history(text, uuid) from public, anon;
revoke execute on function public.record_korba_history(text, uuid, text, text, text, text, numeric, text, text, text, text) from public, anon;
revoke execute on function public.generate_next_subsubagent_reference() from public, anon;

grant execute on function public.private_share_admin_set_account_credentials(uuid, text, text) to authenticated;
grant execute on function public.private_share_admin_set_account_password(uuid, text) to authenticated;
grant execute on function public.get_korba_history(text, uuid) to authenticated;
grant execute on function public.record_korba_history(text, uuid, text, text, text, text, numeric, text, text, text, text) to authenticated;
grant execute on function public.generate_next_subsubagent_reference() to authenticated;

-- Pin search_path on public functions that have none (keeps current effective resolution: public, extensions).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_network_bundles','handle_new_agent_store')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;
