
-- Create role enum
create type public.app_role as enum ('admin', 'agent', 'user');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- User roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer function for role checks
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- Data packages table
create table public.data_packages (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('mtn', 'airteltigo', 'telecel')),
  size_gb numeric not null,
  price numeric not null default 0,
  agent_price numeric not null default 0,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.data_packages enable row level security;

-- Agent stores table
create table public.agent_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  store_name text not null,
  whatsapp_number text not null,
  support_number text not null,
  whatsapp_group text,
  momo_number text not null,
  momo_name text not null,
  momo_network text not null check (momo_network in ('mtn', 'airteltigo', 'telecel')),
  approved boolean default false,
  created_at timestamptz default now()
);
alter table public.agent_stores enable row level security;

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');

  insert into public.user_roles (user_id, role)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::app_role, 'user'));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS Policies

-- Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles for select using (public.has_role(auth.uid(), 'admin'));

-- User roles
create policy "Users can view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins can view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can insert roles" on public.user_roles for insert with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update roles" on public.user_roles for update using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete roles" on public.user_roles for delete using (public.has_role(auth.uid(), 'admin'));

-- Data packages: public read, admin manage
create policy "Anyone can view active packages" on public.data_packages for select to anon, authenticated using (active = true);
create policy "Admins can view all packages" on public.data_packages for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can insert packages" on public.data_packages for insert with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update packages" on public.data_packages for update using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete packages" on public.data_packages for delete using (public.has_role(auth.uid(), 'admin'));

-- Agent stores
create policy "Agents can view own store" on public.agent_stores for select using (auth.uid() = user_id);
create policy "Agents can create own store" on public.agent_stores for insert with check (auth.uid() = user_id);
create policy "Agents can update own store" on public.agent_stores for update using (auth.uid() = user_id);
create policy "Admins can view all stores" on public.agent_stores for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update all stores" on public.agent_stores for update using (public.has_role(auth.uid(), 'admin'));
