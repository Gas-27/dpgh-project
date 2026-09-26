alter table public.sms_messages add column if not exists paystack_reference text;
alter table public.sms_messages add column if not exists sent_count integer not null default 0;
alter table public.sms_messages add column if not exists failed_count integer not null default 0;
create unique index if not exists sms_messages_paystack_reference_unique on public.sms_messages(paystack_reference) where paystack_reference is not null;
