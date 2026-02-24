-- Add system template: Gradient Profile Card
-- Purple gradient overlay, left-aligned headline + body at bottom (profile/list style, e.g. #6 Name, description).
insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
values (
  gen_random_uuid(),
  null,
  'Gradient Profile Card',
  'generic',
  '1:1',
  '{
    "layout": "headline_bottom",
    "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
    "textZones": [
      { "id": "headline", "x": 72, "y": 720, "w": 936, "h": 220, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 2, "align": "left", "color": "#ffffff" },
      { "id": "body", "x": 72, "y": 960, "w": 936, "h": 160, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 3, "align": "left", "color": "#e8e8e8" }
    ],
    "overlays": {
      "gradient": { "enabled": true, "direction": "bottom", "strength": 0.78, "color": "#7C3AED", "extent": 52, "solidSize": 18 },
      "vignette": { "enabled": true, "strength": 0.2 }
    },
    "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
    "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
  }'::jsonb,
  true
);
