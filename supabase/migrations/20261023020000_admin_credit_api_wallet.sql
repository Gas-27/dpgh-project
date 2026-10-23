create or replace function public.admin_credit_api_wallet(p_api_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric;
begin
  if not public.is_wallet_admin() then
    raise exception 'Only admins can credit API wallets' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  update public.api_users
     set wallet = coalesce(wallet, 0) + p_amount, updated_at = now()
   where id = p_api_user_id
   returning wallet into v_balance;
  if not found then
    raise exception 'API user not found';
  end if;

  insert into public.api_wallet_topups (api_user_id, amount, fee_amount, total_amount, paystack_reference, status, completed_at)
  values (p_api_user_id, p_amount, 0, p_amount, 'admin_' || gen_random_uuid()::text, 'completed', now());

  return v_balance;
end;
$$;
revoke all on function public.admin_credit_api_wallet(uuid, numeric) from public, anon;
grant execute on function public.admin_credit_api_wallet(uuid, numeric) to authenticated;

drop policy if exists "admins read api topups" on public.api_wallet_topups;
create policy "admins read api topups" on public.api_wallet_topups
  for select to authenticated using (public.is_wallet_admin());
