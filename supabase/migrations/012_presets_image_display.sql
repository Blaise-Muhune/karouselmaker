-- Add image_display to presets (layout, divider, frame, etc.)
alter table public.user_slide_presets
  add column if not exists image_display jsonb;
