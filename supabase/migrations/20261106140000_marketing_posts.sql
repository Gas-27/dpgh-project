-- Admin-written marketing posts that every agent, subagent and sub-subagent sees in their Marketing tab.

create table if not exists public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  caption text not null check (char_length(caption) between 1 and 1000),
  image_url text check (image_url is null or image_url ~ '^https://'),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_posts_active_idx on public.marketing_posts (active, created_at desc);

alter table public.marketing_posts enable row level security;
revoke all on public.marketing_posts from public, anon, authenticated;

create or replace function public.marketing_active_posts(p_limit integer default 10)
returns table (id uuid, title text, caption text, image_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.title, m.caption, m.image_url, m.created_at
  from public.marketing_posts m
  where m.active
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 30));
$$;

revoke all on function public.marketing_active_posts(integer) from public;
grant execute on function public.marketing_active_posts(integer) to authenticated;

create or replace function public.marketing_admin_posts()
returns table (id uuid, title text, caption text, image_url text, active boolean, created_at timestamptz)
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
  select m.id, m.title, m.caption, m.image_url, m.active, m.created_at
  from public.marketing_posts m
  order by m.created_at desc
  limit 100;
end;
$$;

create or replace function public.marketing_admin_save_post(p_id uuid, p_title text, p_caption text, p_image_url text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_image text := nullif(trim(coalesce(p_image_url, '')), '');
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_title, ''))) < 1 then raise exception 'Enter a title'; end if;
  if length(trim(coalesce(p_caption, ''))) < 1 then raise exception 'Enter the message agents should share'; end if;
  if v_image is not null and v_image !~ '^https://' then raise exception 'Image link must start with https://'; end if;
  if p_id is null then
    insert into public.marketing_posts (title, caption, image_url, created_by)
    values (trim(p_title), trim(p_caption), v_image, auth.uid())
    returning id into v_id;
  else
    update public.marketing_posts set title = trim(p_title), caption = trim(p_caption), image_url = v_image
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Post not found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.marketing_admin_set_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  update public.marketing_posts set active = p_active where id = p_id;
end;
$$;

create or replace function public.marketing_admin_delete_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wallet_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  delete from public.marketing_posts where id = p_id;
end;
$$;

revoke all on function public.marketing_admin_posts() from public, anon;
revoke all on function public.marketing_admin_save_post(uuid, text, text, text) from public, anon;
revoke all on function public.marketing_admin_set_active(uuid, boolean) from public, anon;
revoke all on function public.marketing_admin_delete_post(uuid) from public, anon;
grant execute on function public.marketing_admin_posts() to authenticated;
grant execute on function public.marketing_admin_save_post(uuid, text, text, text) to authenticated;
grant execute on function public.marketing_admin_set_active(uuid, boolean) to authenticated;
grant execute on function public.marketing_admin_delete_post(uuid) to authenticated;
