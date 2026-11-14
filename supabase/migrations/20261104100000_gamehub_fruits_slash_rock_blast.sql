-- Fruits Slash (stage 12) and Rock Blast (stage 17) reward games, 5GB each.

insert into public.gamehub_game_settings (game_id, title, reward_gb) values
  ('fruits-slash', 'Fruits Slash', 5),
  ('rock-blast', 'Rock Blast', 5)
on conflict (game_id) do nothing;

update public.gamehub_game_settings set target_level = 12, max_level = 24 where game_id = 'fruits-slash' and target_level is null;
update public.gamehub_game_settings set target_level = 17, max_level = 20 where game_id = 'rock-blast' and target_level is null;

create or replace function public.gamehub_min_seconds(p_game_id text, p_level integer)
returns numeric language sql immutable as $$
  select case p_game_id
    when 'cup-shuffle' then (array[9, 9, 10, 11, 11, 10, 13, 13, 14, 13, 14, 15])[least(greatest(p_level, 1), 12)]::numeric
    when 'snap-fit' then 1.6
    when 'nail-hit' then 0.75 + 0.15 * case when p_level % 5 = 0 then 10 else least(6 + p_level, 12) end
    when 'cut-score' then 3
    when 'fruits-slash' then 5
    when 'rock-blast' then 6
    else 3600
  end;
$$;
