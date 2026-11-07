-- Archery 3D: players start with 2 hearts.
update public.gamehub_game_settings set initial_lives = 2 where game_id = 'archery';
