alter table public.spin_config
  add column if not exists eligibility_mode text not null default 'unrestricted' check (eligibility_mode in ('unrestricted', 'order_count', 'order_amount')),
  add column if not exists eligibility_period text not null default 'day' check (eligibility_period in ('day', 'week')),
  add column if not exists minimum_order_count integer not null default 0 check (minimum_order_count >= 0),
  add column if not exists minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  add column if not exists placement_targets jsonb not null default '["packages","agent","subagent","subsubagent"]'::jsonb;

update public.spin_config
set placement_targets = '["packages","agent","subagent","subsubagent"]'::jsonb
where placement_targets is null;

comment on column public.spin_config.eligibility_mode is 'Controls whether Spin to Win is unrestricted, order-count gated, or order-amount gated.';
comment on column public.spin_config.eligibility_period is 'Completed-order eligibility window: day or calendar week.';
comment on column public.spin_config.placement_targets is 'Storefront surfaces where Spin to Win is visible.';
