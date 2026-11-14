-- Admin-configurable target level, life price and reward per Game Hub game; Nail Hit and Cut & Score;
-- guest (signed-out) comments and reports on marketplace posts.

alter table public.gamehub_game_settings
  add column if not exists target_level integer,
  add column if not exists max_level integer,
  add column if not exists life_price numeric not null default 4 check (life_price > 0),
  add column if not exists initial_lives integer not null default 2 check (initial_lives between 1 and 10),
  add column if not exists required_seconds integer;

insert into public.gamehub_game_settings (game_id, title, reward_gb) values
  ('nail-hit', 'Nail Hit', 10),
  ('cut-score', 'Cut & Score', 25)
on conflict (game_id) do nothing;

update public.gamehub_game_settings set target_level = 12, max_level = 30 where game_id = 'cup-shuffle' and target_level is null;
update public.gamehub_game_settings set target_level = 20, max_level = 40 where game_id = 'snap-fit' and target_level is null;
update public.gamehub_game_settings set target_level = 1, max_level = 1, initial_lives = 1, required_seconds = 600 where game_id = 'basketball' and target_level is null;
update public.gamehub_game_settings set target_level = 12, max_level = 24 where game_id = 'nail-hit' and target_level is null;
update public.gamehub_game_settings set target_level = 24, max_level = 24 where game_id = 'cut-score' and target_level is null;

-- Rules now come from the settings table --------------------------------------
create or replace function public.gamehub_target_level(p_game_id text)
returns integer language sql stable security definer set search_path = public as $$
  select s.target_level from public.gamehub_game_settings s where s.game_id = p_game_id;
$$;

create or replace function public.gamehub_required_seconds(p_game_id text)
returns integer language sql stable security definer set search_path = public as $$
  select s.required_seconds from public.gamehub_game_settings s where s.game_id = p_game_id;
$$;

create or replace function public.gamehub_initial_lives(p_game_id text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select s.initial_lives from public.gamehub_game_settings s where s.game_id = p_game_id), 2);
$$;

create or replace function public.gamehub_life_price(p_game_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select s.life_price from public.gamehub_game_settings s where s.game_id = p_game_id), 4);
$$;

create or replace function public.gamehub_min_seconds(p_game_id text, p_level integer)
returns numeric language sql immutable as $$
  select case p_game_id
    when 'cup-shuffle' then (array[9, 9, 10, 11, 11, 10, 13, 13, 14, 13, 14, 15])[least(greatest(p_level, 1), 12)]::numeric
    when 'snap-fit' then 1.6
    when 'nail-hit' then greatest(3, 0.3 * case when p_level % 5 = 0 or p_level = 12 then 10 else least(6 + p_level, 12) end)
    when 'cut-score' then 3
    else 3600
  end;
$$;

create or replace function public.gamehub_run_json(r public.gamehub_runs)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'run_id', r.id,
    'game_id', r.game_id,
    'level', r.level,
    'lives', r.lives,
    'status', r.status,
    'target', public.gamehub_target_level(r.game_id),
    'lives_bought', r.lives_bought,
    'claimed', r.claimed,
    'reward_claimed', exists (select 1 from public.gamehub_claims c where c.user_id = r.user_id and c.game_id = r.game_id),
    'life_price', public.gamehub_life_price(r.game_id),
    'reward_gb', coalesce((select s.reward_gb from public.gamehub_game_settings s where s.game_id = r.game_id), 5),
    'reward_enabled', coalesce((select s.enabled from public.gamehub_game_settings s where s.game_id = r.game_id), true),
    'required_seconds', public.gamehub_required_seconds(r.game_id),
    'play_seconds', floor(r.play_seconds)
  );
$$;

create or replace function public.gamehub_buy_life(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  w jsonb;
  v_price numeric;
  v_balance numeric;
begin
  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception 'Game session not found'; end if;
  if r.status <> 'active' then raise exception 'This game session is no longer active'; end if;
  if r.lives > 0 then raise exception 'You still have lives left'; end if;

  v_price := public.gamehub_life_price(r.game_id);
  w := public.gamehub_resolve_wallet(r.wallet_hint);
  if w is null then raise exception 'No wallet found for this account'; end if;
  if (w ->> 'balance')::numeric < v_price then
    raise exception 'Insufficient wallet balance. Top up GH₵% to buy a life', v_price;
  end if;

  perform public.wallet_apply_internal(
    w ->> 'owner_type', (w ->> 'owner_id')::uuid, -v_price, 'gamehub_life',
    r.id::text || ':' || (r.lives_bought + 1)::text, 'Game Hub extra life (' || r.game_id || ')', auth.uid()
  );
  update public.gamehub_runs set lives = 1, lives_bought = lives_bought + 1, updated_at = now() where id = r.id returning * into r;
  v_balance := public.gamehub_wallet_balance(r.wallet_hint);
  return jsonb_build_object('run', public.gamehub_run_json(r), 'balance', v_balance);
end $$;

-- Admin ------------------------------------------------------------------------
create or replace function public.admin_set_gamehub_rules(
  p_game_id text,
  p_gb numeric,
  p_enabled boolean,
  p_target_level integer,
  p_life_price numeric,
  p_required_seconds integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.gamehub_game_settings;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  select * into s from public.gamehub_game_settings where game_id = p_game_id;
  if not found then raise exception 'Unknown game'; end if;
  if p_gb is null or p_gb <= 0 then raise exception 'Enter a reward size above 0 GB'; end if;
  if p_life_price is null or p_life_price <= 0 or p_life_price > 500 then raise exception 'Enter a life price between GH₵0.01 and GH₵500'; end if;
  if s.required_seconds is null then
    if p_target_level is null or p_target_level < 1 or p_target_level > coalesce(s.max_level, 1) then
      raise exception 'Level must be between 1 and % for this game', coalesce(s.max_level, 1);
    end if;
  else
    if p_required_seconds is null or p_required_seconds < 30 or p_required_seconds > 3600 then
      raise exception 'Play time must be between 30 seconds and 60 minutes';
    end if;
  end if;
  if not exists (select 1 from public.data_packages where lower(network) = 'mtn' and size_gb = p_gb and active = true) then
    raise exception 'There is no active MTN % GB package. Pick a size that exists in your MTN packages', p_gb;
  end if;
  update public.gamehub_game_settings
    set reward_gb = p_gb,
        enabled = coalesce(p_enabled, true),
        life_price = p_life_price,
        target_level = case when required_seconds is null then p_target_level else target_level end,
        required_seconds = case when required_seconds is null then null else p_required_seconds end,
        updated_at = now(), updated_by = auth.uid()
    where game_id = p_game_id returning * into s;
  return to_jsonb(s);
end $$;

revoke all on function
  public.gamehub_target_level(text),
  public.gamehub_required_seconds(text),
  public.gamehub_initial_lives(text),
  public.gamehub_life_price(text),
  public.admin_set_gamehub_rules(text, numeric, boolean, integer, numeric, integer)
from public, anon;
grant execute on function public.admin_set_gamehub_rules(text, numeric, boolean, integer, numeric, integer) to authenticated;

-- Marketplace: guests can comment and report ----------------------------------
alter table public.marketplace_product_reports
  alter column reporter_id drop not null,
  add column if not exists reporter_key text;
create unique index if not exists marketplace_reports_guest_unique
  on public.marketplace_product_reports (product_id, reporter_key) where reporter_key is not null;

alter table public.marketplace_product_comments
  alter column user_id drop not null,
  add column if not exists guest_key text;
create index if not exists marketplace_comments_guest_key_idx
  on public.marketplace_product_comments (guest_key, created_at desc) where guest_key is not null;

create or replace function public.set_marketplace_comment_author()
returns trigger language plpgsql security definer set search_path = '' as $$
declare resolved text;
begin
  new.user_id := (select auth.uid());
  if new.user_id is null then
    new.author_name := coalesce(nullif(btrim(new.author_name), ''), 'Guest');
    new.body := btrim(new.body);
    return new;
  end if;
  select s.store_name into resolved from public.agent_stores s where s.user_id = new.user_id limit 1;
  if resolved is null then select s.store_name into resolved from public.subagent_stores s where s.user_id = new.user_id limit 1; end if;
  if resolved is null then select s.store_name into resolved from public.sub_subagent_stores s where s.user_id = new.user_id limit 1; end if;
  if resolved is null then select p.full_name into resolved from public.profiles p where p.id = new.user_id; end if;
  new.author_name := coalesce(nullif(btrim(resolved), ''), 'Member');
  new.body := btrim(new.body);
  return new;
end $$;

create or replace function public.post_guest_marketplace_comment(p_product_id uuid, p_body text, p_guest_name text, p_guest_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := left(btrim(regexp_replace(coalesce(p_guest_name, ''), '[^[:alnum:] _.-]', '', 'g')), 30);
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is not null then raise exception 'Signed-in members comment with their account'; end if;
  if p_guest_key is null or length(p_guest_key) < 16 or length(p_guest_key) > 80 then raise exception 'Could not verify this device. Refresh and try again'; end if;
  if length(v_body) < 1 or length(v_body) > 500 then raise exception 'Comments must be 1 to 500 characters'; end if;
  if not exists (select 1 from public.store_products where id = p_product_id) then raise exception 'Post not found'; end if;
  if (select count(*) from public.marketplace_product_comments where guest_key = p_guest_key and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You are commenting too fast. Please wait a little and try again';
  end if;
  insert into public.marketplace_product_comments (product_id, author_name, body, guest_key)
    values (p_product_id, case when v_name = '' then 'Guest' else v_name || ' (guest)' end, v_body, p_guest_key);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.submit_guest_marketplace_report(p_product_id uuid, p_reason text, p_offers_site_service boolean, p_note text, p_guest_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is not null then raise exception 'Signed-in members report with their account'; end if;
  if p_guest_key is null or length(p_guest_key) < 16 or length(p_guest_key) > 80 then raise exception 'Could not verify this device. Refresh and try again'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 200 then raise exception 'Choose a reason for the report'; end if;
  if p_note is not null and length(p_note) > 1000 then raise exception 'Note is too long'; end if;
  if not exists (select 1 from public.store_products where id = p_product_id) then raise exception 'Post not found'; end if;
  if (select count(*) from public.marketplace_product_reports where reporter_key = p_guest_key and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily report limit reached. Our team is reviewing your earlier reports';
  end if;
  insert into public.marketplace_product_reports (product_id, reporter_id, reporter_key, reason, offers_site_service, note)
    values (p_product_id, null, p_guest_key, btrim(p_reason), coalesce(p_offers_site_service, false), nullif(btrim(coalesce(p_note, '')), ''))
    on conflict do nothing returning id into v_id;
  return jsonb_build_object('ok', true, 'duplicate', v_id is null);
end $$;

revoke all on function public.post_guest_marketplace_comment(uuid, text, text, text), public.submit_guest_marketplace_report(uuid, text, boolean, text, text) from public;
grant execute on function public.post_guest_marketplace_comment(uuid, text, text, text), public.submit_guest_marketplace_report(uuid, text, boolean, text, text) to anon, authenticated;
