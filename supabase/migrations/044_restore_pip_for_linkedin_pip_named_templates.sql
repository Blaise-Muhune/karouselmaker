-- If 043 already ran (before we fixed it to keep "PIP" in the name), restore image_display
-- for system LinkedIn templates whose name contains "PIP" so they show PIP in the modal again.
UPDATE public.templates
SET config = jsonb_set(
  config,
  '{defaults,meta}',
  (config->'defaults'->'meta') || jsonb_build_object(
    'image_display',
    jsonb_build_object(
      'mode', 'pip',
      'pipPosition',
      CASE
        WHEN name ILIKE '%bottom left%' THEN 'bottom_left'
        WHEN name ILIKE '%top left%' THEN 'top_left'
        WHEN name ILIKE '%top right%' THEN 'top_right'
        WHEN name ILIKE '%bottom right%' THEN 'bottom_right'
        ELSE 'bottom_right'
      END,
      'pipSize', 0.4
    )
  ),
  true
)
WHERE user_id IS NULL
  AND category = 'linkedin'
  AND name ILIKE '%PIP%'
  AND (config->'defaults'->'meta'->'image_display') IS NULL;
