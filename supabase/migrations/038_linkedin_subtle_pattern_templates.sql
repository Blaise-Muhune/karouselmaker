-- LinkedIn templates with subtle, intentional patterns and colors.
-- Design goal: content-first, not distracting. Patterns add structure and polish
-- without competing with the message. All meet readability standards (contrast, 48pt+ headline).

INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- 1. LinkedIn Editorial: warm stone + subtle lines. Left-aligned, magazine feel. Content leads.
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Editorial',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 660, "w": 920, "h": 300, "fontSize": 66, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#fafaf9", "fontFamily": "Georgia" },
        { "id": "body", "x": 80, "y": 520, "w": 800, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 2, "align": "left", "color": "#a8a29e", "fontFamily": "Georgia" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5, "color": "#1c1917", "extent": 48 },
        "vignette": { "enabled": false, "strength": 0.15 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#1c1917", "pattern": "lines" } }
    }'::jsonb,
    true
  ),
  -- 2. LinkedIn Depth: soft circles pattern, dark blue. Calm and premium; keeps focus on the idea.
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Depth',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 100, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 340, "fontSize": 62, "fontWeight": 700, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Inter" },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 220, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#93c5fd", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.2, "color": "#0f172a", "extent": 50 },
        "vignette": { "enabled": true, "strength": 0.1 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#0f172a", "pattern": "circles" } }
    }'::jsonb,
    true
  ),
  -- 3. LinkedIn Focus: deep teal + subtle dots. Ordered, professional; supports clarity.
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Focus',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 112, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 380, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 720, "w": 920, "h": 200, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 3, "align": "center", "color": "#99f6e4", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.25, "color": "#134e4a", "extent": 45 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#134e4a", "pattern": "dots" } }
    }'::jsonb,
    true
  ),
  -- 4. LinkedIn Serene: solid dark green, no pattern. Minimal; growth and calm without visual noise.
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Serene',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 300, "w": 904, "h": 380, "fontSize": 62, "fontWeight": 700, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#fefce8", "fontFamily": "system" },
        { "id": "body", "x": 88, "y": 720, "w": 904, "h": 220, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#bbf7d0", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.3, "color": "#14532d", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#14532d" } }
    }'::jsonb,
    true
  ),
  -- 5. LinkedIn Trust: navy + ovals. Authority and credibility; pattern is subtle, text stands out.
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Trust',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 400, "fontSize": 60, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 740, "w": 920, "h": 180, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 3, "align": "center", "color": "#bfdbfe", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.25, "color": "#1e3a5f", "extent": 48 },
        "vignette": { "enabled": true, "strength": 0.1 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "pattern", "color": "#1e3a5f", "pattern": "ovals" } }
    }'::jsonb,
    true
  ),
  -- 6. LinkedIn Calm: solid warm charcoal. No pattern; pure typography focus for thought leadership.
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Calm',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 660, "w": 920, "h": 300, "fontSize": 68, "fontWeight": 700, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#fafaf9", "fontFamily": "system" },
        { "id": "body", "x": 80, "y": 520, "w": 800, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#d6d3d1", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.4, "color": "#292524", "extent": 45 },
        "vignette": { "enabled": false, "strength": 0.15 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": { "background": { "style": "solid", "color": "#292524" } }
    }'::jsonb,
    true
  );
