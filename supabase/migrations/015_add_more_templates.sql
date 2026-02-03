-- Add more layout template options
insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
values
  (
    gen_random_uuid(),
    null,
    'Headline top (hook)',
    'hook',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 80, "w": 920, "h": 260, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 3, "align": "left" },
        { "id": "body", "x": 80, "y": 380, "w": 920, "h": 400, "fontSize": 36, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 6, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.55 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Point left',
    'point',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 340, "w": 920, "h": 280, "fontSize": 60, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "left" },
        { "id": "body", "x": 80, "y": 660, "w": 920, "h": 200, "fontSize": 30, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 3, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Quote block',
    'context',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 100, "y": 280, "w": 880, "h": 520, "fontSize": 52, "fontWeight": 700, "lineHeight": 1.25, "maxLines": 8, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Impact',
    'cta',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 60, "y": 260, "w": 960, "h": 560, "fontSize": 88, "fontWeight": 900, "lineHeight": 1.05, "maxLines": 4, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Split compact',
    'generic',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 80, "w": 920, "h": 180, "fontSize": 52, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 2, "align": "left" },
        { "id": "body", "x": 80, "y": 300, "w": 920, "h": 520, "fontSize": 34, "fontWeight": 600, "lineHeight": 1.25, "maxLines": 10, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.45 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Centered punch',
    'generic',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 580, "w": 920, "h": 320, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 4, "align": "center" },
        { "id": "body", "x": 80, "y": 440, "w": 920, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.2, "maxLines": 2, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.55 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  );
