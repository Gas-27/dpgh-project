create table if not exists public.public_store_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  image_urls text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_store_products enable row level security;

drop policy if exists "Public can view active products" on public.public_store_products;
create policy "Public can view active products" on public.public_store_products for select to anon, authenticated using (active = true);

drop policy if exists "Admins manage public products" on public.public_store_products;
create policy "Admins manage public products" on public.public_store_products for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select on public.public_store_products to anon, authenticated;
grant insert, update, delete on public.public_store_products to authenticated;
