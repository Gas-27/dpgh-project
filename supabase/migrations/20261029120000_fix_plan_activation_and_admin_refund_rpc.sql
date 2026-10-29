-- 1. Product plan activation was blocked by row level security and by a store_kind check.
--    Subagent, sub-subagent and customer stores were being charged but could not write their plan.
alter table public.store_product_entitlements drop constraint if exists store_product_entitlements_store_kind_check;
alter table public.store_product_entitlements
  add constraint store_product_entitlements_store_kind_check
  check (store_kind = any (array['customer'::text, 'agent'::text, 'subagent'::text, 'subsubagent'::text]));

create or replace function public.user_owns_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    p_store_id = auth.uid()
    or exists (select 1 from public.agent_stores s where s.id = p_store_id and s.user_id = auth.uid())
    or exists (select 1 from public.subagent_stores s where s.id = p_store_id and s.user_id = auth.uid())
    or exists (select 1 from public.sub_subagent_stores s where s.id = p_store_id and s.user_id = auth.uid())
    or exists (select 1 from public.customers c where c.id = p_store_id and c.user_id = auth.uid())
  );
$$;
revoke all on function public.user_owns_store(uuid) from public, anon;
grant execute on function public.user_owns_store(uuid) to authenticated;

drop policy if exists store_product_entitlements_owner on public.store_product_entitlements;
create policy store_product_entitlements_owner on public.store_product_entitlements
  for all to authenticated
  using (public.user_owns_store(store_id))
  with check (public.user_owns_store(store_id));

drop policy if exists store_products_owner_write on public.store_products;
create policy store_products_owner_write on public.store_products
  for all to authenticated
  using (public.user_owns_store(store_id))
  with check (public.user_owns_store(store_id));

-- 2. Charging the wallet and activating the plan now happen in one transaction.
create or replace function public.purchase_store_product_plan(p_store_kind text, p_store_id uuid, p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet_owner uuid;
  v_price numeric;
  v_limit integer;
  v_days integer;
  v_expires timestamptz;
  v_row public.wallet_ledger;
begin
  if p_plan = 'weekly' then v_price := 5; v_limit := 5; v_days := 7;
  elsif p_plan = 'monthly' then v_price := 20; v_limit := 30; v_days := 30;
  else raise exception 'Invalid plan' using errcode = '22023';
  end if;
  if p_store_kind not in ('customer', 'agent', 'subagent', 'subsubagent') then
    raise exception 'Invalid store type' using errcode = '22023';
  end if;

  v_wallet_owner := public.wallet_resolve_own(p_store_kind, p_store_id);
  v_row := public.wallet_apply_internal(p_store_kind, v_wallet_owner, -v_price, 'product_plan', gen_random_uuid()::text, p_plan || ' product plan', auth.uid());
  v_expires := now() + make_interval(days => v_days);

  insert into public.store_product_entitlements (store_id, store_kind, paid_post_limit, paid_post_expires_at, plan_type, updated_at)
  values (p_store_id, p_store_kind, v_limit, v_expires, p_plan, now())
  on conflict (store_id) do update
    set store_kind = excluded.store_kind,
        paid_post_limit = excluded.paid_post_limit,
        paid_post_expires_at = excluded.paid_post_expires_at,
        plan_type = excluded.plan_type,
        updated_at = now();

  return jsonb_build_object('ledger_id', v_row.id, 'balance_after', v_row.balance_after, 'expires_at', v_expires);
end;
$$;
revoke all on function public.purchase_store_product_plan(text, uuid, text) from public, anon;
grant execute on function public.purchase_store_product_plan(text, uuid, text) to authenticated;

-- 3. Admin refunds run directly from the dashboard, no edge function involved.
create or replace function public.admin_refund_order_wallet(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Only admins can refund orders.' using errcode = '42501';
  end if;
  v_result := public.admin_allocate_order_refund(p_order_id, auth.uid());
  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object('success', true);
end;
$$;
revoke all on function public.admin_refund_order_wallet(uuid) from public, anon;
grant execute on function public.admin_refund_order_wallet(uuid) to authenticated;

-- 4. Activate the plans for everyone who was charged but never received one.
--    Highest charged tier per store wins; the full period starts now because the paid time was lost.
with charged as (
  select l.owner_type, l.owner_id, max(abs(l.delta)) as top_charge
  from public.wallet_ledger l
  where l.kind = 'product_plan' and l.delta < 0
  group by l.owner_type, l.owner_id
),
targets as (
  select c.owner_type,
         case when c.owner_type = 'customer' then coalesce((select cu.user_id from public.customers cu where cu.id = c.owner_id), c.owner_id) else c.owner_id end as store_id,
         c.top_charge
  from charged c
)
insert into public.store_product_entitlements (store_id, store_kind, paid_post_limit, paid_post_expires_at, plan_type, updated_at)
select t.store_id, t.owner_type,
       case when t.top_charge > 10 then 30 else 5 end,
       now() + make_interval(days => case when t.top_charge > 10 then 30 else 7 end),
       case when t.top_charge > 10 then 'monthly' else 'weekly' end,
       now()
from targets t
where not exists (select 1 from public.store_product_entitlements e where e.store_id = t.store_id)
on conflict (store_id) do nothing;
