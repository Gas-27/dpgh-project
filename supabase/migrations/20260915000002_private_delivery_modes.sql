alter table public.digital_services
  add column if not exists private_delivery_mode text not null default 'whatsapp';

alter table public.digital_services
  drop constraint if exists digital_services_private_delivery_mode_check;

alter table public.digital_services
  add constraint digital_services_private_delivery_mode_check
  check (private_delivery_mode in ('whatsapp', 'onsite'));

alter table public.private_share_subscriptions
  add column if not exists delivery_mode text;

alter table public.private_share_subscriptions
  add column if not exists wallet_order_id uuid;

alter table public.private_share_subscriptions
  drop constraint if exists private_share_subscriptions_delivery_mode_check;

alter table public.private_share_subscriptions
  add constraint private_share_subscriptions_delivery_mode_check
  check (delivery_mode is null or delivery_mode in ('whatsapp', 'onsite'));
