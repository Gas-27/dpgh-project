-- Admin-posted notifications that pop up inside Game Hub.

create table if not exists public.gamehub_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1000),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists gamehub_announcements_active_idx on public.gamehub_announcements (active, created_at desc);

alter table public.gamehub_announcements enable row level security;
revoke all on public.gamehub_announcements from public, anon, authenticated;

create or replace function public.gamehub_active_announcements(p_limit integer default 5)
returns table (id uuid, title text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.title, a.body, a.created_at
  from public.gamehub_announcements a
  where a.active
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

revoke all on function public.gamehub_active_announcements(integer) from public;
grant execute on function public.gamehub_active_announcements(integer) to anon, authenticated;

create or replace function public.gamehub_admin_announcements()
returns table (id uuid, title text, body text, active boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return query
  select a.id, a.title, a.body, a.active, a.created_at
  from public.gamehub_announcements a
  order by a.created_at desc
  limit 100;
end;
$$;

create or replace function public.gamehub_admin_post_announcement(p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Title must be 1 to 120 characters' using errcode = '22023';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'Message must be 1 to 1000 characters' using errcode = '22023';
  end if;
  insert into public.gamehub_announcements (title, body, created_by)
  values (v_title, v_body, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.gamehub_admin_set_announcement(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  update public.gamehub_announcements set active = coalesce(p_active, false) where id = p_id;
end;
$$;

create or replace function public.gamehub_admin_delete_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  delete from public.gamehub_announcements where id = p_id;
end;
$$;

revoke all on function public.gamehub_admin_announcements(), public.gamehub_admin_post_announcement(text, text),
  public.gamehub_admin_set_announcement(uuid, boolean), public.gamehub_admin_delete_announcement(uuid) from public, anon;
grant execute on function public.gamehub_admin_announcements(), public.gamehub_admin_post_announcement(text, text),
  public.gamehub_admin_set_announcement(uuid, boolean), public.gamehub_admin_delete_announcement(uuid) to authenticated;
