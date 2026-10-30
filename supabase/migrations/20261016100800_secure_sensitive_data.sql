-- Keep customer submissions possible, but never expose submitted PII or attachments publicly.
revoke select on public.afa_registrations, public.afa_registration_reports, public.complaints from anon;
revoke update, delete on public.afa_registrations, public.afa_registration_reports, public.complaints from anon;

-- Storefront tracking remains available through the existing narrow RPCs.
