alter table public.data_packages add column if not exists view_count bigint not null default 0;
create or replace function public.increment_data_package_view(p_package_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare next_count bigint;
begin
  update public.data_packages set view_count = coalesce(view_count, 0) + 1 where id = p_package_id and active is true returning view_count into next_count;
  return next_count;
end; $$;
revoke all on function public.increment_data_package_view(uuid) from public;
grant execute on function public.increment_data_package_view(uuid) to anon, authenticated;
