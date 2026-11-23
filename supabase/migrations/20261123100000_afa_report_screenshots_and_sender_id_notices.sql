-- 1) Screenshot bucket used by the AFA report form and the order chatbot.
--    Visitors reporting an AFA registration are usually not signed in, so the
--    upload failed with "new row violates row-level security policy".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-screenshots',
  'complaint-screenshots',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = true;

drop policy if exists "Report screenshots can be uploaded" on storage.objects;
create policy "Report screenshots can be uploaded"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'complaint-screenshots'
    and (name like 'afa-reports/%' or name like 'chatbot/%')
  );

-- 2) One-time "your sender ID was approved" notice.
alter table public.sms_sender_ids
  add column if not exists approval_seen_at timestamptz;

-- Sender IDs approved before this notice existed should not pop up.
update public.sms_sender_ids
set approval_seen_at = now()
where status = 'approved' and approval_seen_at is null;

create or replace function public.reset_sender_id_approval_notice()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approval_seen_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sms_sender_ids_reset_approval_notice on public.sms_sender_ids;
create trigger sms_sender_ids_reset_approval_notice
  before update of status on public.sms_sender_ids
  for each row execute function public.reset_sender_id_approval_notice();

create or replace function public.my_unseen_approved_sender_ids()
returns table (id uuid, sender_id text)
language sql
security definer
set search_path = public
as $$
  select s.id, s.sender_id
  from public.sms_sender_ids s
  where s.user_id = auth.uid()
    and s.status = 'approved'
    and coalesce(s.is_global, false) = false
    and s.approval_seen_at is null
  order by s.created_at;
$$;

create or replace function public.mark_sender_ids_approval_seen(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.sms_sender_ids
  set approval_seen_at = now()
  where id = any(p_ids)
    and user_id = auth.uid()
    and approval_seen_at is null;
$$;

revoke all on function public.my_unseen_approved_sender_ids() from public, anon;
revoke all on function public.mark_sender_ids_approval_seen(uuid[]) from public, anon;
grant execute on function public.my_unseen_approved_sender_ids() to authenticated;
grant execute on function public.mark_sender_ids_approval_seen(uuid[]) to authenticated;
