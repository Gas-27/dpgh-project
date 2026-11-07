-- Lets a signed-in user or agent delete their own API key. The api_users row is kept
-- (partner_api_purchases references it), so the key is replaced with an unusable
-- "revoked_" value, the API wallet is cleared and the row is deactivated.

create or replace function public.delete_my_api_key()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.api_users;
  v_cleared numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_row from public.api_users where identity_id = auth.uid() for update;
  if not found or v_row.api_key like 'revoked\_%' then
    raise exception 'no_api_key' using errcode = 'P0002';
  end if;

  v_cleared := coalesce(v_row.wallet, 0) + coalesce(v_row.api_wallet, 0);

  update public.api_users
  set api_key = 'revoked_' || replace(gen_random_uuid()::text, '-', ''),
      wallet = 0,
      api_wallet = 0,
      active = false,
      updated_at = now()
  where id = v_row.id;

  return v_cleared;
end $$;

revoke all on function public.delete_my_api_key() from public, anon;
grant execute on function public.delete_my_api_key() to authenticated;

-- Generating a new key after deleting one re-activates the account (the edge function only rotates api_key).
create or replace function public.api_users_reactivate_on_new_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.api_key like 'revoked\_%' and new.api_key not like 'revoked\_%' then
    new.active := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_api_users_reactivate_on_new_key on public.api_users;
create trigger trg_api_users_reactivate_on_new_key
  before update of api_key on public.api_users
  for each row execute function public.api_users_reactivate_on_new_key();
