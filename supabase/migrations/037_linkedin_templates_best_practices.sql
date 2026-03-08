-- LinkedIn templates aligned with best practices (2024–2025):
-- Square 1080×1080, high contrast (4.5:1), 48pt+ headline / 28pt+ body, one idea per slide.
-- When a slide has NO image, defaults.background (style + color, or pattern) is used so the
-- slide always has a background that contrasts well with the template text colors.
-- Text colors are varied: not only white—cream, teal, amber, dark-on-light, etc., for variety.
-- Overlays (gradient direction, strength, extent, solidSize, color) apply when user adds an image.

-- Clear slide references to existing LinkedIn system templates
UPDATE public.slides
SET template_id = NULL
WHERE template_id IN (
  SELECT id FROM public.templates WHERE user_id IS NULL AND category = 'linkedin'
);

DELETE FROM public.templates WHERE user_id IS NULL AND category = 'linkedin';

INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- 1. LinkedIn Tech (default): dark slate bg (no image); teal-tinted text for variety
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Tech',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 320, "w": 920, "h": 340, "fontSize": 62, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#f0fdfa" },
        { "id": "body", "x": 80, "y": 700, "w": 920, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#99f6e4" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.55, "color": "#0f172a", "extent": 55 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#0f172a" } }
    }'::jsonb,
    true
  ),
  -- 2. LinkedIn Hook: bold first slide; cream headline on black bg (no image), strong contrast
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Hook',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 700, "w": 920, "h": 280, "fontSize": 76, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#fef9c3" },
        { "id": "body", "x": 80, "y": 560, "w": 760, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "left", "color": "#e7e5e4" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 42, "solidSize": 100 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#0a0a0a" } }
    }'::jsonb,
    true
  ),
  -- 3. LinkedIn Leadership: navy bg (no image); soft blue-white text for executive feel
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Leadership',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 72, "right": 72, "bottom": 120, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 680, "w": 936, "h": 280, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#e0e7ff" },
        { "id": "body", "x": 72, "y": 540, "w": 800, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.28, "maxLines": 2, "align": "left", "color": "#c7d2fe" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.9, "color": "#0f172a", "extent": 45, "solidSize": 80 },
        "vignette": { "enabled": true, "strength": 0.15 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#0f172a" } }
    }'::jsonb,
    true
  ),
  -- 4. LinkedIn CTA: navy blue bg (no image); white headline, light blue-gray body
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn CTA',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 440, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 5, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 780, "w": 920, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "center", "color": "#bfdbfe" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#1e3a5f", "extent": 48, "solidSize": 100 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#1e3a5f" } }
    }'::jsonb,
    true
  ),
  -- 5. LinkedIn Minimal: LIGHT bg (no image); dark slate text for strong contrast
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Minimal',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 280, "w": 888, "h": 520, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 5, "align": "center", "color": "#0f172a" }
      ],
      "overlays": {
        "gradient": { "enabled": false, "direction": "bottom", "strength": 0.3, "color": "#000000" },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#f8fafc" } }
    }'::jsonb,
    true
  ),
  -- 6. LinkedIn Wellness: LIGHT green bg (no image); dark green text, high contrast
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Wellness',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 300, "w": 904, "h": 360, "fontSize": 60, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#14532d" },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 240, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 3, "align": "center", "color": "#166534" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.35, "color": "#f0fdf4", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#ecfdf5" } }
    }'::jsonb,
    true
  ),
  -- 7. LinkedIn Bold Impact: dark pattern bg (no image); amber/gold headline, gray body
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Bold Impact',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 280, "w": 936, "h": 400, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "center", "color": "#fef08a", "fontFamily": "Inter" },
        { "id": "body", "x": 72, "y": 720, "w": 936, "h": 200, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#94a3b8", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.25, "color": "#1e293b", "extent": 40 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#1e293b", "pattern": "dots" } }
    }'::jsonb,
    true
  ),
  -- 8. LinkedIn Vibrant: solid purple bg (no image); white headline, lavender body
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Vibrant',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 112, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 380, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "system" },
        { "id": "body", "x": 80, "y": 720, "w": 920, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#e9d5ff", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5, "color": "#4c1d95", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#6b21a8" } }
    }'::jsonb,
    true
  ),
  -- 9. LinkedIn Luxe Monochrome: dark pattern bg (no image); cream headline, stone gray body
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Luxe Monochrome',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 100, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 340, "fontSize": 64, "fontWeight": 700, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#fffbeb", "fontFamily": "Georgia" },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 220, "fontSize": 26, "fontWeight": 400, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#d6d3d1", "fontFamily": "Georgia" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.2, "color": "#0f172a", "extent": 50 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#0f172a", "pattern": "ovals" } }
    }'::jsonb,
    true
  ),
  -- 10. LinkedIn Clean Lines: dark pattern bg (no image); cyan/slate headline, gray body
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Clean Lines',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 660, "w": 920, "h": 300, "fontSize": 70, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#67e8f9", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 520, "w": 800, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#e2e8f0", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.7, "color": "#0f172a", "extent": 45 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#1e293b", "pattern": "lines" } }
    }'::jsonb,
    true
  );
