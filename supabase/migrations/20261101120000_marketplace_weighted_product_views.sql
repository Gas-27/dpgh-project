alter table public.store_products add column if not exists marketplace_view_count bigint not null default 0;
alter table public.public_store_products add column if not exists marketplace_view_count bigint not null default 0;

drop function if exists public.marketplace_product_view(uuid, text);
create or replace function public.marketplace_product_view(p_product_id uuid, p_source text default 'store')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count bigint;
begin
  if p_source = 'admin' then
    update public.public_store_products
    set marketplace_view_count = coalesce(marketplace_view_count, 0) + 1
    where id = p_product_id and active is true
    returning marketplace_view_count into next_count;
  else
    update public.store_products
    set marketplace_view_count = coalesce(marketplace_view_count, 0) + 1
    where id = p_product_id and status = 'active' and available is true
    returning marketplace_view_count into next_count;
  end if;
  return coalesce(next_count, 0);
end;
$$;
revoke all on function public.marketplace_product_view(uuid, text) from public;
grant execute on function public.marketplace_product_view(uuid, text) to anon, authenticated;

drop function if exists public.marketplace_products_page(text, integer, integer, text);
create function public.marketplace_products_page(p_search text default ''::text, p_page integer default 0, p_page_size integer default 18, p_sort text default 'newest'::text)
returns table(id uuid, title text, description text, price numeric, image_urls jsonb, created_at timestamptz, store_id uuid, store_kind text, boost_global boolean, boost_global_expires_at timestamptz, boost_sitewide boolean, boost_sitewide_expires_at timestamptz, total_count bigint, has_inline_image boolean, admin_boost boolean, marketplace_view_count bigint, view_weight integer)
language sql stable security definer set search_path = public as $function$
with params as (select greatest(1, least(coalesce(p_page_size,18),50)) size, greatest(coalesce(p_page,0),0) pg, coalesce(p_search,'') q, coalesce(p_sort,'newest') sort), light as (
 select sp.id,'store'::text src,sp.created_at,sp.price,sp.admin_boost,coalesce((sp.boost_global and sp.boost_global_expires_at > now()) or (sp.boost_sitewide and sp.boost_sitewide_expires_at > now()),false) boosted
 from public.store_products sp,params where sp.status='active' and sp.available=true and (params.q='' or sp.title ilike '%'||params.q||'%' or sp.description ilike '%'||params.q||'%')
 union all
 select ap.id,'admin'::text,ap.created_at,ap.price,ap.admin_boost,false from public.public_store_products ap,params where ap.active=true and (params.q='' or ap.title ilike '%'||params.q||'%' or ap.description ilike '%'||params.q||'%')
), paged as (select l.*,count(*) over() total_count,row_number() over(order by case when l.admin_boost then 0 else 1 end,case when (select sort from params)='price_asc' then l.price end asc nulls last,case when (select sort from params)='price_desc' then l.price end desc nulls last,case when (select sort from params) in ('price_asc','price_desc') then 0 when l.boosted then 0 else 1 end,l.created_at desc,l.id desc) rn from light l order by rn limit (select size from params) offset ((select pg from params)*(select size from params)))
select u.id,u.title,u.description,u.price,case when u.first_image is null or u.first_image like 'data:%' then '[]'::jsonb else jsonb_build_array(u.first_image) end,u.created_at,u.store_id,u.store_kind,u.boost_global,u.boost_global_expires_at,u.boost_sitewide,u.boost_sitewide_expires_at,u.total_count,coalesce(u.first_image like 'data:%',false),u.admin_boost,u.marketplace_view_count,case when u.admin_boost or u.boosted then 1006 else 562 end
from (select sp.id,sp.title,sp.description,sp.price,(sp.image_urls->>0) first_image,sp.created_at,sp.store_id,sp.store_kind,sp.boost_global,sp.boost_global_expires_at,sp.boost_sitewide,sp.boost_sitewide_expires_at,p.total_count,p.rn,sp.admin_boost,sp.marketplace_view_count,p.boosted from paged p join public.store_products sp on p.src='store' and sp.id=p.id union all select ap.id,ap.title,ap.description,ap.price,ap.image_urls[1],ap.created_at,null::uuid,'admin'::text,false,null::timestamptz,false,null::timestamptz,p.total_count,p.rn,ap.admin_boost,ap.marketplace_view_count,false from paged p join public.public_store_products ap on p.src='admin' and ap.id=p.id) u order by u.rn;
$function$;
grant execute on function public.marketplace_products_page(text, integer, integer, text) to anon, authenticated;
