-- API purchase history is only available to agents and customers (users). Subagents and sub-subagents get no rows.
create or replace function public.get_api_purchase_history(p_owner_type text, p_owner_id uuid)
 returns table (
   id uuid,
   created_at timestamptz,
   product_type text,
   network_code text,
   package_code text,
   customer_number text,
   amount numeric,
   status text,
   source text
 )
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind text := lower(replace(p_owner_type, '_', ''));
  v_identity uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.can_view_owner_history(p_owner_type, p_owner_id) then raise exception 'Not allowed' using errcode = '42501'; end if;

  if v_kind = 'agent' then
    select s.user_id into v_identity from agent_stores s where s.id = p_owner_id;
  elsif v_kind = 'customer' then
    select coalesce((select c.user_id from customers c where c.id = p_owner_id), p_owner_id) into v_identity;
  else
    return;
  end if;
  if v_identity is null then return; end if;

  return query
  select p.id, p.created_at, p.service_type, p.network, p.product_name, p.recipient, p.amount, p.status, 'partner API'::text
  from partner_api_purchases p
  join api_users a on a.id = p.api_user_id
  where a.identity_id = v_identity
  union all
  select o.id, o.created_at, 'data'::text, o.network, coalesce(o.size_gb_text, o.size_gb::text || 'GB'), o.customer_number, o.amount,
         coalesce(o.fulfillment_status, o.status), 'API wallet'::text
  from orders o
  join api_users a on a.id::text = o.api_user
  where a.identity_id = v_identity
  order by 2 desc
  limit 500;
end;
$function$;

revoke all on function public.get_api_purchase_history(text, uuid) from public, anon;
grant execute on function public.get_api_purchase_history(text, uuid) to authenticated;
