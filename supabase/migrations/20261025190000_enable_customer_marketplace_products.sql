alter table public.store_products drop constraint if exists store_products_store_kind_check;
alter table public.store_products add constraint store_products_store_kind_check check (store_kind = any (array['customer'::text, 'agent'::text, 'subagent'::text, 'subsubagent'::text]));

create index if not exists store_products_customer_store_idx on public.store_products (store_kind, store_id, created_at desc);
