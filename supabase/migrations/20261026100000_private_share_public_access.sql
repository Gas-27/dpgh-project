-- Public-share customers view the active credentials configured for their purchased service.
-- This intentionally does not allocate or consume an account capacity slot.
create or replace function public.private_share_my_public_access()
returns table (
  service_name text,
  account_id uuid,
  account_label text,
  login_identifier text,
  customer_instructions text,
  access_emails text[]
)
language sql stable security definer set search_path = '' as $$
  select distinct on (ac.id)
    coalesce(ds.name, sub.service_name),
    ac.id,
    ac.label,
    ac.login_identifier,
    ac.customer_instructions,
    coalesce(
      array(
        select distinct ei.email
        from public.private_share_account_email_links link
        join public.private_share_email_identities ei on ei.id = link.email_identity_id
        where link.account_id = ac.id and ei.active = true
        order by ei.email
      ), '{}'::text[]
    )
  from public.private_share_subscriptions sub
  join public.private_share_accounts ac on ac.service_id::text = sub.service_id
  left join public.digital_services ds on ds.id::text = sub.service_id
  where auth.uid() is not null
    and sub.customer_id = auth.uid()
    and sub.payment_status = 'paid'
    and sub.confirmation_status <> 'rejected'
    and ac.maintenance_status not in ('suspended', 'retired')
  order by ac.id, sub.created_at desc;
$$;

revoke all on function public.private_share_my_public_access() from public, anon;
grant execute on function public.private_share_my_public_access() to authenticated;
