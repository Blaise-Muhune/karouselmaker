-- LinkedIn Hook and any template whose name contains "PIP" keep their PIP style.
-- All other system LinkedIn templates (Corner Block, CTA, Grid, Clean Lines, etc.)
-- have image_display removed so they show full-slide in the modal and when applied.
UPDATE public.templates
SET config = jsonb_set(
  config,
  '{defaults,meta}',
  (config->'defaults'->'meta') - 'image_display',
  true
)
WHERE user_id IS NULL
  AND category = 'linkedin'
  AND (config->'defaults'->'meta'->'image_display') IS NOT NULL
  AND (name IS NULL OR (name != 'LinkedIn Hook' AND name NOT ILIKE '%PIP%'));
