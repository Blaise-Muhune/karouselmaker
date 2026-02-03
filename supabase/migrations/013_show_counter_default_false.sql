-- Slide number (show_counter) defaults to off for new presets
ALTER TABLE user_slide_presets
  ALTER COLUMN show_counter SET DEFAULT false;
