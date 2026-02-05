-- New templates: cool, retention, and following-focused styles.
-- Inspired by viral carousel aesthetics + creative variants.
insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
values
  -- 1. Number punch: big centered number + headline (listicle opener)
  (
    gen_random_uuid(),
    null,
    'Number punch',
    'hook',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "body", "x": 80, "y": 140, "w": 920, "h": 200, "fontSize": 160, "fontWeight": 900, "lineHeight": 1, "maxLines": 1, "align": "center", "color": "#ffffff" },
        { "id": "headline", "x": 80, "y": 380, "w": 920, "h": 400, "fontSize": 52, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 5, "align": "center", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6, "color": "#000000" }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 2. Follow CTA: main content + follow prompt at bottom
  (
    gen_random_uuid(),
    null,
    'Follow CTA',
    'cta',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 340, "w": 920, "h": 420, "fontSize": 58, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 6, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 820, "w": 920, "h": 140, "fontSize": 32, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "center", "color": "#e0e0e0" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.7, "color": "#0a0a0a" }, "vignette": { "enabled": true, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 3. Curiosity gap: bold question at top, tease below
  (
    gen_random_uuid(),
    null,
    'Curiosity gap',
    'hook',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 80, "w": 920, "h": 280, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 400, "w": 920, "h": 480, "fontSize": 38, "fontWeight": 600, "lineHeight": 1.25, "maxLines": 8, "align": "center", "color": "#d0d0d0" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.65 }, "vignette": { "enabled": true, "strength": 0.25 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 4. Science fact: blurred bg, left-aligned, multi-line emphasis
  (
    gen_random_uuid(),
    null,
    'Science fact',
    'point',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "body", "x": 80, "y": 80, "w": 500, "h": 60, "fontSize": 26, "fontWeight": 700, "lineHeight": 1.2, "maxLines": 1, "align": "left", "color": "#a0a0a0" },
        { "id": "headline", "x": 80, "y": 580, "w": 920, "h": 400, "fontSize": 46, "fontWeight": 800, "lineHeight": 1.15, "maxLines": 6, "align": "left", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "blur" }
    }'::jsonb,
    true
  ),
  -- 5. Emotional hook: story block with dramatic text placement
  (
    gen_random_uuid(),
    null,
    'Emotional hook',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 680, "w": 920, "h": 280, "fontSize": 58, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 960, "w": 920, "h": 80, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.2, "maxLines": 1, "align": "center", "color": "#b0b0b0" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#000000", "extent": 40, "solidSize": 100 }, "vignette": { "enabled": true, "strength": 0.3 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 6. Viral tease: bold question, centered, swipe bait
  (
    gen_random_uuid(),
    null,
    'Viral tease',
    'hook',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 60, "y": 260, "w": 960, "h": 560, "fontSize": 68, "fontWeight": 900, "lineHeight": 1.08, "maxLines": 6, "align": "center", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.7, "color": "#000000" }, "vignette": { "enabled": true, "strength": 0.3 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 7. Retention block: solid bar bottom, "save this" style
  (
    gen_random_uuid(),
    null,
    'Retention block',
    'cta',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 700, "w": 920, "h": 260, "fontSize": 54, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 960, "w": 920, "h": 80, "fontSize": 26, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 1, "align": "center", "color": "#cccccc" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 38, "solidSize": 100 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 8. Cool minimal: dark solid, single bold line, no image
  (
    gen_random_uuid(),
    null,
    'Cool minimal',
    'generic',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 380, "w": 920, "h": 320, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": false }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": false, "defaultStyle": "none" }
    }'::jsonb,
    true
  );
