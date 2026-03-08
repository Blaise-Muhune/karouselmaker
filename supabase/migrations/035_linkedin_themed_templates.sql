-- Reimagine LinkedIn templates: distinct themes (Tech, Wellness, Leadership, etc.) with
-- theme colors and overlays based on what works for B2B carousels (high contrast, professional).
-- Each template has defaults.background.color so new carousels get the theme color when no image.

-- Clear slide references to existing LinkedIn system templates (slides will fall back to default template)
UPDATE public.slides
SET template_id = NULL
WHERE template_id IN (
  SELECT id FROM public.templates WHERE user_id IS NULL AND category = 'linkedin'
);

-- Remove the two generic LinkedIn templates so we replace with the full themed set
DELETE FROM public.templates WHERE user_id IS NULL AND category = 'linkedin';

INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- 1. LinkedIn Tech: dark slate + teal accent (startups, SaaS, product)
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
        { "id": "headline", "x": 80, "y": 320, "w": 920, "h": 340, "fontSize": 62, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#f8fafc" },
        { "id": "body", "x": 80, "y": 700, "w": 920, "h": 220, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#cbd5e1" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.5, "color": "#0f172a", "extent": 55 },
        "vignette": { "enabled": true, "strength": 0.15 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#0f172a" } }
    }'::jsonb,
    true
  ),
  -- 2. LinkedIn Wellness: soft green (health, wellness, coaching)
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
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 240, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 3, "align": "center", "color": "#166534" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.35, "color": "#f0fdf4", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#f0fdf4" } }
    }'::jsonb,
    true
  ),
  -- 3. LinkedIn Leadership: navy + white (executive, leadership, strategy)
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
        { "id": "headline", "x": 72, "y": 680, "w": 936, "h": 280, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 72, "y": 540, "w": 800, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.28, "maxLines": 2, "align": "left", "color": "#e2e8f0" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.9, "color": "#0f172a", "extent": 45, "solidSize": 80 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#0f172a" } }
    }'::jsonb,
    true
  ),
  -- 4. LinkedIn Minimal: light gray (clean, modern, consulting)
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
        { "id": "headline", "x": 96, "y": 280, "w": 888, "h": 520, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 5, "align": "center", "color": "#1e293b" }
      ],
      "overlays": {
        "gradient": { "enabled": false, "direction": "bottom", "strength": 0.3, "color": "#000000" },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#f1f5f9" } }
    }'::jsonb,
    true
  ),
  -- 5. LinkedIn Hook: bold first slide (6–8 word hook, high contrast)
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
        { "id": "headline", "x": 80, "y": 700, "w": 920, "h": 280, "fontSize": 76, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 560, "w": 760, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "left", "color": "#e5e7eb" }
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
  -- 6. LinkedIn CTA: conversion-focused last slide (clear CTA, professional)
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
        { "id": "body", "x": 80, "y": 780, "w": 920, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "center", "color": "#d1d5db" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#1e3a5f", "extent": 48, "solidSize": 100 },
        "vignette": { "enabled": true, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#1e3a5f" } }
    }'::jsonb,
    true
  );
