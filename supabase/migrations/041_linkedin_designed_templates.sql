-- Add 5 LinkedIn templates with distinct background DESIGNS (not just pattern repeats):
-- big_circles, accent_bar, soft_glow, bold_slash, corner_block. Content stays primary.

INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Big Circles',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 360, "fontSize": 62, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#e0f2fe", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 700, "w": 920, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 3, "align": "center", "color": "#7dd3fc", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.3, "color": "#0c4a6e", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0c4a6e", "decoration": "big_circles", "decorationColor": "#0369a1" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Inter",
          "body_font_family": "Inter",
          "background_color": "#0c4a6e",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0c4a6e"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Accent Bar',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 660, "w": 936, "h": 280, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#f8fafc", "fontFamily": "system" },
        { "id": "body", "x": 72, "y": 520, "w": 800, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#cbd5e1", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5, "color": "#0f172a", "extent": 48 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0f172a", "decoration": "accent_bar", "decorationColor": "#3b82f6" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#0f172a",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
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
    'LinkedIn Soft Glow',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 340, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#e0e7ff", "fontFamily": "Inter" },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#a5b4fc", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.25, "color": "#1e293b", "extent": 55 },
        "vignette": { "enabled": true, "strength": 0.08 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#1e293b", "decoration": "soft_glow", "decorationColor": "#818cf8" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Inter",
          "body_font_family": "Inter",
          "background_color": "#1e293b",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#1e293b"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Bold Slash',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 680, "w": 920, "h": 260, "fontSize": 70, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#fef3c7", "fontFamily": "system" },
        { "id": "body", "x": 80, "y": 540, "w": 760, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.28, "maxLines": 2, "align": "left", "color": "#d6d3d1", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6, "color": "#18181b", "extent": 45 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#18181b", "decoration": "bold_slash", "decorationColor": "#f59e0b" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#18181b",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#18181b"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Corner Block',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 280, "w": 888, "h": 520, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 5, "align": "center", "color": "#ccfbf1", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.2, "color": "#134e4a", "extent": 45 },
        "vignette": { "enabled": true, "strength": 0.1 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#134e4a", "decoration": "corner_block", "decorationColor": "#2dd4bf" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "headline_font_family": "Inter",
          "background_color": "#134e4a",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#134e4a"
        }
      }
    }'::jsonb,
    true
  );
