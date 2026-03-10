-- Add 5 LinkedIn templates with picture-in-picture style: varied pip position and size.
-- Each defaults to PIP so the image sits in a corner/frame; layout leaves room for the PIP.

INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn PIP Bottom Left',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 620, "w": 720, "h": 320, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "left", "color": "#f1f5f9", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 480, "w": 640, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#94a3b8", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.7, "color": "#0f172a", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0f172a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Inter",
          "body_font_family": "Inter",
          "background_color": "#0f172a",
          "image_display": { "mode": "pip", "pipPosition": "bottom_left", "pipSize": 0.42 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0f172a"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn PIP Top Right',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 100, "right": 100, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 680, "w": 760, "h": 260, "fontSize": 66, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#fef9c3", "fontFamily": "system" },
        { "id": "body", "x": 80, "y": 540, "w": 720, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.28, "maxLines": 2, "align": "left", "color": "#e7e5e4", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.8, "color": "#0a0a0a", "extent": 48 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0a0a0a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#0a0a0a",
          "image_display": { "mode": "pip", "pipPosition": "top_right", "pipSize": 0.38 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0a0a0a"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn PIP Large',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 180, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 260, "w": 920, "h": 340, "fontSize": 60, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ecfdf5", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 640, "w": 920, "h": 200, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#a7f3d0", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.4, "color": "#064e3b", "extent": 55 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#064e3b" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Inter",
          "body_font_family": "Inter",
          "background_color": "#064e3b",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.5 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#064e3b"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn PIP Compact',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 120, "right": 80, "bottom": 80, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 320, "w": 920, "h": 380, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 5, "align": "center", "color": "#faf5ff", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 740, "w": 920, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 3, "align": "center", "color": "#e9d5ff", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5, "color": "#3b0764", "extent": 52 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#3b0764" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Inter",
          "body_font_family": "Inter",
          "background_color": "#3b0764",
          "image_display": { "mode": "pip", "pipPosition": "top_left", "pipSize": 0.32 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#3b0764"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn PIP Split',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 140, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 660, "w": 680, "h": 280, "fontSize": 62, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#f0fdfa", "fontFamily": "system" },
        { "id": "body", "x": 80, "y": 520, "w": 600, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#99f6e4", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "left", "strength": 0.6, "color": "#134e4a", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#134e4a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#134e4a",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.45 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#134e4a"
        }
      }
    }'::jsonb,
    true
  );
