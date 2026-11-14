-- Game Hub claim fee: players who won without spending anything on Game Hub
-- (no wallet lives, wallet items or store chance packs) pay GH₵4 from their wallet to claim.
-- Players who have spent at least once claim for free. The rule is only revealed at claim time.

alter function public.gamehub_claim_reward(uuid, text) rename to gamehub_claim_reward_core;
revoke all on function public.gamehub_claim_reward_core(uuid, text) from public, anon, authenticated;

create or replace function public.gamehub_has_spent(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.wallet_ledger l
      where l.actor_id = p_user_id
        and l.kind in ('gamehub_life', 'gamehub_item', 'gamehub_archery_item')
        and l.delta < 0
    )
    or exists (
      select 1 from public.gamehub_chance_orders co
      where co.user_id = p_user_id and co.applied
    );
$$;

create or replace function public.gamehub_claim_reward(p_run_id uuid, p_phone text, p_pay_fee boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.gamehub_runs;
  w jsonb;
  v_fee constant numeric := 4;
begin
  if auth.uid() is null then raise exception 'Sign in to claim your reward'; end if;

  select * into r from public.gamehub_runs where id = p_run_id and user_id = auth.uid() for update;
  if found and r.status = 'cleared' and not r.claimed and not public.gamehub_has_spent(auth.uid()) then
    if not coalesce(p_pay_fee, false) then
      raise exception 'CLAIM_FEE_REQUIRED';
    end if;
    w := public.gamehub_resolve_wallet(r.wallet_hint);
    if w is null then raise exception 'No wallet found for this account'; end if;
    if (w ->> 'balance')::numeric < v_fee then
      raise exception 'Insufficient wallet balance. Top up GH₵% to claim your reward', v_fee;
    end if;
    perform public.wallet_apply_internal(
      w ->> 'owner_type', (w ->> 'owner_id')::uuid, -v_fee, 'gamehub_item',
      r.game_id || ':claim-fee:' || r.id::text, 'Game Hub claim fee (' || r.game_id || ')', auth.uid()
    );
  end if;

  return public.gamehub_claim_reward_core(p_run_id, p_phone);
end $$;

revoke all on function public.gamehub_claim_reward(uuid, text, boolean) from public, anon;
grant execute on function public.gamehub_claim_reward(uuid, text, boolean) to authenticated;
