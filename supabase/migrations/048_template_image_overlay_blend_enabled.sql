-- Add image_overlay_blend_enabled to every template's defaults.meta.
-- true when overlay_tint_opacity is present and > 0, false otherwise (so "Follow CTA" etc. get no blend by default).

UPDATE public.templates
SET config = jsonb_set(
  config,
  '{defaults,meta}',
  COALESCE(config->'defaults'->'meta', '{}'::jsonb) || jsonb_build_object(
    'image_overlay_blend_enabled',
    COALESCE((config->'defaults'->'meta'->>'overlay_tint_opacity')::numeric, 0) > 0
  ),
  true
);
