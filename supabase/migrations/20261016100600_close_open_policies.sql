-- Close policies that let the anonymous role read or write money tables.
-- service_role bypasses RLS, so edge functions are unaffected.

-- wallet top-ups
drop policy if exists "Allow all for wallet_topups" on public.wallet_topups;
drop policy if exists "Allow service role for topups" on public.wallet_topups;
drop policy if exists "Service role can manage wallet_topups" on public.wallet_topups;
drop policy if exists "wallet_topups_admin_all" on public.wallet_topups;
create policy "wallet_topups_admin_all" on public.wallet_topups
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Allow all for subagent_wallet_topups" on public.subagent_wallet_topups;
drop policy if exists "Allow service role for subagent topups" on public.subagent_wallet_topups;
drop policy if exists "Service can update subagent topups" on public.subagent_wallet_topups;
drop policy if exists "subagent_wallet_topups_admin_all" on public.subagent_wallet_topups;
drop policy if exists "subagent_wallet_topups_parent_agent_select" on public.subagent_wallet_topups;
create policy "subagent_wallet_topups_admin_all" on public.subagent_wallet_topups
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
create policy "subagent_wallet_topups_parent_agent_select" on public.subagent_wallet_topups
  for select to authenticated
  using (exists (
    select 1 from public.subagent_stores s
    join public.agent_stores a on a.id = s.agent_store_id
    where s.id = subagent_wallet_topups.subagent_store_id and a.user_id = auth.uid()
  ));

drop policy if exists "sub_subagent_topups_insert" on public.sub_subagent_wallet_topups;
drop policy if exists "sub_subagent_wallet_topups_admin_all" on public.sub_subagent_wallet_topups;
drop policy if exists "sub_subagent_wallet_topups_parent_select" on public.sub_subagent_wallet_topups;
create policy "sub_subagent_wallet_topups_admin_all" on public.sub_subagent_wallet_topups
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
create policy "sub_subagent_wallet_topups_parent_select" on public.sub_subagent_wallet_topups
  for select to authenticated
  using (exists (
    select 1 from public.sub_subagent_stores ss
    join public.subagent_stores s on s.id = ss.subagent_store_id
    left join public.agent_stores a on a.id = s.agent_store_id
    where ss.id = sub_subagent_wallet_topups.sub_subagent_store_id
      and (s.user_id = auth.uid() or a.user_id = auth.uid())
  ));

-- payouts, payments, USSD sessions (server-only)
drop policy if exists "Service role has full access" on public.payout_requests;
drop policy if exists "Service role has full access" on public.ussd_sessions;
drop policy if exists "Anyone can insert payments" on public.payments;
drop policy if exists "Anyone can select payments" on public.payments;
drop policy if exists "Anyone can update payments" on public.payments;
drop policy if exists "Anyone can view payments" on public.payments;
drop policy if exists "payments_admin_select" on public.payments;
create policy "payments_admin_select" on public.payments
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- admin-only tables
drop policy if exists "admin_update_api_errors" on public.api_error_logs;
drop policy if exists "admin_view_api_errors" on public.api_error_logs;
create policy "admin_update_api_errors" on public.api_error_logs
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));
create policy "admin_view_api_errors" on public.api_error_logs
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "afa_settings_insert" on public.afa_settings;
drop policy if exists "afa_settings_update" on public.afa_settings;
create policy "afa_settings_insert" on public.afa_settings
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::app_role));
create policy "afa_settings_update" on public.afa_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "admin_all_data" on public.agent_special_mtn_mashup_pricing;
drop policy if exists "mashup_pricing_owner_or_admin" on public.agent_special_mtn_mashup_pricing;
create policy "mashup_pricing_owner_or_admin" on public.agent_special_mtn_mashup_pricing
  for all to authenticated
  using (agent_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role))
  with check (agent_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "admins_can_delete_subagents" on public.subagent_stores;
create policy "admins_can_delete_subagents" on public.subagent_stores
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "subagent_notifications_all" on public.subagent_notifications;
create policy "subagent_notifications_all" on public.subagent_notifications
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from public.subagent_stores s
               where s.id = subagent_notifications.subagent_store_id and s.user_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from public.subagent_stores s
               where s.id = subagent_notifications.subagent_store_id and s.user_id = auth.uid())
  );

-- RLS does not govern these privileges, and no client needs them
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
