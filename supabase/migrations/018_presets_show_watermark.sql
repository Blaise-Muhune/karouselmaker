-- Add show_watermark to presets (logo visibility: first/second/last=on, middle=off by default)
alter table public.user_slide_presets
  add column if not exists show_watermark boolean;
