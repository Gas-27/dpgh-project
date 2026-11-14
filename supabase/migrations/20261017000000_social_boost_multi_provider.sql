-- Social Boost multi-provider routing.
-- Admins choose a default provider, optionally pin individual services to a provider, and map each
-- local service ID to the matching service ID at that provider (providers number services differently).
-- API keys never live in the database: each provider only stores the NAME of the edge-function secret.

create table if not exists public.social_boost_providers (
  id text primary key,
  label text not null,
  api_url text not null,
  api_key_env text not null,
  enabled boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint social_boost_default_must_be_enabled check (not (is_default and not enabled))
);

create unique index if not exists social_boost_providers_single_default
  on public.social_boost_providers (is_default) where is_default;

insert into public.social_boost_providers (id, label, api_url, api_key_env, enabled, is_default, sort_order) values
  ('exoboost', 'ExoBoost', 'https://exosupplier.com/api/v2', 'EXOBOOST_API_KEY', true, true, 1),
  ('gainrealgrowth', 'GainRealGrowth', 'https://gainrealgrowth.com/api/v2', 'GAINREALGROWTH_API_KEY', true, false, 2)
on conflict (id) do nothing;

-- null = follow whichever provider is the current default.
alter table public.social_boost_service_pricing
  add column if not exists provider text references public.social_boost_providers(id) on update cascade on delete set null;

-- Which provider fulfilled the order. null = legacy order fulfilled by ExoBoost.
alter table public.social_boost_orders
  add column if not exists provider text references public.social_boost_providers(id) on update cascade on delete set null;

create table if not exists public.social_boost_service_routes (
  service_id bigint not null,
  provider_id text not null references public.social_boost_providers(id) on update cascade on delete cascade,
  provider_service_id text not null check (provider_service_id ~ '^[0-9]+$'),
  updated_at timestamptz not null default now(),
  primary key (service_id, provider_id)
);

alter table public.social_boost_providers enable row level security;
alter table public.social_boost_service_routes enable row level security;

drop policy if exists "Admins manage social boost providers" on public.social_boost_providers;
create policy "Admins manage social boost providers" on public.social_boost_providers
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins manage social boost service routes" on public.social_boost_service_routes;
create policy "Admins manage social boost service routes" on public.social_boost_service_routes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Atomically moves the default flag so there is never zero or two defaults.
create or replace function public.set_default_social_boost_provider(p_provider_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.social_boost_providers where id = p_provider_id and enabled) then
    raise exception 'Provider is missing or turned off';
  end if;
  update public.social_boost_providers set is_default = false, updated_at = now()
    where is_default and id <> p_provider_id;
  update public.social_boost_providers set is_default = true, updated_at = now()
    where id = p_provider_id;
end;
$$;

revoke all on function public.set_default_social_boost_provider(text) from public, anon;
grant execute on function public.set_default_social_boost_provider(text) to authenticated;
