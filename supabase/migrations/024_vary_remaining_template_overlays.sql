-- Vary overlay settings across remaining (centered) system templates so each has a distinct look.
-- Uses direction, strength, extent, solidSize, vignette, and color.

-- Point clean: top gradient, medium strength, vignette
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"top","strength":0.55,"extent":65,"color":"#000000"},"vignette":{"enabled":true,"strength":0.2}}'::jsonb)
where user_id is null and name = 'Point clean';

-- CTA bold: bottom, strong, with solid bar (extent + solidSize)
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.75,"extent":55,"solidSize":25,"color":"#0a0a0a"},"vignette":{"enabled":false,"strength":0.2}}'::jsonb)
where user_id is null and name = 'CTA bold';

-- Generic minimal: bottom, soft gradient, wide extent
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.5,"extent":75,"color":"#000000"},"vignette":{"enabled":true,"strength":0.15}}'::jsonb)
where user_id is null and name = 'Generic minimal';

-- Quote block: bottom, medium, slight vignette
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.55,"extent":60,"color":"#0a0a0a"},"vignette":{"enabled":true,"strength":0.18}}'::jsonb)
where user_id is null and name = 'Quote block';

-- Impact: bottom, strong opacity, narrow extent
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.7,"extent":50,"color":"#000000"},"vignette":{"enabled":false,"strength":0.2}}'::jsonb)
where user_id is null and name = 'Impact';

-- Centered punch: bottom, gradient with solid band
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.6,"extent":60,"solidSize":20,"color":"#000000"},"vignette":{"enabled":true,"strength":0.22}}'::jsonb)
where user_id is null and name = 'Centered punch';

-- Story block: keep solid bar vibe, tweak extent
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":1,"color":"#000000","extent":38,"solidSize":100},"vignette":{"enabled":false,"strength":0.2}}'::jsonb)
where user_id is null and name = 'Story block';

-- Punch fact: bottom, strong, vignette
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.68,"extent":58,"color":"#000000"},"vignette":{"enabled":true,"strength":0.25}}'::jsonb)
where user_id is null and name = 'Punch fact';

-- Minimal dark: no image template; add subtle vignette for edge depth
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":false,"direction":"bottom","strength":0},"vignette":{"enabled":true,"strength":0.12}}'::jsonb)
where user_id is null and name = 'Minimal dark';

-- Swipe bait: bottom, high contrast, extent + small solid
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.72,"extent":62,"solidSize":12,"color":"#000000"},"vignette":{"enabled":true,"strength":0.28}}'::jsonb)
where user_id is null and name = 'Swipe bait';

-- Number punch: bottom, classic dark gradient
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.62,"extent":70,"color":"#000000"},"vignette":{"enabled":true,"strength":0.2}}'::jsonb)
where user_id is null and name = 'Number punch';

-- Follow CTA: keep strong bottom (default style), add extent/solid for variety
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.7,"extent":60,"solidSize":20,"color":"#0a0a0a"},"vignette":{"enabled":true,"strength":0.2}}'::jsonb)
where user_id is null and name = 'Follow CTA';

-- Curiosity gap: top gradient for variety (text at top)
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"top","strength":0.5,"extent":45,"color":"#000000"},"vignette":{"enabled":true,"strength":0.25}}'::jsonb)
where user_id is null and name = 'Curiosity gap';

-- Emotional hook: solid bar bottom, dramatic
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":1,"color":"#000000","extent":42,"solidSize":100},"vignette":{"enabled":true,"strength":0.3}}'::jsonb)
where user_id is null and name = 'Emotional hook';

-- Viral tease: bottom, punchy
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":0.72,"extent":65,"color":"#000000"},"vignette":{"enabled":true,"strength":0.3}}'::jsonb)
where user_id is null and name = 'Viral tease';

-- Retention block: solid bar, save-this style
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":true,"direction":"bottom","strength":1,"color":"#0a0a0a","extent":40,"solidSize":100},"vignette":{"enabled":false,"strength":0.2}}'::jsonb)
where user_id is null and name = 'Retention block';

-- Cool minimal: no image; light vignette only
update public.templates
set config = jsonb_set(config, '{overlays}', '{"gradient":{"enabled":false,"direction":"bottom","strength":0},"vignette":{"enabled":true,"strength":0.1}}'::jsonb)
where user_id is null and name = 'Cool minimal';
