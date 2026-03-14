-- Designer set: delete all system templates and reseed a creative, pro-grade set.
-- Templates support: text rotation, font color, highlight styles (text/background/outline),
-- font sizes, font families, PIP with rotation/size/border, overlay tint, patterns.
-- Categories: generic, cta, hook, point, context, linkedin (LinkedIn/Instagram).
-- Keep "Follow CTA" for default new carousels; keep "LinkedIn Tech" for default LinkedIn carousels.

-- 1. Clear slide references to system templates
UPDATE public.slides
SET template_id = NULL
WHERE template_id IN (
  SELECT id FROM public.templates WHERE user_id IS NULL
);

-- 2. Remove all system templates
DELETE FROM public.templates WHERE user_id IS NULL;

-- 3. Reseed: generic, cta, hook, point, context
INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  (
    gen_random_uuid(),
    NULL,
    'Statement',
    'generic',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 220, "w": 888, "h": 640, "fontSize": 88, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Montserrat" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5, "color": "#000000", "extent": 55, "solidSize": 0 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0a0a0a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "headline_font_family": "Montserrat",
          "background_color": "#0a0a0a"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'Breathe',
    'generic',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 120, "right": 120, "bottom": 120, "left": 120 },
      "textZones": [
        { "id": "headline", "x": 120, "y": 380, "w": 840, "h": 320, "fontSize": 72, "fontWeight": 700, "lineHeight": 1.15, "maxLines": 4, "align": "center", "color": "#0f172a", "fontFamily": "Georgia" },
        { "id": "body", "x": 120, "y": 720, "w": 840, "h": 200, "fontSize": 28, "fontWeight": 400, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#475569", "fontFamily": "Georgia" }
      ],
      "overlays": { "gradient": { "enabled": false, "direction": "bottom", "strength": 0.3, "color": "#000000", "extent": 100, "solidSize": 0 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#f8fafc" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Georgia",
          "body_font_family": "Georgia",
          "background_color": "#f8fafc"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'Follow CTA',
    'cta',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 280, "w": 920, "h": 500, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 6, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 820, "w": 920, "h": 120, "fontSize": 28, "fontWeight": 600, "lineHeight": 1.22, "maxLines": 2, "align": "center", "color": "#e0e0e0" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 45, "solidSize": 100 },
        "vignette": { "enabled": true, "strength": 0.22 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
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
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'Hook left',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 700, "w": 920, "h": 280, "fontSize": 80, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 560, "w": 720, "h": 120, "fontSize": 30, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "left", "color": "#e5e5e5" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 40, "solidSize": 100 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
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
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'One idea',
    'point',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 360, "fontSize": 76, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 5, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 88, "y": 720, "w": 904, "h": 220, "fontSize": 30, "fontWeight": 600, "lineHeight": 1.28, "maxLines": 3, "align": "center", "color": "#e8e8e8" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.52, "color": "#000000", "extent": 62, "solidSize": 0 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#000000" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#000000"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'Long copy',
    'context',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 72, "right": 80, "bottom": 96, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 72, "w": 920, "h": 140, "fontSize": 46, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 2, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 240, "w": 920, "h": 740, "fontSize": 36, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 14, "align": "left", "color": "#f0f0f0" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.65, "color": "#0a0a0a", "extent": 55, "solidSize": 0 },
        "vignette": { "enabled": true, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
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
    true
  );

-- 4. LinkedIn / Instagram: pro designer set — rotation, PIP, patterns, outline/background highlights, varied fonts
INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- LinkedIn Tech (default for LinkedIn carousels — keep name)
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Tech',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 320, "w": 920, "h": 340, "fontSize": 62, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#f0fdfa", "fontFamily": "Montserrat" },
        { "id": "body", "x": 80, "y": 700, "w": 920, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#99f6e4", "fontFamily": "Montserrat" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.55, "color": "#0f172a", "extent": 55, "solidSize": 0 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0f172a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_size": 62,
          "body_font_size": 28,
          "headline_font_family": "Montserrat",
          "body_font_family": "Montserrat",
          "background_color": "#0f172a",
          "image_display": { "mode": "full", "position": "center", "fit": "cover" },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0f172a"
        }
      }
    }'::jsonb,
    true
  ),
  -- LinkedIn Tilt — subtle rotation, PIP with angle
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Tilt',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 380, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#fef3c7", "fontFamily": "Inter", "rotation": -3 },
        { "id": "body", "x": 80, "y": 720, "w": 920, "h": 220, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#e2e8f0", "fontFamily": "Inter", "rotation": 2 }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.6, "color": "#0f172a", "extent": 55, "solidSize": 0 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0f172a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "outline",
          "body_highlight_style": "text",
          "headline_outline_stroke": 2,
          "headline_font_size": 64,
          "body_font_size": 26,
          "headline_font_family": "Inter",
          "body_font_family": "Inter",
          "background_color": "#0f172a",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.42, "pipRotation": 5, "pipBorderRadius": 24 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0f172a"
        }
      }
    }'::jsonb,
    true
  ),
  -- LinkedIn Highlight — background highlight style, strong gradient
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Highlight',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 72, "right": 72, "bottom": 120, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 660, "w": 936, "h": 300, "fontSize": 70, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#ffffff", "fontFamily": "Poppins" },
        { "id": "body", "x": 72, "y": 520, "w": 800, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#c7d2fe", "fontFamily": "Poppins" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.85, "color": "#1e1b4b", "extent": 48, "solidSize": 30 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#1e1b4b" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "background",
          "body_highlight_style": "text",
          "headline_font_size": 70,
          "body_font_size": 26,
          "headline_font_family": "Poppins",
          "body_font_family": "Poppins",
          "background_color": "#1e1b4b",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.38, "pipRotation": -8, "pipBorderRadius": 20 },
          "overlay_tint_opacity": 0.7,
          "overlay_tint_color": "#1e1b4b"
        }
      }
    }'::jsonb,
    true
  ),
  -- LinkedIn PIP — classic PIP, no tint
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn PIP',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 700, "w": 920, "h": 280, "fontSize": 76, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#fef9c3" },
        { "id": "body", "x": 80, "y": 560, "w": 760, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "left", "color": "#e7e5e4" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 42, "solidSize": 100 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
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
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4, "pipRotation": 0, "pipBorderRadius": 24 },
          "overlay_tint_opacity": 0,
          "overlay_tint_color": "#0a0a0a"
        }
      }
    }'::jsonb,
    true
  ),
  -- LinkedIn Serif — pattern background, Georgia, PIP
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Serif',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 100, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 340, "fontSize": 64, "fontWeight": 700, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#fffbeb", "fontFamily": "Georgia", "rotation": 1 },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 220, "fontSize": 26, "fontWeight": 400, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#d6d3d1", "fontFamily": "Georgia" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.2, "color": "#0f172a", "extent": 50, "solidSize": 0 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "pattern", "color": "#0f172a", "pattern": "ovals" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Georgia",
          "body_font_family": "Georgia",
          "background_color": "#0f172a",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0f172a"
        }
      }
    }'::jsonb,
    true
  ),
  -- LinkedIn Bold — dots pattern, outline highlight
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Bold',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 280, "w": 936, "h": 400, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "center", "color": "#fef08a", "fontFamily": "Inter" },
        { "id": "body", "x": 72, "y": 720, "w": 936, "h": 200, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#94a3b8", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.25, "color": "#1e293b", "extent": 40, "solidSize": 0 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "pattern", "color": "#1e293b", "pattern": "dots" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "outline",
          "body_highlight_style": "text",
          "headline_outline_stroke": 2,
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
  -- Instagram Punch — full frame, rotation, Poppins
  (
    gen_random_uuid(),
    NULL,
    'Instagram Punch',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 100, "right": 100, "bottom": 120, "left": 100 },
      "textZones": [
        { "id": "headline", "x": 100, "y": 300, "w": 880, "h": 340, "fontSize": 58, "fontWeight": 800, "lineHeight": 1.2, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Poppins", "rotation": -2 },
        { "id": "body", "x": 100, "y": 680, "w": 880, "h": 200, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#f1f5f9", "fontFamily": "Poppins" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6, "color": "#0a0a0a", "extent": 55, "solidSize": 0 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0a0a0a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_size": 58,
          "body_font_size": 26,
          "headline_font_family": "Poppins",
          "body_font_family": "Poppins",
          "background_color": "#0a0a0a",
          "image_display": { "mode": "full", "position": "center", "fit": "cover" }
        }
      }
    }'::jsonb,
    true
  ),
  -- Instagram PIP — emerald gradient, background highlight
  (
    gen_random_uuid(),
    NULL,
    'Instagram PIP',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 640, "w": 904, "h": 320, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#ecfdf5", "fontFamily": "Montserrat" },
        { "id": "body", "x": 88, "y": 500, "w": 780, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#a7f3d0", "fontFamily": "Montserrat" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.8, "color": "#064e3b", "extent": 45, "solidSize": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#064e3b" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "background",
          "body_highlight_style": "text",
          "headline_font_family": "Montserrat",
          "body_font_family": "Montserrat",
          "background_color": "#064e3b",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.45, "pipRotation": 6, "pipBorderRadius": 28 },
          "overlay_tint_opacity": 0,
          "overlay_tint_color": "#064e3b"
        }
      }
    }'::jsonb,
    true
  ),
  -- LinkedIn Designer — showstopper: lines pattern, rotation, outline, PIP with rotation and border
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Designer',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 260, "w": 936, "h": 400, "fontSize": 66, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "center", "color": "#fef9c3", "fontFamily": "Poppins", "rotation": -2 },
        { "id": "body", "x": 72, "y": 700, "w": 936, "h": 240, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#cbd5e1", "fontFamily": "Poppins", "rotation": 1 }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.5, "color": "#0c4a6e", "extent": 52 },
        "vignette": { "enabled": true, "strength": 0.15 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "pattern", "color": "#0c4a6e", "pattern": "lines" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "outline",
          "body_highlight_style": "text",
          "headline_outline_stroke": 2.5,
          "headline_font_size": 66,
          "body_font_size": 26,
          "headline_font_family": "Poppins",
          "body_font_family": "Poppins",
          "background_color": "#0c4a6e",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.44, "pipRotation": -6, "pipBorderRadius": 26, "frame": "medium", "frameColor": "#fef9c3" },
          "overlay_tint_opacity": 0.7,
          "overlay_tint_color": "#0c4a6e"
        }
      }
    }'::jsonb,
    true
  ),
  -- Instagram Story — bold full-frame, high contrast
  (
    gen_random_uuid(),
    NULL,
    'Instagram Story',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 64, "right": 64, "bottom": 100, "left": 64 },
      "textZones": [
        { "id": "headline", "x": 64, "y": 720, "w": 952, "h": 280, "fontSize": 78, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 3, "align": "center", "color": "#ffffff", "fontFamily": "Montserrat" },
        { "id": "body", "x": 64, "y": 580, "w": 952, "h": 120, "fontSize": 28, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "center", "color": "#f1f5f9" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.9, "color": "#000000", "extent": 48, "solidSize": 40 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#000000" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "background",
          "body_highlight_style": "text",
          "headline_font_size": 78,
          "body_font_size": 28,
          "headline_font_family": "Montserrat",
          "body_font_family": "Montserrat",
          "background_color": "#000000",
          "image_display": { "mode": "full", "position": "center", "fit": "cover" },
          "overlay_tint_opacity": 0.65,
          "overlay_tint_color": "#000000"
        }
      }
    }'::jsonb,
    true
  ),
  -- LinkedIn Authority — serif, subtle, PIP top-left for variety
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Authority',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 96, "right": 96, "bottom": 100, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 340, "w": 888, "h": 320, "fontSize": 60, "fontWeight": 700, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#faf5ff", "fontFamily": "Georgia" },
        { "id": "body", "x": 96, "y": 700, "w": 888, "h": 220, "fontSize": 26, "fontWeight": 400, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#e9d5ff", "fontFamily": "Georgia" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.35, "color": "#3b0764", "extent": 58, "solidSize": 0 },
        "vignette": { "enabled": true, "strength": 0.1 }
      },
      "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#3b0764" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Georgia",
          "body_font_family": "Georgia",
          "background_color": "#3b0764",
          "image_display": { "mode": "pip", "pipPosition": "top_left", "pipSize": 0.36, "pipRotation": 3, "pipBorderRadius": 22 },
          "overlay_tint_opacity": 0.72,
          "overlay_tint_color": "#3b0764"
        }
      }
    }'::jsonb,
    true
  );
