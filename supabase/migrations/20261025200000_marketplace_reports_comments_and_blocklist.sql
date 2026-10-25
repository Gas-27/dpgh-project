-- Marketplace safety: reports, comments, prohibited-service blocklist, and admin moderation RPCs.

create or replace function public.is_marketplace_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
      or exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role);
$$;

revoke execute on function public.is_marketplace_admin() from public, anon;
grant execute on function public.is_marketplace_admin() to authenticated;

-- Reports -------------------------------------------------------------------
create table if not exists public.marketplace_product_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  reporter_id uuid not null default auth.uid(),
  reason text not null check (char_length(reason) between 1 and 200),
  offers_site_service boolean not null default false,
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (product_id, reporter_id)
);

alter table public.marketplace_product_reports enable row level security;

drop policy if exists "reports_insert_own" on public.marketplace_product_reports;
create policy "reports_insert_own" on public.marketplace_product_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

drop policy if exists "reports_select_own" on public.marketplace_product_reports;
create policy "reports_select_own" on public.marketplace_product_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

grant select, insert on public.marketplace_product_reports to authenticated;

-- Comments ------------------------------------------------------------------
create table if not exists public.marketplace_product_comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  author_name text not null default 'Member',
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_product_comments_product_idx
  on public.marketplace_product_comments (product_id, created_at desc);

alter table public.marketplace_product_comments enable row level security;

drop policy if exists "comments_public_read" on public.marketplace_product_comments;
create policy "comments_public_read" on public.marketplace_product_comments
  for select to anon, authenticated using (true);

drop policy if exists "comments_insert_own" on public.marketplace_product_comments;
create policy "comments_insert_own" on public.marketplace_product_comments
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "comments_delete_own_or_admin" on public.marketplace_product_comments;
create policy "comments_delete_own_or_admin" on public.marketplace_product_comments
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_marketplace_admin());

grant select on public.marketplace_product_comments to anon, authenticated;
grant insert, delete on public.marketplace_product_comments to authenticated;

-- The display name is derived server-side so a commenter cannot impersonate someone else.
create or replace function public.set_marketplace_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved text;
begin
  new.user_id := (select auth.uid());
  select s.store_name into resolved from public.agent_stores s where s.user_id = new.user_id limit 1;
  if resolved is null then select s.store_name into resolved from public.subagent_stores s where s.user_id = new.user_id limit 1; end if;
  if resolved is null then select s.store_name into resolved from public.sub_subagent_stores s where s.user_id = new.user_id limit 1; end if;
  if resolved is null then select p.full_name into resolved from public.profiles p where p.id = new.user_id; end if;
  new.author_name := coalesce(nullif(btrim(resolved), ''), 'Member');
  new.body := btrim(new.body);
  return new;
end;
$$;

revoke execute on function public.set_marketplace_comment_author() from public, anon, authenticated;

drop trigger if exists marketplace_comment_author on public.marketplace_product_comments;
create trigger marketplace_comment_author
  before insert on public.marketplace_product_comments
  for each row execute function public.set_marketplace_comment_author();

-- Prohibited-service blocklist (server-side enforcement) ----------------------
create or replace function public.block_prohibited_product_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hit text;
begin
  if tg_op = 'INSERT' or new.title is distinct from old.title or new.description is distinct from old.description then
    hit := substring(
      lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''))
      from '\m(cheap data|data|airtime|subscriptions?|afa[ -]registration|afa|bulk[ -]sms|ussd|netflix|social[ -]boost)\M'
    );
    if hit is not null then
      raise exception 'PROHIBITED_SERVICE:%', hit using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists store_products_block_prohibited on public.store_products;
create trigger store_products_block_prohibited
  before insert or update on public.store_products
  for each row execute function public.block_prohibited_product_terms();

-- Admin moderation RPCs --------------------------------------------------------
create or replace function public.admin_list_reported_products()
returns table (
  report_id uuid,
  product_id uuid,
  product_title text,
  product_description text,
  product_price numeric,
  product_images jsonb,
  product_status text,
  reason text,
  offers_site_service boolean,
  note text,
  report_status text,
  reported_at timestamptz,
  report_count bigint,
  poster_account_type text,
  poster_store_name text,
  poster_topup_reference text,
  poster_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_marketplace_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    r.id,
    p.id,
    p.title,
    p.description,
    p.price,
    p.image_urls,
    p.status,
    r.reason,
    r.offers_site_service,
    r.note,
    r.status,
    r.created_at,
    (select count(*) from public.marketplace_product_reports x where x.product_id = p.id),
    case p.store_kind
      when 'agent' then 'Agent'
      when 'subagent' then 'Subagent'
      when 'subsubagent' then 'Sub-subagent'
      else 'User'
    end,
    case p.store_kind
      when 'agent' then (select s.store_name from public.agent_stores s where s.id = p.store_id)
      when 'subagent' then (select s.store_name from public.subagent_stores s where s.id = p.store_id)
      when 'subsubagent' then (select s.store_name from public.sub_subagent_stores s where s.id = p.store_id)
      else null
    end,
    case p.store_kind
      when 'agent' then (select s.topup_reference from public.agent_stores s where s.id = p.store_id)
      when 'subagent' then (select s.topup_reference from public.subagent_stores s where s.id = p.store_id)
      when 'subsubagent' then (select s.topup_reference from public.sub_subagent_stores s where s.id = p.store_id)
      else (select c.topup_reference from public.customers c where c.user_id = p.store_id limit 1)
    end,
    case p.store_kind
      when 'agent' then (select s.email from public.agent_stores s where s.id = p.store_id)
      when 'subagent' then (select s.email from public.subagent_stores s where s.id = p.store_id)
      when 'subsubagent' then (select s.email from public.sub_subagent_stores s where s.id = p.store_id)
      else (select c.email from public.customers c where c.user_id = p.store_id limit 1)
    end
  from public.marketplace_product_reports r
  join public.store_products p on p.id = r.product_id
  order by (r.status = 'open') desc, r.created_at desc;
end;
$$;

create or replace function public.admin_delete_reported_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_marketplace_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.store_products where id = p_product_id;
end;
$$;

create or replace function public.admin_dismiss_product_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_marketplace_admin() then
    raise exception 'Not authorized';
  end if;
  update public.marketplace_product_reports set status = 'dismissed' where id = p_report_id;
end;
$$;

revoke execute on function public.admin_list_reported_products() from public, anon;
revoke execute on function public.admin_delete_reported_product(uuid) from public, anon;
revoke execute on function public.admin_dismiss_product_report(uuid) from public, anon;
grant execute on function public.admin_list_reported_products() to authenticated;
grant execute on function public.admin_delete_reported_product(uuid) to authenticated;
grant execute on function public.admin_dismiss_product_report(uuid) to authenticated;
