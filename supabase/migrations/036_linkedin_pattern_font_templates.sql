-- LinkedIn templates with minimal pattern backgrounds (no image) and font style/size variation.
-- Bold Impact: dots pattern, strong title/body hierarchy, Inter font.
-- Vibrant: solid purple, clear size hierarchy.
-- Luxe Monochrome: ovals pattern, refined typography.

INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- Bold Impact: dark + dots pattern, large headline / smaller body, Inter
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
        { "id": "headline", "x": 72, "y": 280, "w": 936, "h": 400, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Inter" },
        { "id": "body", "x": 72, "y": 720, "w": 936, "h": 200, "fontSize": 24, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#94a3b8", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.25, "color": "#0f172a", "extent": 40 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#1e293b", "pattern": "dots" } }
    }'::jsonb,
    true
  ),
  -- Vibrant: solid purple, clear font size hierarchy (title large, body medium)
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
        { "id": "body", "x": 80, "y": 720, "w": 920, "h": 220, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#e9d5ff", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": false, "direction": "bottom", "strength": 0.3, "color": "#000000" },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#6b21a8" } }
    }'::jsonb,
    true
  ),
  -- Luxe Monochrome: dark + ovals pattern, refined, Georgia for a classic look
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
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 340, "fontSize": 64, "fontWeight": 700, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#f8fafc", "fontFamily": "Georgia" },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 220, "fontSize": 24, "fontWeight": 400, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#cbd5e1", "fontFamily": "Georgia" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.2, "color": "#0a0a0a", "extent": 50 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#0f172a", "pattern": "ovals" } }
    }'::jsonb,
    true
  ),
  -- Clean Lines: subtle lines pattern, minimal, strong contrast
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
        { "id": "headline", "x": 80, "y": 660, "w": 920, "h": 300, "fontSize": 70, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#ffffff", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 520, "w": 800, "h": 120, "fontSize": 24, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#e2e8f0", "fontFamily": "system" }
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
