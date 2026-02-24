-- Delete all app (system) templates and reseed a clean set. User-created templates (user_id not null) are unchanged.
-- Each template differs clearly: text size, position, overlay (gradient direction/strength/extent/solidSize, vignette), safe area, chrome.
-- 1. Clear slide references so slides fall back to default template
update public.slides
set template_id = null
where template_id in (
  select id from public.templates where user_id is null
);

-- 2. Remove all system templates
delete from public.templates where user_id is null;

-- 3. Reseed app templates: distinct layouts, text zones, and overlays
insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
values
  -- 1. Hook: big headline at bottom, solid dark block, left-aligned
  (
    gen_random_uuid(),
    null,
    'Headline bottom (hook)',
    'hook',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 72, "right": 72, "bottom": 100, "left": 72 },
      "textZones": [
        { "id": "headline", "x": 72, "y": 740, "w": 936, "h": 248, "fontSize": 80, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 3, "align": "left" },
        { "id": "body", "x": 72, "y": 600, "w": 700, "h": 120, "fontSize": 30, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#000000", "extent": 38, "solidSize": 100 }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 2. Point: centered, large headline + smaller body; top gradient so center pops
  (
    gen_random_uuid(),
    null,
    'Point clean',
    'point',
    '1:1',
    '{
      "layout": "headline_center",
      "safeArea": { "top": 88, "right": 88, "bottom": 112, "left": 88 },
      "textZones": [
        { "id": "headline", "x": 88, "y": 340, "w": 904, "h": 340, "fontSize": 72, "fontWeight": 800, "lineHeight": 1.08, "maxLines": 5, "align": "center" },
        { "id": "body", "x": 88, "y": 720, "w": 904, "h": 220, "fontSize": 28, "fontWeight": 600, "lineHeight": 1.25, "maxLines": 3, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "top", "strength": 0.55, "extent": 65, "color": "#000000" }, "vignette": { "enabled": true, "strength": 0.22 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 3. Context: split — small headline top, large body below; bottom gradient + vignette
  (
    gen_random_uuid(),
    null,
    'Context block',
    'context',
    '1:1',
    '{
      "layout": "split_top_bottom",
      "safeArea": { "top": 64, "right": 80, "bottom": 96, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 64, "w": 920, "h": 160, "fontSize": 44, "fontWeight": 800, "lineHeight": 1.12, "maxLines": 2, "align": "left" },
        { "id": "body", "x": 80, "y": 260, "w": 920, "h": 720, "fontSize": 38, "fontWeight": 600, "lineHeight": 1.28, "maxLines": 14, "align": "left" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.6, "extent": 58, "color": "#0a0a0a" }, "vignette": { "enabled": true, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 4. Follow CTA: big centered CTA headline, solid bottom bar; default for new carousels
  (
    gen_random_uuid(),
    null,
    'Follow CTA',
    'cta',
    '1:1',
    '{
      "layout": "headline_bottom",
      "safeArea": { "top": 80, "right": 80, "bottom": 140, "left": 80 },
      "textZones": [
        { "id": "headline", "x": 80, "y": 300, "w": 920, "h": 480, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 6, "align": "center", "color": "#ffffff" },
        { "id": "body", "x": 80, "y": 820, "w": 920, "h": 120, "fontSize": 28, "fontWeight": 600, "lineHeight": 1.2, "maxLines": 2, "align": "center", "color": "#e0e0e0" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 1, "color": "#0a0a0a", "extent": 42, "solidSize": 100 }, "vignette": { "enabled": true, "strength": 0.25 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "bottom_left" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  ),
  -- 5. Generic minimal: headline only, large type; light gradient from bottom
  (
    gen_random_uuid(),
    null,
    'Generic minimal',
    'generic',
    '1:1',
    '{
      "layout": "headline_only",
      "safeArea": { "top": 96, "right": 96, "bottom": 96, "left": 96 },
      "textZones": [
        { "id": "headline", "x": 96, "y": 280, "w": 888, "h": 520, "fontSize": 88, "fontWeight": 800, "lineHeight": 1.05, "maxLines": 4, "align": "center" }
      ],
      "overlays": { "gradient": { "enabled": true, "direction": "bottom", "strength": 0.48, "extent": 55, "color": "#000000" }, "vignette": { "enabled": false, "strength": 0.2 } },
      "chrome": { "showSwipe": true, "showCounter": true, "counterStyle": "1/8", "watermark": { "enabled": true, "position": "top_right" } },
      "backgroundRules": { "allowImage": true, "defaultStyle": "darken" }
    }'::jsonb,
    true
  );
