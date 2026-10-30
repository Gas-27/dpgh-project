-- Customer wallets: accept either customers.id or the auth user id as the owner id,
-- as long as the customer row belongs to the signed-in user.
create or replace function public.wallet_resolve_own(p_owner_type text, p_owner_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_owner_type = 'customer' then
    select c.id into v_owner from public.customers c
      where c.user_id = auth.uid() and (c.id = p_owner_id or c.user_id = p_owner_id)
      limit 1;
    if v_owner is null then raise exception 'Customer wallet ownership mismatch' using errcode='42501'; end if;
    return v_owner;
  elsif p_owner_type = 'agent' then
    select s.id into v_owner from public.agent_stores s where s.id = p_owner_id and s.user_id = auth.uid();
    if v_owner is null then select s.id into v_owner from public.agent_stores s where s.user_id = auth.uid(); end if;
  elsif p_owner_type = 'subagent' then
    select s.id into v_owner from public.subagent_stores s where s.id = p_owner_id and s.user_id = auth.uid();
    if v_owner is null then select s.id into v_owner from public.subagent_stores s where s.user_id = auth.uid(); end if;
  elsif p_owner_type in ('subsubagent','sub_subagent') then
    select s.id into v_owner from public.sub_subagent_stores s where s.id = p_owner_id and s.user_id = auth.uid();
    if v_owner is null then select s.id into v_owner from public.sub_subagent_stores s where s.user_id = auth.uid(); end if;
  else
    raise exception 'Unsupported wallet owner type' using errcode='22023';
  end if;
  if v_owner is null then raise exception 'Wallet owner not found' using errcode='P0002'; end if;
  return v_owner;
end; $function$;
