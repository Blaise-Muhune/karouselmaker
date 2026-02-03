-- System templates (user_id = NULL). Locked, Pubity-style layouts.
insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
values
  (
    gen_random_uuid(),
    null,
    'Headline bottom (hook)',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 700, "w": 920, "h": 280, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 4, "align": "left" },
        { "id": "body", "x": 80, "y": 560, "w": 920, "h": 160, "fontSize": 34, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 3, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Point clean',
    'point',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 380, "w": 920, "h": 320, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 5, "align": "center" },
        { "id": "body", "x": 80, "y": 720, "w": 920, "h": 200, "fontSize": 32, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 3, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Context block',
    'context',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 80, "w": 920, "h": 200, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 3, "align": "left" },
        { "id": "body", "x": 80, "y": 320, "w": 920, "h": 600, "fontSize": 36, "fontWeight": 600, "lineHeight": 1.25, "maxLines": 12, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.4 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'CTA bold',
    'cta',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 340, "w": 920, "h": 400, "fontSize": 80, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 4, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    null,
    'Generic minimal',
    'generic',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 120, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 720, "w": 920, "h": 260, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 3, "align": "center" },
        { "id": "body", "x": 80, "y": 560, "w": 920, "h": 140, "fontSize": 32, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  )
;
