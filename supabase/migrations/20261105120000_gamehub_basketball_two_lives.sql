-- Basketball: players get 2 lives, so they can miss twice and only the third miss ends the run.
update public.gamehub_game_settings set initial_lives = 2 where game_id = 'basketball';

-- Active runs that still have their single life get the extra one.
update public.gamehub_runs
  set lives = 2, updated_at = now()
  where game_id = 'basketball' and status = 'active' and lives = 1 and lives_bought = 0;
