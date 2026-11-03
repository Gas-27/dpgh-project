-- Game Hub wins: link the free-data order to the player's account (shows in their dashboard
-- with selling price 0, cost price 0 and profit 0) and make free-data orders trackable
-- from every agent, subagent and package page.

create or replace function public.gamehub_link_claim_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_id is not null then
    update public.orders
      set customer_id = new.user_id,
          user_id = new.user_id,
          amount = 0,
          selling_price = 0,
          base_price = 0
      where id = new.order_id;
  end if;
  return new;
end $$;

drop trigger if exists gamehub_link_claim_order_trg on public.gamehub_claims;
create trigger gamehub_link_claim_order_trg
  after insert on public.gamehub_claims
  for each row execute function public.gamehub_link_claim_order();

-- Backfill earlier Game Hub claims.
update public.orders o
  set customer_id = c.user_id, user_id = c.user_id, amount = 0, selling_price = 0, base_price = 0
  from public.gamehub_claims c
  where c.order_id = o.id and (o.user_id is distinct from c.user_id or o.customer_id is distinct from c.user_id);

create or replace function public.search_orders_public(
  p_term text,
  p_agent_store_id uuid default null,
  p_subagent_store_id uuid default null,
  p_direct_agent_only boolean default false
) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_term text := regexp_replace(coalesce(p_term, ''), '\s', '', 'g');
  v_digits text := regexp_replace(v_term, '\D', '', 'g');
  v_result json;
begin
  if v_term ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select coalesce(json_agg(t order by t.created_at desc), '[]'::json) into v_result from (
      select id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status,
             created_at, package_id, agent_store_id, subagent_store_id, sub_subagent_store_id, customer_id,
             provider_reference, provider_order_id, mtn_beneficiary_status, mtn_failure_reason,
             mtn_beneficiary_submitted_at, mtn_retry_eligible_at, payment_method
      from orders
      where id = v_term::uuid
        and (payment_method = 'free_data_claim' or (
          (p_agent_store_id is null or agent_store_id = p_agent_store_id)
          and (p_subagent_store_id is null or subagent_store_id = p_subagent_store_id)
          and (not p_direct_agent_only or subagent_store_id is null)))
    ) t;
    return v_result;
  end if;

  if length(v_digits) < 9 then
    return '[]'::json;
  end if;

  select coalesce(json_agg(t order by t.created_at desc), '[]'::json) into v_result from (
    select id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status,
           created_at, package_id, agent_store_id, subagent_store_id, sub_subagent_store_id, customer_id,
           provider_reference, provider_order_id, mtn_beneficiary_status, mtn_failure_reason,
           mtn_beneficiary_submitted_at, mtn_retry_eligible_at, payment_method
    from orders
    where right(regexp_replace(customer_number, '\D', '', 'g'), 9) = right(v_digits, 9)
      and (payment_method = 'free_data_claim' or (
        (p_agent_store_id is null or agent_store_id = p_agent_store_id)
        and (p_subagent_store_id is null or subagent_store_id = p_subagent_store_id)
        and (not p_direct_agent_only or subagent_store_id is null)))
    order by created_at desc
    limit 50
  ) t;
  return v_result;
end $$;
