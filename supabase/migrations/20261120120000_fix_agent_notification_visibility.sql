-- Storefront visitors must be able to read active, non-expired notices an agent posted for their store.
drop policy if exists "Anyone can view active agent notifications" on public.agent_notifications;
create policy "Anyone can view active agent notifications"
  on public.agent_notifications
  for select
  to anon, authenticated
  using (is_active is true and (expires_at is null or expires_at > now()));

-- Subagents must be able to read notices sent by the agent they belong to.
drop policy if exists "Subagents can view their agent notifications" on public.agent_to_subagent_notifications;
create policy "Subagents can view their agent notifications"
  on public.agent_to_subagent_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.subagent_stores ss
      where ss.agent_store_id = agent_to_subagent_notifications.agent_store_id
        and ss.user_id = (select auth.uid())
    )
  );
