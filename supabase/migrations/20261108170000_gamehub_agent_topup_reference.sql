-- Game Hub analytics: agents use their store top-up reference, not their personal customer reference.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gamehub_admin_analytics(text,text)'::regprocedure) into d;
  d := replace(d,
    $old$coalesce(
            (select cu.topup_reference from public.customers cu where cu.user_id = c.user_id and cu.topup_reference is not null limit 1),
            (select a.topup_reference from public.agent_stores a where a.user_id = c.user_id and a.topup_reference is not null limit 1),
            (select sa.topup_reference from public.subagent_stores sa where sa.user_id = c.user_id and sa.topup_reference is not null limit 1),
            (select ss.topup_reference from public.sub_subagent_stores ss where ss.user_id = c.user_id and ss.topup_reference is not null limit 1)
          )$old$,
    $new$case
            when exists (select 1 from public.agent_stores a where a.user_id = c.user_id)
              then (select a.topup_reference from public.agent_stores a where a.user_id = c.user_id and a.topup_reference is not null limit 1)
            when exists (select 1 from public.subagent_stores sa where sa.user_id = c.user_id)
              then (select sa.topup_reference from public.subagent_stores sa where sa.user_id = c.user_id and sa.topup_reference is not null limit 1)
            when exists (select 1 from public.sub_subagent_stores ss where ss.user_id = c.user_id)
              then (select ss.topup_reference from public.sub_subagent_stores ss where ss.user_id = c.user_id and ss.topup_reference is not null limit 1)
            else (select cu.topup_reference from public.customers cu where cu.user_id = c.user_id and cu.topup_reference is not null limit 1)
          end$new$);
  execute d;
end
$do$;
