-- Prevent private-share checkout when no account seat is available.
create or replace function public.private_share_has_available_seat(p_service_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.private_share_accounts a
    where a.service_id = p_service_id
      and a.maintenance_status = 'active'
      and (a.account_subscription_expires_at is null or a.account_subscription_expires_at > now())
      and (
        select count(*)
        from public.private_share_assignments assignment
        where assignment.account_id = a.id
          and assignment.status in ('active', 'expired', 'revoked')
      ) < a.capacity
  );
$$;

revoke all on function public.private_share_has_available_seat(uuid) from public;
grant execute on function public.private_share_has_available_seat(uuid) to service_role;
