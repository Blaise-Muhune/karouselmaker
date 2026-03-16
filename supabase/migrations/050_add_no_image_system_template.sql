-- Add a system template with allowImage: false so users can try the "Clear picture" / "Go ahead and blend" flow.
-- Minimal dark: dark solid bg, white text, no background image (text-only slide).

INSERT INTO public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
VALUES (
  gen_random_uuid(),
  NULL,
  'Minimal dark',
  'generic',
  '1:1',
  '{
    "layout": "headline_center",
    "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
    "textZones": [
      { "id": "headline", "x": 96, "y": 340, "w": 888, "h": 400, "fontSize": 64, "fontWeight": 700, "lineHeight": 1.2, "maxLines": 5, "align": "center", "color": "#ffffff", "fontFamily": "system" },
      { "id": "body", "x": 96, "y": 760, "w": 888, "h": 160, "fontSize": 28, "fontWeight": 500, "lineHeight": 1.3, "maxLines": 2, "align": "center", "color": "#a0a0a0", "fontFamily": "system" }
    ],
    "overlays": { "gradient": { "enabled": false }, "vignette": { "enabled": false, "strength": 0.2 } },
    "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
    "backgroundRules": { "allowImage": false, "defaultStyle": "none" },
    "defaults": {
      "background": { "style": "solid", "color": "#0a0a0a" },
      "meta": {
        "show_counter": true,
        "show_watermark": true,
        "show_made_with": false,
        "headline_highlight_style": "text",
        "body_highlight_style": "text",
        "headline_font_family": "system",
        "body_font_family": "system",
        "background_color": "#0a0a0a"
      }
    }
  }'::jsonb,
  true
);
