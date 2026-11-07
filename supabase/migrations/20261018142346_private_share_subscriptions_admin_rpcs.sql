-- Admin-only access to private_share_subscriptions.
-- RLS stays enabled with no policies, so customers and anonymous users keep zero direct access.
-- The admin panel reads and confirms through these SECURITY DEFINER functions only.

revoke all on table public.private_share_subscriptions from anon, authenticated;

create or replace function public.private_share_admin_list_subscriptions(
  p_confirmation_status text default null,
  p_search text default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  payment_reference text,
  customer_name text,
  customer_phone text,
  customer_email text,
  service_name text,
  amount numeric,
  fee_amount numeric,
  selling_price numeric,
  seller_store_kind text,
  seller_store_id uuid,
  payment_status text,
  confirmation_status text,
  paid_at timestamptz,
  delivery_mode text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
begin
  perform public.private_share_require_admin();

  if p_confirmation_status is not null and p_confirmation_status not in ('pending', 'confirmed', 'rejected') then
    raise exception 'Invalid confirmation status filter' using errcode = '22023';
  end if;

  return query
  select s.id, s.payment_reference, s.customer_name, s.customer_phone, s.customer_email, s.service_name,
         s.amount, s.fee_amount, s.selling_price, s.seller_store_kind, s.seller_store_id,
         s.payment_status, s.confirmation_status, s.paid_at, s.delivery_mode, s.created_at, s.updated_at
  from public.private_share_subscriptions s
  where (p_confirmation_status is null or s.confirmation_status = p_confirmation_status)
    and (v_search is null
      or strpos(lower(coalesce(s.payment_reference, '')), v_search) > 0
      or strpos(lower(coalesce(s.service_name, '')), v_search) > 0
      or strpos(lower(coalesce(s.customer_name, '')), v_search) > 0
      or strpos(lower(coalesce(s.customer_phone, '')), v_search) > 0)
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end; $$;

create or replace function public.private_share_admin_confirm_subscription(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.private_share_require_admin();
  v_row public.private_share_subscriptions;
  v_updated integer;
begin
  select * into v_row from public.private_share_subscriptions where id = p_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_row.payment_status <> 'paid' then
    raise exception 'Only paid subscriptions can be confirmed (payment status: %)', v_row.payment_status using errcode = '55000';
  end if;
  if v_row.confirmation_status = 'confirmed' then
    raise exception 'Subscription is already confirmed' using errcode = '55000';
  end if;
  if v_row.confirmation_status <> 'pending' then
    raise exception 'Only pending subscriptions can be confirmed (current: %)', v_row.confirmation_status using errcode = '55000';
  end if;

  update public.private_share_subscriptions
  set confirmation_status = 'confirmed', updated_at = now()
  where id = p_id and payment_status = 'paid' and confirmation_status = 'pending';
  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'Subscription could not be confirmed' using errcode = '55000';
  end if;

  perform public.private_share_log(v_admin, 'subscription_confirmed', 'subscription', p_id,
    jsonb_build_object('payment_reference', v_row.payment_reference, 'amount', v_row.amount));

  return jsonb_build_object('id', p_id, 'changed', true, 'rows_updated', v_updated, 'confirmation_status', 'confirmed');
end; $$;

revoke all on function public.private_share_admin_list_subscriptions(text, text, integer) from public, anon, authenticated;
revoke all on function public.private_share_admin_confirm_subscription(uuid) from public, anon, authenticated;
grant execute on function public.private_share_admin_list_subscriptions(text, text, integer) to authenticated, service_role;
grant execute on function public.private_share_admin_confirm_subscription(uuid) to authenticated, service_role;
