-- Retention & following-focused templates inspired by viral carousel styles.
-- Solid bottom block, Did You Know, blurred fact, quote cover, moody quote, + creative extras.
insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
values
  -- 1. Human interest story: image top 2/3, solid black block bottom 1/3, white headline
  (
    gen_random_uuid(),
    null,
    'Story block',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 720, "w": 920, "h": 240, "fontSize": 52, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 970, "w": 920, "h": 80, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.2, "maxLines": 1, "align": "center", "color": "#cccccc" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#000000", "extent": 35, "solidSize": 100 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 2. Did you know: tag + big fact, dark space vibe
  (
    gen_random_uuid(),
    null,
    'Did you know',
    'point',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "body", "x": 80, "y": 80, "w": 400, "h": 80, "fontSize": 28, "fontWeight": 700, "lineHeight": 1.2, "maxLines": 1, "align": "left", "color": "#ffffff" },
        { "id": "headline", "x": 80, "y": 200, "w": 920, "h": 520, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 6, "align": "left", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6, "color": "#0a0a12" }, "vignette": { "enabled": true, "strength": 0.3 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 3. Blurred fact: left-aligned, blurred bg, clean typography
  (
    gen_random_uuid(),
    null,
    'Fact blur',
    'point',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 620, "w": 920, "h": 360, "fontSize": 48, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 6, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 520, "w": 600, "h": 80, "fontSize": 28, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 1, "align": "left", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "blur" }
    }'::jsonb,
    true
  ),
  -- 4. Quote cover: big number + title, list-style opener
  (
    gen_random_uuid(),
    null,
    'List cover',
    'hook',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "body", "x": 80, "y": 120, "w": 200, "h": 140, "fontSize": 120, "fontWeight": 900, "lineHeight": 1, "maxLines": 1, "align": "left" },
        { "id": "headline", "x": 80, "y": 280, "w": 920, "h": 400, "fontSize": 52, "fontWeight": 800, "lineHeight": 1.15, "maxLines": 5, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": false }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": false, "defaultStyle": "none" }
    }'::jsonb,
    true
  ),
  -- 5. Moody quote: quote overlay top-left on atmospheric image
  (
    gen_random_uuid(),
    null,
    'Quote overlay',
    'context',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 80, "right": 120, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 120, "w": 700, "h": 480, "fontSize": 44, "fontWeight": 600, "lineHeight": 1.35, "maxLines": 8, "align": "left", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.55 }, "vignette": { "enabled": true, "strength": 0.25 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 6. Punch fact: single bold statement, centered, high impact
  (
    gen_random_uuid(),
    null,
    'Punch fact',
    'cta',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 60, "y": 280, "w": 960, "h": 520, "fontSize": 72, "fontWeight": 900, "lineHeight": 1.08, "maxLines": 5, "align": "center", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.65, "color": "#000000" }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 7. That's interesting: tagline style with hook + payoff
  (
    gen_random_uuid(),
    null,
    'That''s interesting',
    'point',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "body", "x": 80, "y": 80, "w": 400, "h": 60, "fontSize": 24, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 1, "align": "left", "color": "#a0a0a0" },
        { "id": "headline", "x": 80, "y": 180, "w": 920, "h": 420, "fontSize": 58, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 5, "align": "left", "color": "#ffffff" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.55 }, "vignette": { "enabled": true, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 8. Solid bar top: bold headline in solid bar at top (inverse of story block)
  (
    gen_random_uuid(),
    null,
    'Banner top',
    'hook',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 80, "w": 920, "h": 200, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 2, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 340, "w": 920, "h": 520, "fontSize": 36, "fontWeight": 600, "lineHeight": 1.25, "maxLines": 10, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "top", "strength": 1, "color": "#000000", "extent": 28, "solidSize": 100 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 9. Minimal dark: dark solid bg, white text, no image - for text-only slides
  (
    gen_random_uuid(),
    null,
    'Minimal dark',
    'generic',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 340, "w": 920, "h": 400, "fontSize": 64, "fontWeight": 700, "lineHeight": 1.2, "maxLines": 5, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 760, "w": 920, "h": 160, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "center", "color": "#a0a0a0" }
      ],
      "overlays": { "gradient": { "enabled": false }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": false, "defaultStyle": "none" }
    }'::jsonb,
    true
  ),
  -- 10. Swipe bait: curiosity gap, bold question or tease
  (
    gen_random_uuid(),
    null,
    'Swipe bait',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 680, "w": 920, "h": 320, "fontSize": 62, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 600, "w": 920, "h": 80, "fontSize": 26, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 1, "align": "center", "color": "#e0e0e0" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.7 }, "vignette": { "enabled": true, "strength": 0.25 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  );
