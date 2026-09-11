-- Few simple system templates for Instagram / TikTok (portrait exports).
-- Design space is 1080×1080; preview/export scale to 4:5 or 9:16.
-- Idempotent upserts by fixed UUID.

insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked, updated_at)
values
(
  '00000000-0000-4000-8000-000000000001',
  null,
  'Simple Center',
  'instagram',
  '4:5',
  '{
    "layout": "headline_center",
    "safeArea": { "top": 96, "right": 80, "bottom": 120, "left": 80 },
    "textZones": [
      { "id": "headline", "x": 80, "y": 320, "w": 920, "h": 280, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff" },
      { "id": "body", "x": 100, "y": 620, "w": 880, "h": 220, "fontSize": 30, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 4, "align": "center", "color": "#f1f5f9" }
    ],
    "overlays": {
      "gradient": { "enabled": true, "direction": "bottom", "strength": 0.55, "color": "#000000", "extent": 60, "solidSize": 0 },
      "vignette": { "enabled": false, "strength": 0.2 }
    },
    "chrome": {
      "showSwipe": true,
      "swipeType": "text",
      "swipePosition": "bottom_center",
      "showCounter": false,
      "watermark": { "enabled": true, "position": "top_right" }
    },
    "backgroundRules": { "allowImage": true, "allowSolid": true, "allowGradient": true, "defaultStyle": "darken" },
    "defaults": {
      "background": { "style": "solid", "color": "#0a0a0a" },
      "meta": {
        "show_counter": false,
        "show_watermark": true,
        "show_made_with": false,
        "headline_highlight_style": "text",
        "body_highlight_style": "text",
        "background_color": "#0a0a0a"
      }
    }
  }'::jsonb,
  true,
  now()
),
(
  '00000000-0000-4000-8000-000000000002',
  null,
  'Follow CTA',
  'cta',
  '4:5',
  '{
    "layout": "headline_bottom",
    "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
    "textZones": [
      { "id": "headline", "x": 80, "y": 260, "w": 920, "h": 480, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 5, "align": "center", "color": "#ffffff" },
      { "id": "body", "x": 80, "y": 780, "w": 920, "h": 140, "fontSize": 28, "fontWeight": 600, "lineHeight": 1.25, "maxLines": 2, "align": "center", "color": "#e2e8f0" }
    ],
    "overlays": {
      "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 48, "solidSize": 100 },
      "vignette": { "enabled": true, "strength": 0.2 }
    },
    "chrome": {
      "showSwipe": true,
      "swipeType": "text",
      "swipePosition": "bottom_center",
      "showCounter": true,
      "counterStyle": "1/8",
      "watermark": { "enabled": true, "position": "bottom_left" }
    },
    "backgroundRules": { "allowImage": true, "allowSolid": true, "allowGradient": true, "defaultStyle": "darken" },
    "defaults": {
      "background": { "style": "solid", "color": "#0a0a0a" },
      "meta": {
        "show_counter": true,
        "show_watermark": true,
        "show_made_with": false,
        "headline_highlight_style": "text",
        "body_highlight_style": "text",
        "background_color": "#0a0a0a"
      }
    }
  }'::jsonb,
  true,
  now()
),
(
  '00000000-0000-4000-8000-000000000003',
  null,
  'Bottom Caption',
  'hook',
  '4:5',
  '{
    "layout": "headline_bottom",
    "safeArea": { "top": 80, "right": 72, "bottom": 120, "left": 72 },
    "textZones": [
      { "id": "headline", "x": 72, "y": 700, "w": 936, "h": 220, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#ffffff" },
      { "id": "body", "x": 72, "y": 930, "w": 900, "h": 90, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "left", "color": "#e2e8f0" }
    ],
    "overlays": {
      "gradient": { "enabled": true, "direction": "bottom", "strength": 0.95, "color": "#000000", "extent": 42, "solidSize": 35 },
      "vignette": { "enabled": false, "strength": 0.2 }
    },
    "chrome": {
      "showSwipe": true,
      "swipeType": "text",
      "swipePosition": "bottom_center",
      "showCounter": false,
      "watermark": { "enabled": true, "position": "top_right" }
    },
    "backgroundRules": { "allowImage": true, "allowSolid": true, "allowGradient": true, "defaultStyle": "darken" },
    "defaults": {
      "background": { "style": "solid", "color": "#111827" },
      "meta": {
        "show_counter": false,
        "show_watermark": true,
        "show_made_with": false,
        "headline_highlight_style": "text",
        "body_highlight_style": "text",
        "background_color": "#111827"
      }
    }
  }'::jsonb,
  true,
  now()
),
(
  '00000000-0000-4000-8000-000000000004',
  null,
  'Clean Light',
  'instagram',
  '4:5',
  '{
    "layout": "headline_center",
    "safeArea": { "top": 100, "right": 88, "bottom": 120, "left": 88 },
    "textZones": [
      { "id": "headline", "x": 88, "y": 340, "w": 904, "h": 300, "fontSize": 60, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#0f172a" },
      { "id": "body", "x": 100, "y": 680, "w": 880, "h": 200, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.4, "maxLines": 4, "align": "center", "color": "#475569" }
    ],
    "overlays": {
      "gradient": { "enabled": false, "direction": "bottom", "strength": 0.2, "color": "#000000", "extent": 100, "solidSize": 0 },
      "vignette": { "enabled": false, "strength": 0.1 }
    },
    "chrome": {
      "showSwipe": true,
      "swipeType": "text",
      "swipePosition": "bottom_center",
      "showCounter": false,
      "watermark": { "enabled": true, "position": "bottom_right" }
    },
    "backgroundRules": { "allowImage": true, "allowSolid": true, "allowGradient": true, "defaultStyle": "lighten" },
    "defaults": {
      "background": { "style": "solid", "color": "#f8fafc" },
      "meta": {
        "show_counter": false,
        "show_watermark": true,
        "show_made_with": false,
        "headline_highlight_style": "text",
        "body_highlight_style": "text",
        "background_color": "#f8fafc"
      }
    }
  }'::jsonb,
  true,
  now()
)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  aspect_ratio = excluded.aspect_ratio,
  config = excluded.config,
  is_locked = excluded.is_locked,
  updated_at = now();
