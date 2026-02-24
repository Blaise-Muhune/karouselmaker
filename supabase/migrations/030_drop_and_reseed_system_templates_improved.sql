-- Replace all system templates with an improved set.
-- User templates (user_id not null) are unchanged.
-- Improvements: better typography, clearer overlay identity, balanced safe areas, distinct look per template.

-- 1. Clear slide references to system templates (slides fall back to default)
UPDATE public.slides
SET template_id = NULL
WHERE template_id IN (
  SELECT id FROM public.templates WHERE user_id IS NULL
);

-- 2. Remove all system templates
DELETE FROM public.templates WHERE user_id IS NULL;

-- 3. Reseed improved system templates (1:1 = 1080x1080)
INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- 1. Hook: bold headline at bottom, solid dark bar, left-aligned (attention-grabbing)
  (
    gen_random_uuid(),
    NULL,
    'Headline bottom (hook)',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 720, "w": 920, "h": 260, "fontSize": 84, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 3, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 580, "w": 720, "h": 120, "fontSize": 30, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "left", "color": "#e5e5e5" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 40, "solidSize": 100 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 2. Point: centered, large headline + body; soft top gradient (content pops)
  (
    gen_random_uuid(),
    NULL,
    'Point clean',
    'point',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 360, "fontSize": 76, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 5, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 88, "y": 720, "w": 904, "h": 220, "fontSize": 30, "fontWeight": 600, "lineHeight": 1.28, "maxLines": 3, "align": "center", "color": "#e8e8e8" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.52, "color": "#000000", "extent": 62 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 3. Context: split — compact headline top, large readable body; bottom gradient
  (
    gen_random_uuid(),
    NULL,
    'Context block',
    'context',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 72, "right": 80, "bottom": 96, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 72, "w": 920, "h": 140, "fontSize": 46, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 2, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 240, "w": 920, "h": 740, "fontSize": 36, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 14, "align": "left", "color": "#f0f0f0" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.65, "color": "#0a0a0a", "extent": 55 },
        "vignette": { "enabled": true, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 4. Follow CTA: big centered CTA; solid bottom bar (default for new carousels)
  (
    gen_random_uuid(),
    NULL,
    'Follow CTA',
    'cta',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 280, "w": 920, "h": 500, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 6, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 820, "w": 920, "h": 120, "fontSize": 28, "fontWeight": 600, "lineHeight": 1.22, "maxLines": 2, "align": "center", "color": "#e0e0e0" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 45, "solidSize": 100 },
        "vignette": { "enabled": true, "strength": 0.22 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 5. Generic minimal: headline only, large type; subtle gradient
  (
    gen_random_uuid(),
    NULL,
    'Generic minimal',
    'generic',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 260, "w": 888, "h": 560, "fontSize": 92, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 4, "align": "center", "color": "#ffffff" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.45, "color": "#000000", "extent": 52 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 6. Gradient Profile Card: purple gradient, left-aligned (profile/list style)
  (
    gen_random_uuid(),
    NULL,
    'Gradient Profile Card',
    'generic',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 700, "w": 936, "h": 240, "fontSize": 74, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 2, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 72, "y": 960, "w": 936, "h": 160, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.28, "maxLines": 3, "align": "left", "color": "#f0e6ff" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.82, "color": "#7C3AED", "extent": 54, "solidSize": 20 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  );
