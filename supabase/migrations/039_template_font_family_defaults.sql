-- Ensure every template text zone has fontFamily set for LinkedIn/Instagram.
-- Optimized defaults: Inter for LinkedIn (reads well on both platforms), system for others.
-- Only set when missing so existing templates that already use Georgia/Inter keep their choice.

UPDATE public.templates t
SET config = jsonb_set(
  t.config,
  '{textZones}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN elem ? 'fontFamily' AND (elem->>'fontFamily') IS NOT NULL AND (elem->>'fontFamily') <> '' THEN elem
        ELSE elem || jsonb_build_object(
          'fontFamily',
          CASE WHEN t.category = 'linkedin' THEN 'Inter' ELSE 'system' END
        )
      END
    )
    FROM jsonb_array_elements(t.config->'textZones') AS elem
  )
)
WHERE t.config ? 'textZones'
  AND jsonb_typeof(t.config->'textZones') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(t.config->'textZones') AS elem
    WHERE NOT (elem ? 'fontFamily') OR (elem->>'fontFamily') IS NULL OR (elem->>'fontFamily') = ''
  );
