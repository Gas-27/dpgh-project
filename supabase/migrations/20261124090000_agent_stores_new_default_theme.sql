-- Move agent stores that are still on a default theme to the new dark default.
-- Covers: no saved theme, the old purple storefront default, and the old teal/cream dashboard default.
-- Stores with custom colors are untouched. Previous values are kept in the backup table below.

CREATE TABLE IF NOT EXISTS public.agent_store_theme_backup_20261124 AS
SELECT id, theme_config, now() AS backed_up_at
FROM public.agent_stores
WHERE theme_config IS NULL
   OR theme_config = '{}'::jsonb
   OR (lower(theme_config->>'primary') = '#a78bfa' AND theme_config->>'card_background' LIKE 'linear-gradient(135deg, #2d1b69%')
   OR (lower(theme_config->>'primary') = '#0f9f9a' AND lower(theme_config->>'background') = '#f6f3ee' AND lower(theme_config->>'card_background') = '#fffaf2');

ALTER TABLE public.agent_store_theme_backup_20261124 ENABLE ROW LEVEL SECURITY;

UPDATE public.agent_stores s
SET theme_config = coalesce(s.theme_config, '{}'::jsonb) || jsonb_build_object(
  'primary', '#06b6d4',
  'primary_foreground', '#ffffff',
  'background', '#09090b',
  'card_background', '#18181b',
  'gb_text_color', '#ffffff',
  'price_text_color', '#ffffff',
  'button_text_color', '#ffffff',
  'button_bg_color', '#2a2a2e',
  'button_border_color', '#3f3f46'
)
FROM public.agent_store_theme_backup_20261124 b
WHERE b.id = s.id;
