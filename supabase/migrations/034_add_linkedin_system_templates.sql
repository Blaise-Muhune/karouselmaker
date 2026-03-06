-- Add system templates for LinkedIn carousels (category = 'linkedin').
-- When user selects "Carousel for: LinkedIn", one of these is used as the default template.
INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- LinkedIn default: clean, professional, one idea per slide (B2B-friendly)
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn B2B',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 300, "w": 904, "h": 380, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 5, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 88, "y": 720, "w": 904, "h": 240, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 4, "align": "center", "color": "#e8e8e8" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.55, "color": "#0a0a0a", "extent": 60 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- LinkedIn hook: strong first slide, left-aligned
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
        { "id": "headline", "x": 80, "y": 700, "w": 920, "h": 280, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 560, "w": 800, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "left", "color": "#e5e5e5" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 42, "solidSize": 100 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  );
