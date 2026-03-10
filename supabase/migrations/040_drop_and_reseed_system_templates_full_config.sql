-- Replace ALL system templates with a full-config set (Instagram + LinkedIn optimized).
-- Each template includes defaults.meta: show_counter, show_watermark, show_made_with,
-- headline_highlight_style, body_highlight_style, background_color; LinkedIn also get
-- image_display (pip), overlay_tint. Adds "Impressive" and "Instagram Ready" templates.

-- 1. Clear slide references to system templates
UPDATE public.slides
SET template_id = NULL
WHERE template_id IN (
  SELECT id FROM public.templates WHERE user_id IS NULL
);

-- 2. Remove all system templates
DELETE FROM public.templates WHERE user_id IS NULL;

-- 3. Reseed system templates with full config (1:1 = 1080x1080)
INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
  -- === GENERIC / CTA / HOOK / POINT / CONTEXT (from improved set) ===
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
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
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
    'Headline bottom (hook)',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 100, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 720, "w": 920, "h": 260, "fontSize": 84, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 3, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 580, "w": 720, "h": 120, "fontSize": 30, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "left", "color": "#e5e5e5" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 40, "solidSize": 100 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
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
    'Point clean',
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
        "gradient": { "enabled": true, "direction": "top", "strength": 0.52, "color": "#000000", "extent": 62 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
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
    'Context block',
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
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.65, "color": "#0a0a0a", "extent": 55 },
        "vignette": { "enabled": true, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
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
    'Generic minimal',
    'generic',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 260, "w": 888, "h": 560, "fontSize": 92, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 4, "align": "center", "color": "#ffffff" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.45, "color": "#000000", "extent": 52 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#000000" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "background_color": "#000000"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'Gradient Profile Card',
    'generic',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 700, "w": 936, "h": 240, "fontSize": 74, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 2, "align": "left", "color": "#ffffff" },
        { "id": "body", "x": 72, "y": 960, "w": 936, "h": 160, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.28, "maxLines": 3, "align": "left", "color": "#f0e6ff" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.82, "color": "#7C3AED", "extent": 54, "solidSize": 20 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#7C3AED" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#7C3AED"
        }
      }
    }'::jsonb,
    true
  ),
  -- === IMPRESSIVE: bold typography, high contrast, modern (Instagram + LinkedIn) ===
  (
    gen_random_uuid(),
    NULL,
    'Impressive',
    'generic',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 260, "w": 936, "h": 400, "fontSize": 80, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Montserrat" },
        { "id": "body", "x": 72, "y": 700, "w": 936, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#e2e8f0", "fontFamily": "Montserrat" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.85, "color": "#0f172a", "extent": 50, "solidSize": 30 },
        "vignette": { "enabled": true, "strength": 0.15 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0f172a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Montserrat",
          "body_font_family": "Montserrat",
          "background_color": "#0f172a",
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0f172a",
          "image_display": { "mode": "full", "position": "center", "fit": "cover" }
        }
      }
    }'::jsonb,
    true
  ),
  -- === INSTAGRAM READY: mobile-first, 30% breathing room, 48pt+ headline, 24–28pt body ===
  (
    gen_random_uuid(),
    NULL,
    'Instagram Ready',
    'generic',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 100, "right": 100, "bottom": 120, "left": 100 },
      "textZones": [
        { "id": "headline", "x": 100, "y": 300, "w": 880, "h": 340, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.2, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "Poppins" },
        { "id": "body", "x": 100, "y": 680, "w": 880, "h": 200, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#f1f5f9", "fontFamily": "Poppins" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6, "color": "#0a0a0a", "extent": 55 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0a0a0a" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Poppins",
          "body_font_family": "Poppins",
          "background_color": "#0a0a0a"
        }
      }
    }'::jsonb,
    true
  );

-- 4. LinkedIn templates (full config with meta: image_display pip, overlay_tint)
INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES
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
        { "id": "headline", "x": 80, "y": 320, "w": 920, "h": 340, "fontSize": 62, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#f0fdfa" },
        { "id": "body", "x": 80, "y": 700, "w": 920, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#99f6e4" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.55, "color": "#0f172a", "extent": 55 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#0f172a" },
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
    'LinkedIn Hook',
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
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
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
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
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
    'LinkedIn Leadership',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 72, "right": 72, "bottom": 120, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 680, "w": 936, "h": 280, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 3, "align": "left", "color": "#e0e7ff" },
        { "id": "body", "x": 72, "y": 540, "w": 800, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.28, "maxLines": 2, "align": "left", "color": "#c7d2fe" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.9, "color": "#0f172a", "extent": 45, "solidSize": 80 },
        "vignette": { "enabled": true, "strength": 0.15 }
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
    'LinkedIn CTA',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 440, "fontSize": 56, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 5, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 780, "w": 920, "h": 120, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.25, "maxLines": 2, "align": "center", "color": "#bfdbfe" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#1e3a5f", "extent": 48, "solidSize": 100 },
        "vignette": { "enabled": true, "strength": 0.18 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#1e3a5f" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#1e3a5f",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#1e3a5f"
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Minimal',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 280, "w": 888, "h": 520, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 5, "align": "center", "color": "#0f172a" }
      ],
      "overlays": {
        "gradient": { "enabled": false, "direction": "bottom", "strength": 0.3, "color": "#000000" },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#f8fafc" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "background_color": "#f8fafc",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 }
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    NULL,
    'LinkedIn Wellness',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 300, "w": 904, "h": 360, "fontSize": 60, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#14532d" },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 240, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.32, "maxLines": 3, "align": "center", "color": "#166534" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.35, "color": "#f0fdf4", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#ecfdf5" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#ecfdf5",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 }
        }
      }
    }'::jsonb,
    true
  ),
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
        { "id": "headline", "x": 72, "y": 280, "w": 936, "h": 400, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 4, "align": "center", "color": "#fef08a", "fontFamily": "Inter" },
        { "id": "body", "x": 72, "y": 720, "w": 936, "h": 200, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 3, "align": "center", "color": "#94a3b8", "fontFamily": "Inter" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "top", "strength": 0.25, "color": "#1e293b", "extent": 40 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "pattern", "color": "#1e293b", "pattern": "dots" },
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
    'LinkedIn Vibrant',
    'linkedin',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 80, "right": 80, "bottom": 112, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 380, "fontSize": 68, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff", "fontFamily": "system" },
        { "id": "body", "x": 80, "y": 720, "w": 920, "h": 220, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 3, "align": "center", "color": "#e9d5ff", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.5, "color": "#4c1d95", "extent": 50 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "solid", "color": "#6b21a8" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "background_color": "#6b21a8",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#6b21a8"
        }
      }
    }'::jsonb,
    true
  ),
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
        { "id": "headline", "x": 88, "y": 320, "w": 904, "h": 340, "fontSize": 64, "fontWeight": 700, "lineHeight": 1.12, "maxLines": 4, "align": "center", "color": "#fffbeb", "fontFamily": "Georgia" },
        { "id": "body", "x": 88, "y": 700, "w": 904, "h": 220, "fontSize": 26, "fontWeight": 400, "lineHeight": 1.4, "maxLines": 3, "align": "center", "color": "#d6d3d1", "fontFamily": "Georgia" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.2, "color": "#0f172a", "extent": 50 },
        "vignette": { "enabled": true, "strength": 0.12 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
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
        { "id": "headline", "x": 80, "y": 660, "w": 920, "h": 300, "fontSize": 70, "fontWeight": 800, "lineHeight": 1.06, "maxLines": 3, "align": "left", "color": "#67e8f9", "fontFamily": "Inter" },
        { "id": "body", "x": 80, "y": 520, "w": 800, "h": 120, "fontSize": 26, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "left", "color": "#e2e8f0", "fontFamily": "system" }
      ],
      "overlays": {
        "gradient": { "enabled": true, "direction": "bottom", "strength": 0.7, "color": "#0f172a", "extent": 45 },
        "vignette": { "enabled": false, "strength": 0.2 }
      },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" },
      "defaults": {
        "background": { "style": "pattern", "color": "#1e293b", "pattern": "lines" },
        "meta": {
          "show_counter": true,
          "show_watermark": true,
          "show_made_with": false,
          "headline_highlight_style": "text",
          "body_highlight_style": "text",
          "headline_font_family": "Inter",
          "body_font_family": "system",
          "background_color": "#1e293b",
          "image_display": { "mode": "pip", "pipPosition": "bottom_right", "pipSize": 0.4 },
          "overlay_tint_opacity": 0.75,
          "overlay_tint_color": "#0f172a"
        }
      }
    }'::jsonb,
    true
  );
